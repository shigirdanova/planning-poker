import { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { PlayerView, RoomState } from "./shared/types";

const SIGNAL = "wss://demos.yjs.dev";

type Meta = {
  topic: string;
  revealed: boolean;
  round: number;
};

function playerId(): string {
  const existing = sessionStorage.getItem("pp-id");
  if (existing) return existing;
  const id = nanoid(10);
  sessionStorage.setItem("pp-id", id);
  return id;
}

export function useRoomSync(roomId: string, name: string, enabled: boolean) {
  const id = useMemo(() => playerId(), []);
  const voteRef = useRef<string | null>(null);
  const metaRef = useRef<Meta>({ topic: "", revealed: false, round: 0 });
  const yMetaRef = useRef<Y.Map<unknown> | null>(null);
  const awarenessRef = useRef<WebsocketProvider["awareness"] | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "online" | "error">("connecting");

  useEffect(() => {
    if (!enabled || !roomId) return;

    const doc = new Y.Doc();
    const yMeta = doc.getMap("meta");
    const provider = new WebsocketProvider(SIGNAL, `shigirdanova-pp-${roomId}`, doc);
    yMetaRef.current = yMeta;
    awarenessRef.current = provider.awareness;

    function readMeta(): Meta {
      return {
        topic: String(yMeta.get("topic") ?? "").slice(0, 200),
        revealed: Boolean(yMeta.get("revealed")),
        round: Number(yMeta.get("round")) || 0,
      };
    }

    function snapshot(): RoomState {
      const players: PlayerView[] = [];
      provider.awareness.getStates().forEach((state) => {
        const user = state.user as PlayerView | undefined;
        if (!user?.name) return;
        players.push({
          id: String(user.id),
          name: String(user.name).slice(0, 40),
          hasVoted: user.vote != null && user.vote !== "",
          vote: user.vote ?? null,
        });
      });
      return {
        id: roomId,
        topic: metaRef.current.topic,
        revealed: metaRef.current.revealed,
        players,
      };
    }

    function publishLocal(vote: string | null) {
      provider.awareness.setLocalStateField("user", {
        id,
        name,
        vote,
      });
    }

    let seenMeta = false;

    const onMeta = () => {
      const next = readMeta();
      const roundChanged = seenMeta && next.round !== metaRef.current.round;
      seenMeta = true;
      metaRef.current = next;
      if (roundChanged) {
        voteRef.current = null;
        setMyVote(null);
        publishLocal(null);
      }
      setRoom(snapshot());
    };

    const onAwareness = () => setRoom(snapshot());

    provider.on("status", (event: { status: string }) => {
      setStatus(event.status === "connected" ? "online" : "connecting");
    });
    provider.on("connection-error", () => setStatus("error"));

    yMeta.observe(onMeta);
    provider.awareness.on("change", onAwareness);
    publishLocal(voteRef.current);
    metaRef.current = readMeta();
    setRoom(snapshot());

    return () => {
      provider.awareness.setLocalState(null);
      yMeta.unobserve(onMeta);
      provider.destroy();
      doc.destroy();
      yMetaRef.current = null;
      awarenessRef.current = null;
    };
  }, [enabled, id, name, roomId]);

  function writeMeta(patch: Partial<Meta>) {
    const yMeta = yMetaRef.current;
    const next = { ...metaRef.current, ...patch };
    metaRef.current = next;
    yMeta?.set("topic", next.topic);
    yMeta?.set("revealed", next.revealed);
    yMeta?.set("round", next.round);
    setRoom((current) =>
      current
        ? { ...current, topic: next.topic, revealed: next.revealed }
        : { id: roomId, topic: next.topic, revealed: next.revealed, players: [] },
    );
  }

  function publishLocal(vote: string | null) {
    awarenessRef.current?.setLocalStateField("user", { id, name, vote });
  }

  return {
    room,
    myVote,
    status,
    setTopic(topic: string) {
      writeMeta({ topic: topic.slice(0, 200) });
    },
    vote(value: string) {
      const next = voteRef.current === value ? null : value;
      voteRef.current = next;
      setMyVote(next);
      publishLocal(next);
    },
    reveal() {
      writeMeta({ revealed: true });
    },
    newRound() {
      voteRef.current = null;
      setMyVote(null);
      publishLocal(null);
      writeMeta({ revealed: false, round: metaRef.current.round + 1 });
    },
  };
}
