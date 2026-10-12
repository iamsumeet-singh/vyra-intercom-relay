/**
 * Vyra ride-intercom relay.
 *
 * Phones connect to wss://<this worker>/room/<roomId>; every binary frame one phone sends is passed
 * to every other phone in the same room. That's all it does:
 *  - the room id is a hash of the group code, so the server never learns the code;
 *  - the frames are AES-GCM sealed with a key made from the code, so the server can't listen in.
 *
 * One Durable Object per room keeps its sockets together. The WebSocket Hibernation API means a
 * quiet room costs nothing while nobody talks.
 */

export interface Env {
  ROOMS: DurableObjectNamespace;
}

/** A riding group is small; this stops a leaked room id being used as a free broadcast service. */
const MAX_SOCKETS_PER_ROOM = 20;
/** Voice packets are ~200 bytes, announces less. */
const MAX_FRAME_BYTES = 2048;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/room\/([0-9a-f]{16,64})$/);
    if (!match) {
      return new Response("Vyra intercom relay is running.\n", { status: 200 });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    const room = env.ROOMS.get(env.ROOMS.idFromName(match[1]));
    return room.fetch(request);
  },
};

export class IntercomRoom {
  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    if (this.state.getWebSockets().length >= MAX_SOCKETS_PER_ROOM) {
      return new Response("Room full", { status: 503 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    if (typeof message === "string" || message.byteLength > MAX_FRAME_BYTES) return;
    for (const peer of this.state.getWebSockets()) {
      if (peer === ws) continue;
      try {
        peer.send(message);
      } catch {
        // A socket that's going away; the runtime closes it.
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, "error");
    } catch {
      // Already closed.
    }
  }
}
