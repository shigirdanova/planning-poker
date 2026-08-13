import express from "express";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { linearConfigured, lookupIssue, saveEstimate } from "./linear.ts";
import {
  createRoom,
  everyoneVoted,
  findRoomByPlayer,
  getRoom,
  joinRoom,
  leaveRoom,
  roomConsensus,
  toState,
} from "./rooms.ts";

const PORT = Number(process.env.PORT) || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://meet.google.com https://*.meet.google.com https://*.google.com",
  );
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/linear/status", (_req, res) => {
  res.json({ configured: linearConfigured() });
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

function resetVotes(roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;
  room.revealed = false;
  for (const player of room.players.values()) player.vote = null;
}

io.on("connection", (socket) => {
  socket.on("join", ({ roomId, name }: { roomId: string; name: string }) => {
    const trimmed = (name ?? "").trim().slice(0, 40);
    if (!trimmed) {
      socket.emit("notice", "Enter your name");
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
    if (everyoneVoted(room)) room.revealed = true;
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
    resetVotes(room.id);
    emitRoom(room.id);
  });

  socket.on("pull-linear", async (query: string) => {
    const room = findRoomByPlayer(socket.id);
    if (!room) return;
    try {
      const issue = await lookupIssue(String(query ?? ""));
      room.issue = { ...issue, savedEstimate: null };
      room.topic = `${issue.identifier} · ${issue.title}`.slice(0, 200);
      resetVotes(room.id);
      emitRoom(room.id);
    } catch (err) {
      socket.emit("notice", err instanceof Error ? err.message : "Could not load Linear issue");
    }
  });

  socket.on("save-linear", async () => {
    const room = findRoomByPlayer(socket.id);
    if (!room?.issue || !room.revealed) return;
    const estimate = roomConsensus(room);
    if (estimate === null) {
      socket.emit("notice", "Need a numeric vote to save");
      return;
    }
    try {
      await saveEstimate(room.issue.issueId, estimate);
      room.issue = { ...room.issue, savedEstimate: estimate };
      emitRoom(room.id);
    } catch (err) {
      socket.emit("notice", err instanceof Error ? err.message : "Could not save to Linear");
    }
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
