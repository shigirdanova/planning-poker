import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { consensus } from "../shared/consensus";
import { CARDS } from "../shared/types";
import type { RoomState } from "../shared/types";
import { roomShareUrl } from "../share";
import { useRoomSync } from "../sync";

function stats(room: RoomState) {
  const nums = room.players
    .map((p) => p.vote)
    .filter((v): v is string => v !== null && /^\d+$/.test(v))
    .map(Number);
  if (nums.length === 0) return null;
  const majority = consensus(room.players.map((p) => p.vote));
  return {
    majority,
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}

export default function Room() {
  const { roomId = "" } = useParams();
  const [params] = useSearchParams();
  const panel = params.get("panel") === "1";
  const [name, setName] = useState(() => sessionStorage.getItem("pp-name") ?? "");
  const [roomTitle, setRoomTitle] = useState("");
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const sync = useRoomSync(roomId, name.trim(), joined);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/rooms/${roomId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { title?: string } | null) => {
        if (!cancelled && data?.title) setRoomTitle(data.title);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const heading = sync.room?.title || roomTitle || "Planning poker";
  const summary = useMemo(
    () => (sync.room?.revealed ? stats(sync.room) : null),
    [sync.room],
  );
  const votedCount = sync.room?.players.filter((p) => p.hasVoted).length ?? 0;

  function join() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your name");
      return;
    }
    sessionStorage.setItem("pp-name", trimmed);
    setJoined(true);
    setError("");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(roomShareUrl(roomId));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (!joined) {
    return (
      <div className={panel ? "shell name-gate panel" : "shell name-gate"}>
        <p className="brand">{heading}</p>
        <h1>Your name</h1>
        <div className="panel-box">
          <div className="row">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              maxLength={40}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") join();
              }}
            />
            <button type="button" onClick={join}>
              Join
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={panel ? "shell panel" : "shell"}>
      <div className="toolbar">
        <div className="nav">
          <p className="brand">{heading}</p>
          {!panel ? <Link to="/">New room</Link> : null}
        </div>
        <div className="row">
          <button type="button" className="secondary" onClick={() => void copyLink()}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>

      <input
        className="topic"
        type="text"
        placeholder="What are we estimating?"
        value={sync.room?.topic ?? ""}
        maxLength={200}
        onChange={(e) => sync.setTopic(e.target.value)}
      />

      {sync.status !== "online" ? <p className="hint">Connecting…</p> : null}
      {sync.notice ? <p className="error">{sync.notice}</p> : null}

      <div className="meta">
        {summary ? (
          <>
            <span>
              Majority{" "}
              <b>{summary.majority ?? "none"}</b>
            </span>
            <span>
              Spread{" "}
              <b>
                {summary.min}–{summary.max}
              </b>
            </span>
          </>
        ) : (
          <span>
            {votedCount}/{sync.room?.players.length ?? 0} voted
            {sync.status === "online" ? " · live" : ""}
          </span>
        )}
      </div>

      <div className="players">
        {(sync.room?.players ?? []).map((player) => (
          <div className="player" key={player.id}>
            {sync.room?.revealed ? (
              <div className="chip">{player.vote ?? "—"}</div>
            ) : player.hasVoted ? (
              <div className="chip back" aria-label="Voted" />
            ) : (
              <div className="chip empty" aria-label="Waiting" />
            )}
            <strong>{player.name}</strong>
          </div>
        ))}
      </div>

      <div className="actions">
        <button
          type="button"
          onClick={() => sync.reveal()}
          disabled={!sync.room || sync.room.revealed || votedCount === 0}
        >
          Reveal
        </button>
        <button type="button" className="secondary" onClick={() => sync.newRound()}>
          Next round
        </button>
      </div>

      <div className="cards">
        {CARDS.map((card) => (
          <button
            key={card}
            type="button"
            className={sync.myVote === card ? "card selected" : "card"}
            disabled={sync.room?.revealed}
            onClick={() => sync.vote(card)}
          >
            {card}
          </button>
        ))}
      </div>
    </div>
  );
}
