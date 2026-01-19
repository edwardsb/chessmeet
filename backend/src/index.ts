import { DurableObject } from "cloudflare:workers";
import { Chess } from "chess.js";

export interface Env {
  GAMES: DurableObjectNamespace;
  QUEUE: DurableObjectNamespace;
  DB: D1Database;
  CALLS_APP_ID: string;
  CALLS_APP_SECRET: string;
}

const CLOUDFLARE_ACCOUNT_ID = "19c8655706eb4fc4f475a3c41961fc07";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Enable CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Helper to add CORS headers to response
    const addCorsHeaders = (response: Response): Response => {
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    };

    if (url.pathname === "/api/queue/join") {
      const id = env.QUEUE.idFromName("GLOBAL_QUEUE");
      const stub = env.QUEUE.get(id);
      const response = await stub.fetch(request);
      return addCorsHeaders(response);
    }

    if (url.pathname.startsWith("/api/game/")) {
      const pathParts = url.pathname.split("/");
      const gameId = pathParts[3];
      if (!gameId) return new Response("Missing Game ID", { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });

      const id = env.GAMES.idFromName(gameId);
      const stub = env.GAMES.get(id);
      const response = await stub.fetch(request);
      // Don't add CORS to WebSocket upgrade responses
      if (response.status === 101) return response;
      return addCorsHeaders(response);
    }

    return new Response("ChessMeet API Ready", { status: 200, headers: { "Access-Control-Allow-Origin": "*" } });
  },
};

// --- DURABLE OBJECTS ---

export class GameRoom extends DurableObject {
  // @ts-ignore
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // REAL VIDEO CALL SIGNALING
    if (url.pathname.endsWith("/call") && request.method === "POST") {
      try {
        let meetingId = await this.ctx.storage.get<string>("meetingId");

        // 1. Create Meeting if it doesn't exist
        if (!meetingId) {
          const createMeetingRes = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/realtime/kit/${this.env.CALLS_APP_ID}/meetings`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${this.env.CALLS_APP_SECRET}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ 
                title: `Chess Game ${this.ctx.id.toString()}`,
                waiting_room_enabled: false  // Disable waiting room so participants can join directly
              })
            }
          );

          const meetingData = await createMeetingRes.json() as any;
          console.log("Create Meeting Response:", JSON.stringify(meetingData)); // LOGGING

          if (!createMeetingRes.ok || !meetingData.data) { // CHANGED: .result -> .data
            const errorMsg = meetingData.errors?.[0]?.message || JSON.stringify(meetingData);
            throw new Error(`Failed to create meeting: ${errorMsg}`);
          }
          meetingId = meetingData.data.id;
          await this.ctx.storage.put("meetingId", meetingId);
        }

        // 2. Add Participant to get token using skip_waiting preset
        const addParticipantRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/realtime/kit/${this.env.CALLS_APP_ID}/meetings/${meetingId}/participants`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${this.env.CALLS_APP_SECRET}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              name: "Player",
              preset_name: "skip_waiting",
              client_specific_id: crypto.randomUUID()
            })
          }
        );

        const participantData = await addParticipantRes.json() as any;
        console.log("Add Participant Response:", JSON.stringify(participantData)); // LOGGING

        if (!addParticipantRes.ok || !participantData.data) { // CHANGED: .result -> .data
           const errorMsg = participantData.errors?.[0]?.message || JSON.stringify(participantData);
           throw new Error(`Failed to add participant: ${errorMsg}`);
        }

        console.log(`Returning token for meetingId: ${meetingId}`);
        return new Response(JSON.stringify({
          authToken: participantData.data.token, // CHANGED: .authToken -> .token
          appId: this.env.CALLS_APP_ID,
          meetingId: meetingId // Include for debugging
        }), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" 
          }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    if (url.pathname.endsWith("/ws")) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }

      const { 0: client, 1: server } = new WebSocketPair();
      
      const storedFen = await this.ctx.storage.get<string>("fen");
      if (!storedFen) {
        await this.ctx.storage.put("fen", new Chess().fen());
      }

      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Game Room Active");
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const data = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    
    const currentFen = (await this.ctx.storage.get<string>("fen")) || new Chess().fen();
    const chess = new Chess(currentFen);

    if (data.type === "move") {
      try {
        const move = chess.move(data.move);
        if (move) {
          const newFen = chess.fen();
          await this.ctx.storage.put("fen", newFen);
          
          this.broadcast(JSON.stringify({
            type: "update",
            fen: newFen,
            lastMove: data.move
          }));
        }
      } catch (e) {}
    } else if (data.type === "reset") {
        const newGame = new Chess();
        await this.ctx.storage.put("fen", newGame.fen());
        this.broadcast(JSON.stringify({ type: "update", fen: newGame.fen() }));
    }
  }

  broadcast(msg: string) {
    this.ctx.getWebSockets().forEach((ws) => {
      try { ws.send(msg); } catch(e) {}
    });
  }
}

export class MatchingQueue extends DurableObject {
  // @ts-ignore
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  async fetch(request: Request): Promise<Response> {
    const waitingPlayer = await this.ctx.storage.get<{ playerId: string }>("waiting");
    const body = await request.json() as { playerId: string };
    const incomingPlayerId = body.playerId || crypto.randomUUID();

    if (waitingPlayer) {
      if (waitingPlayer.playerId === incomingPlayerId) {
          return new Response(JSON.stringify({ status: "waiting" }));
      }

      const gameId = crypto.randomUUID();
      await this.ctx.storage.delete("waiting");

      return new Response(JSON.stringify({
        status: "matched",
        gameId: gameId,
        color: "black",
        opponentId: waitingPlayer.playerId
      }), { headers: { "Content-Type": "application/json" }});
    } else {
      await this.ctx.storage.put("waiting", { playerId: incomingPlayerId });
      return new Response(JSON.stringify({
        status: "waiting",
        gameId: crypto.randomUUID(),
        color: "white" 
      }), { headers: { "Content-Type": "application/json" }});
    }
  }
}