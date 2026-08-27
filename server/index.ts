import express from "express";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { CARDS } from "../src/shared/types.ts";
import {
  createRoom,
  deleteRoom,
  findByResumeToken,
  getRoom,
  joinRoom,
  leaveRoom,
  ROOM_ID,
  toState,
} from "./rooms.ts";

const PORT = Number(process.env.PORT) || 3001;
const LEAVE_GRACE_MS = 30_000;
const EMPTY_ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const CREATE_WINDOW_MS = 10 * 60 * 1000;
const CREATE_MAX = 20;
const RESUME_TOKEN = /^[A-Za-z0-9_-]{8,32}$/;
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://meet.google.com https://*.meet.google.com https://*.google.com",
  );
  next();
});

const createHits = new Map<string, number[]>();

function clientIp(req: express.Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function tooManyCreates(ip: string): boolean {
  const now = Date.now();
  const recent = (createHits.get(ip) ?? []).filter((time) => now - time < CREATE_WINDOW_MS);
  if (recent.length >= CREATE_MAX) {
    createHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  createHits.set(ip, recent);
  return false;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/rooms", (req, res) => {
  if (tooManyCreates(clientIp(req))) {
    res.status(429).json({ error: "Too many rooms. Try again later." });
    return;
  }
  const title = String(req.body?.name ?? req.body?.title ?? "").trim().slice(0, 60);
  if (!title) {
    res.status(400).json({ error: "Enter a room name" });
    return;
  }
  const room = createRoom({ title });
  if (!room) {
    res.status(503).json({ error: "Too many rooms" });
    return;
  }
  res.json({ id: room.id, title: room.title });
});

app.get("/api/rooms/:id", (req, res) => {
  const id = String(req.params.id ?? "");
  if (!ROOM_ID.test(id)) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  const room = getRoom(id);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json({ id: room.id, title: room.title });
});

if (process.env.NODE_ENV === "production") {
  const dist = join(__dirname, "../dist");
  app.use(express.static(dist));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
      next();
      return;
    }
    res.sendFile(join(dist, "index.html"));
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });

type Seat = { roomId: string; playerId: string };
const seats = new Map<string, Seat>();
const leaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const emptyTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emitRoom(roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;
  io.to(roomId).emit("room", toState(room));
}

function seatOf(socketId: string): Seat | undefined {
  return seats.get(socketId);
}

function playerStillConnected(playerId: string): boolean {
  for (const seat of seats.values()) {
    if (seat.playerId === playerId) return true;
  }
  return false;
}

function cancelLeave(playerId: string): void {
  const timer = leaveTimers.get(playerId);
  if (!timer) return;
  clearTimeout(timer);
  leaveTimers.delete(playerId);
}

function cancelEmpty(roomId: string): void {
  const timer = emptyTimers.get(roomId);
  if (!timer) return;
  clearTimeout(timer);
  emptyTimers.delete(roomId);
}

function scheduleEmpty(roomId: string): void {
  cancelEmpty(roomId);
  const room = getRoom(roomId);
  if (!room || room.players.size > 0) return;
  const timer = setTimeout(() => {
    emptyTimers.delete(roomId);
    const current = getRoom(roomId);
    if (current && current.players.size === 0) deleteRoom(roomId);
  }, EMPTY_ROOM_TTL_MS);
  emptyTimers.set(roomId, timer);
}

function scheduleLeave(seat: Seat): void {
  cancelLeave(seat.playerId);
  const timer = setTimeout(() => {
    leaveTimers.delete(seat.playerId);
    if (playerStillConnected(seat.playerId)) return;
    leaveRoom(seat.roomId, seat.playerId);
    emitRoom(seat.roomId);
    scheduleEmpty(seat.roomId);
  }, LEAVE_GRACE_MS);
  leaveTimers.set(seat.playerId, timer);
}

io.on("connection", (socket) => {
  socket.on("join", ({ roomId, name, resumeToken }) => {
    const trimmed = String(name ?? "").trim().slice(0, 40);
    const token = String(resumeToken ?? "").trim();
    const id = String(roomId ?? "").trim();
    if (!trimmed) {
      socket.emit("notice", "Enter your name");
      return;
    }
    if (!ROOM_ID.test(id) || !RESUME_TOKEN.test(token)) return;
    const roomExists = getRoom(id);
    if (!roomExists) {
      socket.emit("notice", "Room not found");
      return;
    }
    const previous = findByResumeToken(token);
    if (previous && previous.room.id !== id) {
      cancelLeave(previous.player.id);
      leaveRoom(previous.room.id, previous.player.id);
      emitRoom(previous.room.id);
      scheduleEmpty(previous.room.id);
    }
    cancelEmpty(id);
    const joined = joinRoom(id, token, trimmed);
    if (!joined) {
      socket.emit("notice", "Room not found");
      return;
    }
    cancelLeave(joined.player.id);
    seats.set(socket.id, { roomId: joined.room.id, playerId: joined.player.id });
    void socket.join(joined.room.id);
    socket.emit("self", { id: joined.player.id, vote: joined.player.vote });
    emitRoom(joined.room.id);
  });

  socket.on("topic", (topic) => {
    const seat = seatOf(socket.id);
    if (!seat) return;
    const room = getRoom(seat.roomId);
    if (!room) return;
    room.topic = String(topic ?? "").slice(0, 200);
    emitRoom(room.id);
  });

  socket.on("vote", (value) => {
    const seat = seatOf(socket.id);
    if (!seat) return;
    const room = getRoom(seat.roomId);
    const player = room?.players.get(seat.playerId);
    if (!room || !player || room.revealed) return;
    if (typeof value !== "string" || !CARDS.includes(value as (typeof CARDS)[number])) {
      return;
    }
    player.vote = player.vote === value ? null : value;
    emitRoom(room.id);
  });

  socket.on("reveal", () => {
    const seat = seatOf(socket.id);
    if (!seat) return;
    const room = getRoom(seat.roomId);
    if (!room) return;
    room.revealed = true;
    emitRoom(room.id);
  });

  socket.on("new-round", () => {
    const seat = seatOf(socket.id);
    if (!seat) return;
    const room = getRoom(seat.roomId);
    if (!room) return;
    room.revealed = false;
    for (const player of room.players.values()) player.vote = null;
    emitRoom(room.id);
  });

  socket.on("disconnect", () => {
    const seat = seats.get(socket.id);
    if (!seat) return;
    seats.delete(socket.id);
    scheduleLeave(seat);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Planning poker on http://localhost:${PORT}`);
});
