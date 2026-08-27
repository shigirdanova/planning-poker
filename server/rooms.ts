import { nanoid } from "nanoid";
import type { RoomState } from "../src/shared/types.ts";

export const MAX_ROOMS = 200;
export const ROOM_ID = /^[A-Za-z0-9_-]{8,16}$/;

type Player = {
  id: string;
  resumeToken: string;
  name: string;
  vote: string | null;
};

type Room = {
  id: string;
  title: string;
  topic: string;
  revealed: boolean;
  players: Map<string, Player>;
};

const rooms = new Map<string, Room>();

export function createRoom(opts: { title?: string } = {}): Room | undefined {
  if (rooms.size >= MAX_ROOMS) return undefined;
  const room: Room = {
    id: nanoid(8),
    title: (opts.title ?? "").trim().slice(0, 60),
    topic: "",
    revealed: false,
    players: new Map(),
  };
  rooms.set(room.id, room);
  return room;
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

export function deleteRoom(id: string): void {
  rooms.delete(id);
}

export function findByResumeToken(token: string): { room: Room; player: Player } | undefined {
  for (const room of rooms.values()) {
    for (const player of room.players.values()) {
      if (player.resumeToken === token) return { room, player };
    }
  }
  return undefined;
}

export function joinRoom(
  roomId: string,
  resumeToken: string,
  name: string,
): { room: Room; player: Player } | undefined {
  const room = rooms.get(roomId);
  if (!room) return undefined;
  for (const player of room.players.values()) {
    if (player.resumeToken === resumeToken) {
      player.name = name;
      return { room, player };
    }
  }
  const player: Player = {
    id: nanoid(12),
    resumeToken,
    name,
    vote: null,
  };
  room.players.set(player.id, player);
  return { room, player };
}

export function leaveRoom(roomId: string, playerId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  room.players.delete(playerId);
}

export function toState(room: Room): RoomState {
  return {
    id: room.id,
    title: room.title,
    topic: room.topic,
    revealed: room.revealed,
    players: [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      hasVoted: player.vote !== null,
      vote: room.revealed ? player.vote : null,
    })),
  };
}
