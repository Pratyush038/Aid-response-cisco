import type { Express, NextFunction, Request, Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { Client as DuoClient } from "@duosecurity/duo_universal";
import { z } from "zod";
import { pool } from "./db";
import { storage } from "./storage";
import { log } from "./vite";

/**
 * Authentication: Passport Local (password factor) + Cisco Duo Universal
 * Prompt (Web SDK v4) as the second factor.
 *
 * Flow:
 *   1. POST /api/auth/login        — verify username/password (Passport Local).
 *      On success the session holds `preAuthUsername`; the user is NOT yet
 *      logged in. Response tells the client to start the Duo redirect.
 *   2. GET  /api/auth/duo/start    — generate a state token (stored in the
 *      session), build the Duo authorization URL, return it to the browser.
 *   3. Browser navigates to Duo's Universal Prompt (hosted by Duo).
 *   4. GET  /api/auth/duo/callback — Duo redirects back with ?duo_code&state.
 *      Verify state, exchange the code for a 2FA result, then establish the
 *      real login session with `mfaAuthenticated = true`.
 */

const scrypt = promisify(scryptCallback);

declare module "express-session" {
  interface SessionData {
    preAuthUsername?: string;
    duoState?: string;
    mfaAuthenticated?: boolean;
  }
}

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
    }
  }
}

// ---------------------------------------------------------------------------
// Duo configuration — loaded from env, validated up front. The app still
// boots without Duo creds (password-only, with a loud warning) so a missing
// secret never takes the whole demo down.
// ---------------------------------------------------------------------------
const DUO_CLIENT_ID = process.env.DUO_CLIENT_ID ?? "";
const DUO_CLIENT_SECRET = process.env.DUO_CLIENT_SECRET ?? "";
const DUO_API_HOSTNAME = process.env.DUO_API_HOSTNAME ?? "";
const DUO_REDIRECT_URI =
  process.env.DUO_REDIRECT_URI ?? "http://localhost:5000/api/auth/duo/callback";

export const isDuoConfigured = Boolean(DUO_CLIENT_ID && DUO_CLIENT_SECRET && DUO_API_HOSTNAME);

let duoClient: DuoClient | null = null;

function getDuoClient(): DuoClient {
  if (!duoClient) {
    // The constructor validates id/secret lengths and throws with a clear
    // message if they are malformed — let that surface to the route handler.
    duoClient = new DuoClient({
      clientId: DUO_CLIENT_ID,
      clientSecret: DUO_CLIENT_SECRET,
      apiHost: DUO_API_HOSTNAME,
      redirectUrl: DUO_REDIRECT_URI,
    });
  }
  return duoClient;
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt, no extra dependency)
// ---------------------------------------------------------------------------
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

const credentialsSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const duoCallbackSchema = z.object({
  duo_code: z.string().min(1),
  state: z.string().min(1),
});

// Route guard for anything that must sit behind completed MFA.
export function requireMfa(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated?.() && req.session.mfaAuthenticated) {
    return next();
  }
  res.status(401).json({ message: "MFA-authenticated session required" });
}

