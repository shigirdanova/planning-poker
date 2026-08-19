import { nanoid } from "nanoid";
import { consensus } from "../src/shared/consensus.ts";
import type { LinkedIssue, RoomState } from "../src/shared/types.ts";
import { linearConfigured } from "./linear.ts";

type Player = {
  id: string;
  name: string;
  vote: string | null;
};

type Room = {
  id: string;
  title: string;
  topic: string;
  revealed: boolean;
  players: Map<string, Player>;
  issue: LinkedIssue | null;
};

const rooms = new Map<string, Room>();

export function createRoom(opts: { id?: string; title?: string } = {}): Room {
  const id = opts.id ?? nanoid(8);
  const room: Room = {
    id,
    title: (opts.title ?? "").trim().slice(0, 60),
    topic: "",
    revealed: false,
    players: new Map(),
    issue: null,
  };
  rooms.set(id, room);
  return room;
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

export function joinRoom(roomId: string, playerId: string, name: string): Room {
  const room = rooms.get(roomId) ?? createRoom({ id: roomId });
  room.players.set(playerId, { id: playerId, name, vote: null });
  return room;
}

export function leaveRoom(roomId: string, playerId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  room.players.delete(playerId);
  if (room.players.size === 0) rooms.delete(roomId);
}

export function findRoomByPlayer(playerId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.has(playerId)) return room;
  }
  return undefined;
}

export function everyoneVoted(room: Room): boolean {
  if (room.players.size === 0) return false;
  return [...room.players.values()].every((player) => player.vote !== null);
}

export function roomConsensus(room: Room): number | null {
  return consensus([...room.players.values()].map((player) => player.vote));
}

export function toState(room: Room): RoomState {
  return {
    id: room.id,
    title: room.title,
    topic: room.topic,
    revealed: room.revealed,
    issue: room.issue,
    linearReady: linearConfigured(),
    players: [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      hasVoted: player.vote !== null,
      vote: room.revealed ? player.vote : null,
    })),
  };
}
