// Vyra intercom relay - the same protocol as the Cloudflare Worker, in plain Node (no packages).
//
//   node dev-server.mjs            # listens on port 8787
//   PORT=9000 node dev-server.mjs
//
// Phones connect to ws://<this machine>:8787/room/<roomId>. Every binary frame is passed to the
// other phones in the same room. Good for trying the internet mode at home, on a LAN, from the
// Android emulator (ws://10.0.2.2:8787), or on any small server you own (put it behind TLS for wss://).

import { createServer } from "node:http";
import { createHash } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8787);
const MAX_SOCKETS_PER_ROOM = 20;
const MAX_FRAME_BYTES = 2048;
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/** roomId -> Set of sockets */
const rooms = new Map();

const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("Vyra intercom relay is running.\n");
});

server.on("upgrade", (req, socket) => {
  const match = /^\/room\/([0-9a-f]{16,64})(?:\?.*)?$/.exec(req.url ?? "");
  const key = req.headers["sec-websocket-key"];
  if (!match || !key) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return;
  }
  const roomId = match[1];
  const room = rooms.get(roomId) ?? new Set();
  if (room.size >= MAX_SOCKETS_PER_ROOM) {
    socket.end("HTTP/1.1 503 Room Full\r\n\r\n");
    return;
  }
  const accept = createHash("sha1").update(key + GUID).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  socket.setNoDelay(true);
  room.add(socket);
  rooms.set(roomId, room);
  log(`+ ${roomId.slice(0, 8)} (${room.size} in room)`);

  let buffer = Buffer.alloc(0);
  let fragments = [];

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const frame = readFrame(buffer);
      if (!frame) break;
      buffer = buffer.subarray(frame.length);
      if (frame.opcode === 0x8) { // close
        socket.end(encodeFrame(0x8, Buffer.alloc(0)));
        return;
      }
      if (frame.opcode === 0x9) { // ping -> pong
        socket.write(encodeFrame(0xa, frame.payload));
        continue;
      }
      if (frame.opcode === 0xa) continue; // pong
      if (frame.opcode === 0x2 || frame.opcode === 0x0) {
        fragments.push(frame.payload);
        if (!frame.fin) continue;
        const message = Buffer.concat(fragments);
        fragments = [];
        if (message.length > MAX_FRAME_BYTES) continue;
        const out = encodeFrame(0x2, message);
        for (const peer of room) if (peer !== socket && !peer.destroyed) peer.write(out);
      }
      // Text frames are ignored: the intercom only speaks binary.
    }
  });

  const leave = () => {
    if (!room.delete(socket)) return;
    if (room.size === 0) rooms.delete(roomId);
    log(`- ${roomId.slice(0, 8)} (${room.size} in room)`);
  };
  socket.on("close", leave);
  socket.on("error", leave);
});

/** One frame from the start of buf, or null if it isn't all there yet. Client frames are masked. */
function readFrame(buf) {
  if (buf.length < 2) return null;
  const fin = (buf[0] & 0x80) !== 0;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let length = buf[1] & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buf.length < 4) return null;
    length = buf.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buf.length < 10) return null;
    length = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  const maskOffset = offset;
  if (masked) offset += 4;
  if (buf.length < offset + length) return null;
  const payload = Buffer.from(buf.subarray(offset, offset + length));
  if (masked) {
    const mask = buf.subarray(maskOffset, maskOffset + 4);
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
  }
  return { fin, opcode, payload, length: offset + length };
}

/** A server frame: never masked. */
function encodeFrame(opcode, payload) {
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.from([0x80 | opcode, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

function log(message) {
  console.log(`${new Date().toISOString()} ${message}`);
}

server.listen(PORT, () => log(`Vyra intercom relay listening on :${PORT}`));
