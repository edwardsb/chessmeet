# ChessMeet

Instant video chess matching. Play real-time chess with video chat - no registration required.

## Features

- 🎮 **Real-time Chess** - Play chess with instant move synchronization via WebSockets
- 📹 **Video Chat** - Built-in video calling powered by Cloudflare RealtimeKit
- ⚡ **Global Edge Network** - Sub-100ms latency via Cloudflare's 330+ data centers
- 🔒 **No Registration** - Jump straight into a game
- 🏆 **Smart Matching** - Queue-based player matching (coming soon)

## Tech Stack

### Frontend
- **Next.js 16.1.2** - React framework with App Router
- **React 19** - UI library
- **TypeScript 5** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **chess.js** - Chess game logic and move validation
- **react-chessboard** - Interactive chessboard component
- **Cloudflare RealtimeKit** - Video calling SDK

### Backend
- **Cloudflare Workers** - Serverless compute at the edge
- **Durable Objects** - Stateful coordination for game rooms and matching queue
- **WebSockets** - Real-time game state synchronization
- **Cloudflare Calls API** - Video meeting infrastructure
- **D1 Database** - Data persistence

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd chessmeet
```

2. Install dependencies:
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

3. Set up Cloudflare Workers secrets:
```bash
cd backend
npx wrangler secret put CALLS_APP_SECRET
# Paste your Cloudflare Calls app secret

npx wrangler secret put CALLS_APP_ID
# Paste your Cloudflare Calls app ID
```

### Running Locally

1. Start the backend (Cloudflare Workers):
```bash
cd backend
npx wrangler dev
```
The backend will run on `http://localhost:8787`

2. In a new terminal, start the frontend:
```bash
cd frontend
npm run dev
```
The frontend will run on `http://localhost:3000`

3. Open your browser to `http://localhost:3000` and click "Play Now"

## Project Structure

```
chessmeet/
├── frontend/           # Next.js frontend application
│   ├── src/
│   │   └── app/
│   │       ├── play/[gameId]/page.tsx    # Game page with board & video
│   │       ├── layout.tsx                # Root layout
│   │       └── page.tsx                  # Landing page
│   ├── public/         # Static assets
│   └── package.json
├── backend/            # Cloudflare Workers backend
│   ├── src/
│   │   └── index.ts    # Main entry point with Durable Objects
│   ├── wrangler.toml   # Cloudflare configuration
│   └── package.json
├── AGENTS.md           # Guidelines for AI agents
└── README.md
```

## Development

### Frontend Commands
```bash
cd frontend
npm run dev       # Start development server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

### Backend Commands
```bash
cd backend
npx wrangler dev      # Start local dev server (port 8787)
npx wrangler deploy   # Deploy to Cloudflare
npx wrangler tail     # View real-time logs
```

## Architecture

### Game Flow
1. Player clicks "Play Now" on the landing page
2. Frontend generates a random game ID and redirects to `/play/[gameId]`
3. Frontend establishes WebSocket connection to backend at `ws://localhost:8787/api/game/[gameId]/ws`
4. Backend creates/locates a `GameRoom` Durable Object for the game
5. Player makes moves via chessboard UI
6. Moves are validated by chess.js and sent via WebSocket
7. Durable Object updates game state and broadcasts to all connected players
8. Video call is initiated when both players connect

### Durable Objects
- **GameRoom** - Manages game state, WebSocket connections, and video session tokens
- **MatchingQueue** - Coordinates player matching (planned enhancement)

## Deployment

### Deploy to Cloudflare

1. Deploy the backend:
```bash
cd backend
npx wrangler deploy
```

2. Deploy the frontend to Cloudflare Pages:
```bash
cd frontend
npm run build
# Follow Cloudflare Pages deployment guide or use GitHub integration
```

## Contributing

Please follow the guidelines in [AGENTS.md](./AGENTS.md) for code style and conventions.

## License

ISC
