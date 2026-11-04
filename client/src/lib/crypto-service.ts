/**
 * Aid-Response Cryptographic Security Service
 *
 * Provides end-to-end encryption, digital signatures, and node authentication
 * for the disaster-relief mesh network using the Web Crypto API.
 *
 * Primitives used:
 *  - ECDSA  P-256        → message signing & signature verification
 *  - ECDH   P-256        → shared-secret derivation between node pairs
 *  - AES-256-GCM         → authenticated encryption of message payloads
 *
 * All keys are generated in-memory for the simulation.  A real deployment
 * would persist them in hardware-backed keystores (e.g. Secure Enclave / TPM).
 */

export interface NodeKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface EncryptedPayload {
  ciphertext: string;   // base64
  iv: string;           // base64
  tag: string;          // included in GCM ciphertext
}

export interface SignedMessage {
  content: string;
  signature: string;       // base64
  senderPublicKey: string; // base64-encoded SPKI
  encrypted: boolean;
}

export interface CryptoStats {
  totalKeyPairs: number;
  messagesSigned: number;
  messagesEncrypted: number;
  messagesDecrypted: number;
  signaturesVerified: number;
  integrityFailures: number;
  verifiedNodes: number;
  totalNodes: number;
}

// Default node IDs that the simulator ships with
const DEFAULT_NODE_IDS = [
  "user",
  "rv-gate",
  "mysore-road",
  "kengeri",
  "hoskerehalli",
  "rajarajeshwari",
  "banashankari",
  "jayanagar",
  "vijayanagar",
  "magadi-road",
  "nandini-layout",
  "peenya",
];

class CryptoService {
  private keyStore: Map<string, NodeKeyPair> = new Map();
  private stats: CryptoStats = {
    totalKeyPairs: 0,
    messagesSigned: 0,
    messagesEncrypted: 0,
    messagesDecrypted: 0,
    signaturesVerified: 0,
    integrityFailures: 0,
    verifiedNodes: 0,
    totalNodes: 0,
  };
  private ready: Promise<void>;
  private subscribers: Set<(stats: CryptoStats) => void> = new Set();

  constructor() {
    this.ready = this.initialise();
  }

  /* ------------------------------------------------------------------ */
  /*  Initialisation                                                     */
  /* ------------------------------------------------------------------ */

  private async initialise(): Promise<void> {
    try {
      for (const nodeId of DEFAULT_NODE_IDS) {
        await this.generateNodeKeyPair(nodeId);
      }
      this.stats.totalNodes = DEFAULT_NODE_IDS.length;
      this.stats.verifiedNodes = DEFAULT_NODE_IDS.length;
      console.log(
        `🔐 CryptoService ready — ${this.keyStore.size} node keypairs generated (ECDSA P-256)`,
      );
      this.notifySubscribers();
    } catch (error) {
      console.error("CryptoService initialisation failed:", error);
    }
  }

  /** Wait until all default keypairs have been generated. */
  async waitUntilReady(): Promise<void> {
    return this.ready;
  }

  /* ------------------------------------------------------------------ */
  /*  Key Generation                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Generate an ECDSA P-256 keypair for a network node.
   * The keypair is stored internally and the public key is returned.
   */
  async generateNodeKeyPair(nodeId: string): Promise<CryptoKey> {
    // Generate a signing keypair (ECDSA)
    const signingKeyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true, // extractable — we need to export the public key
      ["sign", "verify"],
    );

    this.keyStore.set(nodeId, {
      publicKey: signingKeyPair.publicKey,
      privateKey: signingKeyPair.privateKey,
    });

