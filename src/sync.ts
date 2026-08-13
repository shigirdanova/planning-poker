import { io, type Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";
import type { RoomState } from "./shared/types";

export function useRoomSync(roomId: string, name: string, enabled: boolean) {
  const socketRef = useRef<Socket | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "online" | "error">("connecting");

  useEffect(() => {
    if (!enabled || !roomId) return;

    const socket = io({ autoConnect: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("online");
      socket.emit("join", { roomId, name });
    });
    socket.on("disconnect", () => setStatus("connecting"));
    socket.on("connect_error", () => setStatus("error"));
    socket.on("room", (state: RoomState) => {
      setRoom(state);
      const me = state.players.find((player) => player.id === socket.id);
      if (state.revealed) return;
      if (!me?.hasVoted) setMyVote(null);
    });
    socket.on("error", () => setStatus("error"));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, name, roomId]);

  return {
    room,
    myVote,
    status,
    setTopic(topic: string) {
      socketRef.current?.emit("topic", topic);
    },
    vote(value: string) {
      const next = myVote === value ? null : value;
      setMyVote(next);
      socketRef.current?.emit("vote", value);
    },
    reveal() {
      socketRef.current?.emit("reveal");
    },
    newRound() {
      setMyVote(null);
      socketRef.current?.emit("new-round");
    },
  };
}