export function setupAuth(app: Express) {
  // -------------------------------------------------------------------------
  // Session — Postgres-backed (survives server restarts; works with Neon)
  // -------------------------------------------------------------------------
  const PgSessionStore = connectPgSimple(session);
  const sessionSecret = process.env.SESSION_SECRET ?? "resqnet-dev-only-secret";
  if (!process.env.SESSION_SECRET) {
    log("WARNING: SESSION_SECRET not set — using an insecure dev fallback", "auth");
  }

  app.use(
    session({
      store: new PgSessionStore({ pool, createTableIfMissing: true }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax", // must be lax so the cookie rides the top-level redirect back from Duo
        secure: false, // set true behind HTTPS in production
        maxAge: 8 * 60 * 60 * 1000, // 8h shift
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username.trim());
        if (!user || !(await verifyPassword(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, { id: user.id, username: user.username });
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user ? { id: user.id, username: user.username } : false);
    } catch (error) {
      done(error);
    }
  });

  if (!isDuoConfigured) {
    log("WARNING: Duo env vars missing — MFA is DISABLED (password-only login)", "auth");
  }

  // -------------------------------------------------------------------------
  // Registration (demo convenience — creates a user Duo can then challenge)
  // -------------------------------------------------------------------------
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = credentialsSchema.parse(req.body);
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "Username is already taken" });
      }
      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
      });
      res.status(201).json({ id: user.id, username: user.username });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid credentials" });
      }
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // -------------------------------------------------------------------------
  // Step 1: password factor. Does NOT establish the login session yet.
  // -------------------------------------------------------------------------
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (error: unknown, user: Express.User | false) => {
      if (error) return next(error);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      if (!isDuoConfigured) {
        // Degraded mode: no Duo creds — log straight in, but say so.
        return req.logIn(user, (loginError) => {
          if (loginError) return next(loginError);
          req.session.mfaAuthenticated = false;
          res.json({ mfaRequired: false, username: user.username, warning: "Duo is not configured — MFA skipped" });
        });
      }

      // Park the identity until Duo confirms the second factor.
      req.session.preAuthUsername = user.username;
      req.session.mfaAuthenticated = false;
      res.json({ mfaRequired: true, next: "/api/auth/duo/start" });
    })(req, res, next);
  });

  // -------------------------------------------------------------------------
  // Step 2: initialize the Duo Universal Prompt redirect
  // -------------------------------------------------------------------------
  app.get("/api/auth/duo/start", async (req, res) => {
    try {
      const username = req.session.preAuthUsername;
      if (!username) {
        return res.status(401).json({ message: "Complete the password step first" });
      }
      if (!isDuoConfigured) {
        return res.status(503).json({ message: "Duo MFA is not configured on this server" });
      }

      const duo = getDuoClient();
      // Confirm Duo's service is reachable before redirecting the user.
      await duo.healthCheck();

      const state = duo.generateState();
      req.session.duoState = state;

      const authUrl = await duo.createAuthUrl(username, state);
      res.json({ authUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start Duo authentication";
      log(`Duo start failed: ${message}`, "auth");
      res.status(502).json({ message: `Duo unavailable: ${message}` });
    }
  });

  // -------------------------------------------------------------------------
  // Step 3: Duo redirects back here after the Universal Prompt
  // -------------------------------------------------------------------------
  app.get("/api/auth/duo/callback", async (req, res) => {
    const username = req.session.preAuthUsername;
    const expectedState = req.session.duoState;

    try {
      const { duo_code, state } = duoCallbackSchema.parse(req.query);

      if (!username || !expectedState || state !== expectedState) {
        // State mismatch = possible CSRF or an expired session — reject.
        return res.redirect("/login?mfa=state_mismatch");
      }

      // Verify the authorization code with Duo (signed JWT under the hood).
      await getDuoClient().exchangeAuthorizationCodeFor2FAResult(duo_code, username);

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.redirect("/login?mfa=unknown_user");
      }

      // Both factors passed — establish the real session now.
      req.logIn({ id: user.id, username: user.username }, (loginError) => {
        if (loginError) {
          log(`Session establishment failed: ${loginError}`, "auth");
          return res.redirect("/login?mfa=session_error");
        }
        req.session.mfaAuthenticated = true;
        delete req.session.preAuthUsername;
        delete req.session.duoState;
        res.redirect("/app?mfa=success");
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Duo callback rejected: ${message}`, "auth");
      res.redirect("/login?mfa=denied");
    }
  });

  // -------------------------------------------------------------------------
  // Session introspection + logout
  // -------------------------------------------------------------------------
  app.get("/api/auth/me", (req, res) => {
    res.json({
      authenticated: Boolean(req.isAuthenticated?.() && req.user),
      username: req.user?.username ?? null,
      mfaAuthenticated: Boolean(req.session.mfaAuthenticated),
      duoConfigured: isDuoConfigured,
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out" });
      });
    });
  });
}
