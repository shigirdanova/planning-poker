import express from "express";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import {
  createRoom,
  findRoomByPlayer,
  getRoom,
  joinRoom,
  leaveRoom,
  toState,
} from "./rooms.ts";

const PORT = Number(process.env.PORT) || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/rooms", (_req, res) => {
  const room = createRoom();
  res.json({ id: room.id });
});

app.get("/api/rooms/:id", (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json({ id: room.id });
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

function emitRoom(roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;
  io.to(roomId).emit("room", toState(room));
}

io.on("connection", (socket) => {
  socket.on("join", ({ roomId, name }: { roomId: string; name: string }) => {
    const trimmed = (name ?? "").trim().slice(0, 40);
    if (!trimmed) {
      socket.emit("error", "Enter your name");
      return;
    }
    const room = joinRoom(roomId, socket.id, trimmed);
    socket.join(room.id);
    emitRoom(room.id);
  });

  socket.on("topic", (topic: string) => {
    const room = findRoomByPlayer(socket.id);
    if (!room) return;
    room.topic = String(topic ?? "").slice(0, 200);
    emitRoom(room.id);
  });

  socket.on("vote", (value: string) => {
    const room = findRoomByPlayer(socket.id);
    if (!room || room.revealed) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    player.vote = player.vote === value ? null : String(value).slice(0, 8);
    emitRoom(room.id);
  });

  socket.on("reveal", () => {
    const room = findRoomByPlayer(socket.id);
    if (!room) return;
    room.revealed = true;
    emitRoom(room.id);
  });

  socket.on("new-round", () => {
    const room = findRoomByPlayer(socket.id);
    if (!room) return;
    room.revealed = false;
    for (const player of room.players.values()) player.vote = null;
    emitRoom(room.id);
  });

  socket.on("disconnect", () => {
    const room = findRoomByPlayer(socket.id);
    if (!room) return;
    leaveRoom(room.id, socket.id);
    emitRoom(room.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Planning poker on http://localhost:${PORT}`);
});
