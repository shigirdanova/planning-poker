import { io, type Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";
import { getResumeToken } from "./identity";
import type { RoomState } from "./shared/types";

export function useRoomSync(roomId: string, name: string, enabled: boolean) {
  const socketRef = useRef<Socket | null>(null);
  const myIdRef = useRef<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const [status, setStatus] = useState<"connecting" | "online" | "error">("connecting");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!enabled || !roomId) return;

    const resumeToken = getResumeToken();
    const socket = io({ autoConnect: true });
    socketRef.current = socket;
    myIdRef.current = null;
    setMyId(null);
    setKicked(false);

    socket.on("connect", () => {
      setStatus("online");
      socket.emit("join", { roomId, name, resumeToken });
    });
    socket.on("disconnect", () => setStatus("connecting"));
    socket.on("connect_error", () => setStatus("error"));
    socket.on("notice", (message: string) => setNotice(message));
    socket.on("self", ({ id, vote }: { id: string; vote: string | null }) => {
      myIdRef.current = id;
      setMyId(id);
      setMyVote(vote);
    });
    socket.on("kicked", () => {
      myIdRef.current = null;
      setMyId(null);
      setRoom(null);
      setMyVote(null);
      setKicked(true);
    });
    socket.on("room", (state: RoomState) => {
      setNotice("");
      setRoom(state);
      const me = state.players.find((player) => player.id === myIdRef.current);
      if (!me) return;
      if (state.revealed) {
        if (me.vote) setMyVote(me.vote);
        return;
      }
      if (!me.hasVoted) setMyVote(null);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, name, roomId]);

  return {
    room,
    myId,
    myVote,
    status,
    notice,
    kicked,
    setTopic(topic: string) {
      socketRef.current?.emit("topic", topic);
    },
    vote(value: string) {
      setMyVote((current) => (current === value ? null : value));
      socketRef.current?.emit("vote", value);
    },
    reveal() {
      socketRef.current?.emit("reveal");
    },
    newRound() {
      setMyVote(null);
      socketRef.current?.emit("new-round");
    },
    rename(next: string) {
      socketRef.current?.emit("rename", next);
    },
    removePlayer(playerId: string) {
      socketRef.current?.emit("remove-player", playerId);
    },
  };
}
