import { nanoid } from "nanoid";
import type { RoomState } from "../src/shared/types.ts";

type Player = {
  id: string;
  name: string;
  vote: string | null;
};

type Room = {
  id: string;
  topic: string;
  revealed: boolean;
  players: Map<string, Player>;
};

const rooms = new Map<string, Room>();

export function createRoom(id = nanoid(8)): Room {
  const room: Room = {
    id,
    topic: "",
    revealed: false,
    players: new Map(),
  };
  rooms.set(id, room);
  return room;
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

export function joinRoom(roomId: string, playerId: string, name: string): Room {
  const room = rooms.get(roomId) ?? createRoom(roomId);
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

export function toState(room: Room): RoomState {
  return {
    id: room.id,
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
