# Aid-Response: Disaster Relief Communication Network

**Aid-Response** is an IoT-based Disaster Communication Network that establishes a resilient mesh topology for emergency communication when traditional infrastructure (cell towers, internet) fails. Designed for disaster scenarios such as earthquakes, floods, and hurricanes, the system ensures fault-tolerant, self-healing, and real-time message delivery across affected zones.

---

## 📖 Project Overview

During disasters, communication infrastructure often collapses — isolating victims and rescue teams. Aid-Response bridges this gap by creating a mesh network using distributed IoT nodes that communicate autonomously. It provides reliable message routing, location tracking, and priority-based delivery even under network fragmentation or partial failure.

### 🏗️ Project Structure
The repository is split into several core components to keep the logic modular:

- **`/client`**: Contains the frontend Progressive Web Application (PWA) built with React. This handles the dashboard, node visualization on the map, mesh topology simulation, and the chat interface.
- **`/server`**: Contains the Node.js/Express backend server. It handles REST APIs, WebSockets for real-time mesh node communication, database interactions, and Cisco/Webex webhook integrations.
- **`/shared`**: Contains the shared TypeScript schemas (using Zod) and database models (using Drizzle ORM) that are utilized by both the frontend and the backend.
- **`/mobile`**: Contains the source code and assets for the Android mobile application which end-users use to interface with the mesh network via Bluetooth/Wi-Fi Direct.

---

## 🛠️ Tools and Technologies

The project is built on a modern, full-stack JavaScript/TypeScript ecosystem along with several robust tools:

- **Frontend:**
  - React 18 & TypeScript
  - Vite (Build Tool)
  - Tailwind CSS & Shadcn UI (Styling & Components)
  - Mapbox GL (Interactive Mapping)
  - React Query (Data Fetching & State)
  - Web Crypto API (In-browser ECDSA P-256 and AES-256-GCM cryptography)
- **Backend:**
  - Node.js & Express.js
  - WebSockets (Real-time data streaming)
  - Drizzle ORM (Type-safe SQL queries)
  - PostgreSQL (Database, via Neon Serverless)
- **Mobile App:**
  - Flutter & Dart (Cross-platform client under `/mobile/appDisas`)
- **External Integrations:**
  - Cisco Webex API (Emergency SOS alerts to crisis rooms)
  - Meraki Dashboard API (Uplink telemetry)
  - Cisco Duo (Secure authentication for the command center)

## 📚 Documentation & Architecture (For Judges)

To fully understand the engineering depth and architectural decisions made during this hackathon, please review the following documentation:

- [**DIAGRAMS.md**](./DIAGRAMS.md): Contains comprehensive Architecture Diagrams, Tech Stack details, Emergency SOS Routing workflows, and Database Entity-Relationship (ER) models.
- [**ADR.md**](./ADR.md): Architecture Decision Records documenting our choices regarding the Full-Stack approach, Dijkstra's algorithm, Mocking vs. Real APIs, and Mobile integrations.

**Key Technical Highlights for Judges:**
- **True Full-Stack Implementation**: We built a complete backend simulation (Node.js + PostgreSQL) instead of just mocking frontend state, providing a robust "digital twin" of a disaster zone.
- **Dynamic Dijkstra Routing**: The backend dynamically calculates the optimal path for SOS messages. If a node fails, the algorithm instantly recalculates, proving mesh resilience.
- **Cisco Ecosystem Integration**: 
  - **Cisco Duo**: Secures the command center dashboard.
  - **Cisco Meraki (Simulated)**: Acts as the gateway node for the mesh network.
  - **Cisco Webex**: Real API integration that pushes emergency SOS alerts into crisis rooms.
  - **Cisco SecureX (Simulated)**: Emphasizes the need for End-to-End Encryption (E2EE) which we implemented via the Web Crypto API.
  - **Cisco IoT Dashboard (Simulated)**: Allows administrators to monitor the real-time performance and status of individual nodes.

---

## 🚀 Getting Started

Follow the instructions below to get both the Web Dashboard and the Mobile App up and running.

### 1. Clone the Repository
```bash
git clone https://github.com/Pratyush038/Aid-response-cisco
cd Aid-response-cisco
```

### 2. Run the Web Application
The web application requires Node.js (v18+) and a PostgreSQL database.

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Setup Environment Variables:**
   Create a `.env` file in the root directory and add your database credentials and API keys (refer to `.env.example`).
   ```bash
   DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
   VITE_MAPBOX_API_KEY="pk.your-mapbox-public-token"
   WEBEX_BOT_TOKEN="your-webex-bot-token"
   WEBEX_ROOM_ID="your-webex-room-id"
   GROQ_API_KEY="gsk_your_groq_key"
   DUO_CLIENT_ID="DIXXXXXXXXXXXXXXXXXX"
   DUO_CLIENT_SECRET="your-40-character-client-secret"
   DUO_API_HOSTNAME="api-xxxxxxxx.duosecurity.com"
   PORT=5050
   DUO_REDIRECT_URI="http://localhost:5050/api/auth/duo/callback"
   ```
3. **Push the Database Schema:**
   Ensure your database is up to date by pushing the Drizzle schema.
   ```bash
   npm run db:push
   ```
4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
5. **Use the website::**
   - Website can be accessed at `http://localhost:5050/login` (if that seems to fail try `http://localhost:5000/login`)
   - Register using Cisco Duo at the login page to start using the website
   - Use the navigation on the bottom for different options

### 3. Run the Mobile App
The mobile app is designed to simulate a user connecting to a local gateway node in a disaster zone. 

1. **Locate the APK:**
   The compiled Android Package (APK) file is located inside the `/mobile` directory (or can be downloaded from the repository's Releases section if packaged there). Install this `.apk` file on your Android device or emulator.
2. **Configure the Gateway:**
   - Open the Aid-Response Mobile App.
   - Tap on **"Mesh Gateway Configuration"** on the startup screen.
   - You will be prompted to enter the IP address of your running web server. Input the local IPv4 address of your computer running the backend along with the port (e.g., `192.168.29.220:5050`).
3. **Enter Sandbox Mode:**
   - After saving the IP address, tap on the **"Local Sandbox Mode"** button.
   - Ensure your phone and your computer are connected to the same local Wi-Fi network.
4. **Final Step:**
   You are now connected to the mesh simulation! You can use the app to send encrypted messages or trigger an SOS, which will immediately show up on the web dashboard map.

---

*Note: For the mobile app to successfully reach the backend, your firewall must allow incoming connections on the specified port (e.g., `5050`), and you must use your machine's local network IP, not `localhost`.*
