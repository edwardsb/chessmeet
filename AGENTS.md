# ChessMeet Agent Guidelines

This document provides guidelines for AI agents working on the ChessMeet codebase, which consists of a Next.js frontend (in `frontend/`) and a Cloudflare Workers backend with Durable Objects (in `backend/`).

## Build, Lint, and Test Commands

### Frontend (Next.js)
```bash
cd frontend
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Backend (Cloudflare Workers)
```bash
cd backend
npx wrangler dev              # Start local dev server (runs on port 8787)
npx wrangler deploy           # Deploy to Cloudflare
npx wrangler tail             # View real-time logs
```

### Running Single Tests
Currently no test framework is configured. When adding tests, use Vitest for backend and Jest for frontend. Configure test commands in `package.json` scripts.

## Code Style Guidelines

### Imports
- Group imports: external libraries, internal modules, then stylesheets
- React imports first in frontend files
- Use absolute imports with `@/*` path alias in frontend (configured in `tsconfig.json`)
- Example: `import { useEffect, useState } from 'react';` (React first)

### TypeScript
- Always enable strict mode (already configured)
- Explicitly type function parameters and return types in backend
- Use `interface` for object shapes, `type` for unions/primitives
- Avoid `any` - use `unknown` with type guards if needed
- Use type assertions with `as` sparingly (prefer `@ts-ignore` only when absolutely necessary)

### Naming Conventions
- **Variables/Functions**: `camelCase`
- **Components/Classes**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE` (global) or `camelCase` (module-level)
- **File names**: `kebab-case` folders, `PascalCase` components
- **Frontend**: Start client components with `'use client';`
- Use functional components with hooks and dynamic imports for large components (e.g., Chessboard with `ssr: false`)

### Error Handling
- Use try-catch for async operations
- Log errors with `console.error()` for debugging
- Return error responses in backend with appropriate status codes:
```typescript
try {
  const result = await operation();
  return new Response(JSON.stringify(result), { status: 200 });
} catch (e: any) {
  console.error("Operation failed", e);
  return new Response(JSON.stringify({ error: e.message }), { status: 500 });
}
```

### WebSocket Messages & Durable Objects
- Use JSON format with `type` field for message routing: `{ type: "move", move: { from: "e2", to: "e4" } }`
- Export Durable Object classes with `export class`
- Implement `fetch()` for HTTP requests and `webSocketMessage()` for WebSocket messages
- Use `ctx.storage` for persistent state and `broadcast()` to send messages to all connected clients

### Tailwind CSS
- Use utility classes for styling
- Combine colors with opacity modifiers (e.g., `bg-slate-900/80`)
- Use responsive prefixes (e.g., `md:`, `lg:`) when needed
- Group related classes logically

### Styling Components
- Extract common UI patterns into separate components
- Use conditional class rendering with `clsx` or template literals:
```typescript
className={`px-4 py-2 ${isActive ? 'bg-indigo-600' : 'bg-slate-800'}`}
```

### React Patterns
- Use `useRef` for WebSocket connections to avoid re-initialization
- Clean up effects properly (close WebSocket connections in return)
- Use `useCallback` for event handlers passed to child components
- Example:
```typescript
useEffect(() => {
  ws.current = new WebSocket(url);
  ws.current.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'update') setGame(new Chess(data.fen));
  };
  return () => ws.current?.close();
}, [gameId]);
```

### API Response Format
- Backend responses should include CORS headers:
```typescript
headers: {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*"
}
```

### Code Organization
- Frontend: Use Next.js App Router structure (`app/` directory)
- Backend: Single entry point (`src/index.ts`) with Durable Object classes
- Separate concerns: components, hooks, utilities, types

### Security
- Never commit secrets to git (API keys, database credentials)
- Store secrets in Cloudflare Workers secrets or `.dev.vars` for local dev
- Validate all user input on the backend
- Use environment-specific configurations

## Architecture Notes

### Frontend Stack
- Next.js 16.1.2 with App Router
- React 19
- TypeScript 5
- Tailwind CSS 4
- chess.js for game logic
- react-chessboard for UI
- Cloudflare RealtimeKit for video calls

### Backend Stack
- Cloudflare Workers
- Durable Objects for stateful coordination
- WebSocket support for real-time updates
- Cloudflare Calls API for video meetings
- D1 database for persistence

### Key Integration Points
- Frontend connects to backend via WebSocket at `ws://localhost:8787/api/game/[gameId]/ws`
- Video tokens fetched from `/api/game/[gameId]/call` endpoint
- Game state stored in Durable Object `fen` key
- Matching queue at `/api/queue/join`