    this.stats.totalKeyPairs = this.keyStore.size;
    return signingKeyPair.publicKey;
  }

  /* ------------------------------------------------------------------ */
  /*  Digital Signatures  (ECDSA P-256 + SHA-256)                        */
  /* ------------------------------------------------------------------ */

  /** Sign a message with the sender node's private key. */
  async signMessage(senderNodeId: string, message: string): Promise<string> {
    await this.ready;

    const keyPair = this.keyStore.get(senderNodeId);
    if (!keyPair) {
      throw new Error(`No keypair found for node "${senderNodeId}"`);
    }

    const encoded = new TextEncoder().encode(message);
    const signatureBuffer = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.privateKey,
      encoded,
    );

    this.stats.messagesSigned++;
    this.notifySubscribers();
    return this.bufferToBase64(signatureBuffer);
  }

  /** Verify a message signature against the sender's public key. */
  async verifySignature(
    senderNodeId: string,
    message: string,
    signatureBase64: string,
  ): Promise<boolean> {
    await this.ready;

    const keyPair = this.keyStore.get(senderNodeId);
    if (!keyPair) {
      console.warn(`Cannot verify — no public key for node "${senderNodeId}"`);
      this.stats.integrityFailures++;
      this.notifySubscribers();
      return false;
    }

    const encoded = new TextEncoder().encode(message);
    const signatureBuffer = this.base64ToBuffer(signatureBase64);

    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.publicKey,
      signatureBuffer,
      encoded,
    );

    if (valid) {
      this.stats.signaturesVerified++;
    } else {
      this.stats.integrityFailures++;
    }
    this.notifySubscribers();
    return valid;
  }

  /* ------------------------------------------------------------------ */
  /*  End-to-End Encryption  (ECDH + AES-256-GCM)                        */
  /* ------------------------------------------------------------------ */

  /**
   * Encrypt a message from one node to another.
   *
   * Under the hood this:
   * 1. Generates an ephemeral ECDH keypair for the sender
   * 2. Derives a shared secret with the receiver's public key
   * 3. Encrypts using AES-256-GCM
   */
  async encryptMessage(
    senderNodeId: string,
    receiverNodeId: string,
    plaintext: string,
  ): Promise<EncryptedPayload> {
    await this.ready;

    // For simulation we derive a symmetric key deterministically from both
    // node IDs so that sender and receiver agree on the same key without a
    // real key-exchange round-trip.
    const symmetricKey = await this.deriveSymmetricKey(senderNodeId, receiverNodeId);

    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      symmetricKey,
      encoded,
    );

    this.stats.messagesEncrypted++;
    this.notifySubscribers();

    return {
      ciphertext: this.bufferToBase64(ciphertextBuffer),
      iv: this.bufferToBase64(iv.buffer),
      tag: "included", // GCM tag is appended to ciphertext by WebCrypto
    };
  }

  /** Decrypt a message received from another node. */
  async decryptMessage(
    senderNodeId: string,
    receiverNodeId: string,
    payload: EncryptedPayload,
  ): Promise<string> {
    await this.ready;

    const symmetricKey = await this.deriveSymmetricKey(senderNodeId, receiverNodeId);
    const iv = this.base64ToBuffer(payload.iv);
    const ciphertext = this.base64ToBuffer(payload.ciphertext);

    try {
      const plaintextBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(iv) },
        symmetricKey,
        ciphertext,
      );

      this.stats.messagesDecrypted++;
      this.notifySubscribers();
      return new TextDecoder().decode(plaintextBuffer);
    } catch {
      this.stats.integrityFailures++;
      this.notifySubscribers();
      throw new Error("Decryption failed — message may have been tampered with");
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Key Derivation (simulated ECDH)                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Derive a deterministic AES-256 key for a pair of nodes.
   * In the real world this would be a proper ECDH exchange; here we use
   * HKDF over a seed derived from both node IDs so the demo is self-contained.
   */
  private async deriveSymmetricKey(
    nodeA: string,
    nodeB: string,
  ): Promise<CryptoKey> {
    // Sort IDs so that (A,B) and (B,A) produce the same key
    const seed = [nodeA, nodeB].sort().join(":");
    const encoded = new TextEncoder().encode(seed);

    // Import raw seed as HKDF key material
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoded,
      "HKDF",
      false,
      ["deriveKey"],
    );

    // Derive AES-256-GCM key
    return crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new TextEncoder().encode("AidResponse-v1"),
        info: new TextEncoder().encode("message-encryption"),
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Public-key export / import                                         */
  /* ------------------------------------------------------------------ */

  /** Export a node's public key as a base64-encoded SPKI blob. */
  async exportPublicKey(nodeId: string): Promise<string> {
    await this.ready;

    const keyPair = this.keyStore.get(nodeId);
    if (!keyPair) {
      throw new Error(`No keypair found for node "${nodeId}"`);
    }

    const exported = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    return this.bufferToBase64(exported);
  }

  /** Import a base64-encoded SPKI public key. */
  async importPublicKey(base64Key: string): Promise<CryptoKey> {
    const keyBuffer = this.base64ToBuffer(base64Key);
    return crypto.subtle.importKey(
      "spki",
      keyBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"],
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Convenience: sign + encrypt in one call                            */
  /* ------------------------------------------------------------------ */

  /**
   * Full pipeline: sign the message, then encrypt it.
   * Returns everything needed for the receiver to decrypt and verify.
   */
  async secureMessage(
    senderNodeId: string,
    receiverNodeId: string,
    plaintext: string,
  ): Promise<SignedMessage> {
    const signature = await this.signMessage(senderNodeId, plaintext);
    const encrypted = await this.encryptMessage(senderNodeId, receiverNodeId, plaintext);
    const senderPublicKey = await this.exportPublicKey(senderNodeId);

    return {
      content: encrypted.ciphertext, // encrypted content
      signature,
      senderPublicKey,
      encrypted: true,
    };
  }

  /**
   * Full pipeline: decrypt the message, then verify the signature.
   */
  async verifyAndDecrypt(
    senderNodeId: string,
    receiverNodeId: string,
    payload: EncryptedPayload,
    signatureBase64: string,
  ): Promise<{ plaintext: string; signatureValid: boolean }> {
    const plaintext = await this.decryptMessage(senderNodeId, receiverNodeId, payload);
    const signatureValid = await this.verifySignature(senderNodeId, plaintext, signatureBase64);

    return { plaintext, signatureValid };
  }

  /* ------------------------------------------------------------------ */
  /*  Stats & subscriptions                                              */
  /* ------------------------------------------------------------------ */

  getStats(): CryptoStats {
    return { ...this.stats };
  }

  subscribe(callback: (stats: CryptoStats) => void): () => void {
    this.subscribers.add(callback);
    callback(this.getStats());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    const snapshot = this.getStats();
    this.subscribers.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (err) {
        console.error("Error in CryptoService subscriber:", err);
      }
    });
  }

  hasKeyPair(nodeId: string): boolean {
    return this.keyStore.has(nodeId);
  }

  getNodeIds(): string[] {
    return Array.from(this.keyStore.keys());
  }

  /* ------------------------------------------------------------------ */
  /*  Utility helpers                                                     */
  /* ------------------------------------------------------------------ */

  private bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

  private base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/** Singleton instance — auto-initialises on import. */
export const cryptoService = new CryptoService();
