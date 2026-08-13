import mqtt from "mqtt";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerView, RoomState } from "../shared/types";

const BROKER = "wss://broker.emqx.io:8084/mqtt";
const PREFIX = "shigirdanova/planning-poker";

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
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const voteRef = useRef<string | null>(null);
  const metaRef = useRef<Meta>({ topic: "", revealed: false, round: 0 });
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "online" | "error">("connecting");

  useEffect(() => {
    if (!enabled) return;

    const players = new Map<string, PlayerView>();
    const base = `${PREFIX}/${roomId}`;
    const playerTopic = `${base}/player/${id}`;
    const metaTopic = `${base}/meta`;
    let seenMeta = false;

    function snapshot(): RoomState {
      return {
        id: roomId,
        topic: metaRef.current.topic,
        revealed: metaRef.current.revealed,
        players: [...players.values()],
      };
    }

    function publishPlayer(vote: string | null) {
      const payload: PlayerView = {
        id,
        name,
        hasVoted: vote !== null,
        vote,
      };
      client.publish(playerTopic, JSON.stringify(payload), { retain: true, qos: 0 });
    }

    const client = mqtt.connect(BROKER, {
      clientId: `pp-${id}`,
      clean: true,
      reconnectPeriod: 2000,
      will: {
        topic: playerTopic,
        payload: "",
        retain: true,
        qos: 0,
      },
    });
    clientRef.current = client;

    client.on("connect", () => {
      setStatus("online");
      client.subscribe(`${base}/#`, (err) => {
        if (err) setStatus("error");
      });
      publishPlayer(voteRef.current);
    });
    client.on("reconnect", () => setStatus("connecting"));
    client.on("error", () => setStatus("error"));

    client.on("message", (topic, payload) => {
      const text = payload.toString();
      if (topic === metaTopic) {
        if (!text) return;
        try {
          const meta = JSON.parse(text) as Meta;
          const round = Number(meta.round) || 0;
          const roundChanged = seenMeta && round !== metaRef.current.round;
          seenMeta = true;
          metaRef.current = {
            topic: String(meta.topic ?? "").slice(0, 200),
            revealed: Boolean(meta.revealed),
            round,
          };
          if (roundChanged) {
            voteRef.current = null;
            setMyVote(null);
            publishPlayer(null);
          }
          setRoom(snapshot());
        } catch {
          /* ignore malformed */
        }
        return;
      }
      if (!topic.startsWith(`${base}/player/`)) return;
      const otherId = topic.slice(`${base}/player/`.length);
      if (!text) {
        players.delete(otherId);
        setRoom(snapshot());
        return;
      }
      try {
        const player = JSON.parse(text) as PlayerView;
        players.set(otherId, {
          id: otherId,
          name: String(player.name ?? "Игрок").slice(0, 40),
          hasVoted: Boolean(player.hasVoted || player.vote),
          vote: player.vote ?? null,
        });
        setRoom(snapshot());
      } catch {
        /* ignore malformed */
      }
    });

    const onLeave = () => {
      client.publish(playerTopic, "", { retain: true, qos: 0 });
    };
    window.addEventListener("pagehide", onLeave);

    return () => {
      window.removeEventListener("pagehide", onLeave);
      onLeave();
      client.end(true);
      clientRef.current = null;
    };
  }, [enabled, id, name, roomId]);

  function publishMeta(meta: Meta) {
    metaRef.current = meta;
    clientRef.current?.publish(
      `${PREFIX}/${roomId}/meta`,
      JSON.stringify(meta),
      { retain: true, qos: 0 },
    );
    setRoom((current) =>
      current
        ? { ...current, topic: meta.topic, revealed: meta.revealed }
        : { id: roomId, topic: meta.topic, revealed: meta.revealed, players: [] },
    );
  }

  return {
    room,
    myVote,
    status,
    setTopic(topic: string) {
      publishMeta({ ...metaRef.current, topic: topic.slice(0, 200) });
    },
    vote(value: string) {
      const next = voteRef.current === value ? null : value;
      voteRef.current = next;
      setMyVote(next);
      const payload: PlayerView = {
        id,
        name,
        hasVoted: next !== null,
        vote: next,
      };
      clientRef.current?.publish(
        `${PREFIX}/${roomId}/player/${id}`,
        JSON.stringify(payload),
        { retain: true, qos: 0 },
      );
    },
    reveal() {
      publishMeta({ ...metaRef.current, revealed: true });
    },
    newRound() {
      voteRef.current = null;
      setMyVote(null);
      publishMeta({
        ...metaRef.current,
        revealed: false,
        round: metaRef.current.round + 1,
      });
      const payload: PlayerView = { id, name, hasVoted: false, vote: null };
      clientRef.current?.publish(
        `${PREFIX}/${roomId}/player/${id}`,
        JSON.stringify(payload),
        { retain: true, qos: 0 },
      );
    },
  };
}
