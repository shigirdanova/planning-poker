import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getStoredName, setStoredName } from "../identity";
import { consensus } from "../shared/consensus";
import { CARDS } from "../shared/types";
import type { RoomState } from "../shared/types";
import { roomShareUrl } from "../share";
import { playRevealSound } from "../sound";
import { useRoomSync } from "../sync";

function result(room: RoomState) {
  const nums = room.players
    .map((player) => player.vote)
    .filter((value): value is string => value !== null && /^\d+$/.test(value))
    .map(Number);
  const majority = consensus(room.players.map((player) => player.vote));
  const order = new Map<string, number>(CARDS.map((card, index) => [card, index]));
  const totals = new Map<string, number>();
  for (const player of room.players) {
    if (player.vote == null) continue;
    totals.set(player.vote, (totals.get(player.vote) ?? 0) + 1);
  }
  const counts = [...totals.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (order.get(a.value) ?? 99) - (order.get(b.value) ?? 99));
  return {
    majority,
    counts,
    spread: nums.length === 0 ? null : { min: Math.min(...nums), max: Math.max(...nums) },
  };
}

export default function Room() {
  const { roomId = "" } = useParams();
  const [params] = useSearchParams();
  const panel = params.get("panel") === "1";
  const [name, setName] = useState(() => getStoredName());
  const [roomTitle, setRoomTitle] = useState("");
  const [joined, setJoined] = useState(() => Boolean(getStoredName()));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const sync = useRoomSync(roomId, name.trim(), joined);
  const seenRoom = useRef(false);
  const wasRevealed = useRef(false);

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

  useEffect(() => {
    if (!sync.room) return;
    if (seenRoom.current && sync.room.revealed && !wasRevealed.current) {
      playRevealSound();
    }
    seenRoom.current = true;
    wasRevealed.current = sync.room.revealed;
  }, [sync.room]);

  const heading = sync.room?.title || roomTitle || "Planning poker";
  const summary = useMemo(
    () => (sync.room?.revealed ? result(sync.room) : null),
    [sync.room],
  );
  const votedCount = sync.room?.players.filter((player) => player.hasVoted).length ?? 0;
  const playerCount = sync.room?.players.length ?? 0;
  const everyoneVoted = playerCount > 0 && votedCount === playerCount;
  const [editingName, setEditingName] = useState<string | null>(null);

  useEffect(() => {
    if (!sync.kicked) return;
    setJoined(false);
    setError("You were removed from the room");
  }, [sync.kicked]);

  function join() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your name");
      return;
    }
    setStoredName(trimmed);
    setName(trimmed);
    setJoined(true);
    setError("");
  }

  function saveName() {
    const trimmed = (editingName ?? "").trim();
    if (!trimmed) {
      setEditingName(null);
      return;
    }
    setStoredName(trimmed);
    sync.rename(trimmed);
    setEditingName(null);
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

      {summary ? (
        <section className="result" aria-live="polite">
          <div className="final">
            <p className="final-label">Final estimate</p>
            <p className={summary.majority != null ? "final-value popular" : "final-value"}>
              {summary.majority ?? "—"}
            </p>
            <p className="final-hint">
              {summary.majority != null
                ? "Most common vote"
                : "No majority. Discuss, then vote again."}
            </p>
            {summary.spread && summary.spread.min !== summary.spread.max ? (
              <p className="final-range">
                Range {summary.spread.min}–{summary.spread.max}
              </p>
            ) : null}
          </div>
          {summary.counts.length > 0 ? (
            <ul className="counts">
              {summary.counts.map((item) => {
                const popular = item.value === String(summary.majority);
                return (
                  <li className={popular ? "count popular" : "count"} key={item.value}>
                    <span className="count-card">{item.value}</span>
                    <span className="count-n">
                      {item.count} {item.count === 1 ? "vote" : "votes"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : (
        <p className="meta">
          {votedCount}/{playerCount} voted
          {everyoneVoted ? " · everyone is in — press Show votes" : ""}
        </p>
      )}

      <div className="players">
        {(sync.room?.players ?? []).map((player) => {
          const mine = player.id === sync.myId;
          const editing = mine && editingName !== null;
          return (
            <div className={mine ? "player mine" : "player"} key={player.id}>
              {sync.room?.revealed ? (
                <div className="chip">{player.vote ?? "—"}</div>
              ) : player.hasVoted ? (
                <div className="chip back" aria-label="Voted" />
              ) : (
                <div className="chip empty" aria-label="Waiting" />
              )}
              <div className="player-info">
                {editing ? (
                  <input
                    type="text"
                    value={editingName}
                    maxLength={40}
                    autoFocus
                    aria-label="Your name"
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") setEditingName(null);
                    }}
                  />
                ) : (
                  <strong>
                    {player.name}
                    {mine ? <span className="you">You</span> : null}
                  </strong>
                )}
                <div className="player-actions">
                  {mine ? (
                    <button
                      type="button"
                      className="text"
                      onClick={() => setEditingName(player.name)}
                    >
                      Rename
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text"
                    onClick={() => sync.removePlayer(player.id)}
                  >
                    {mine ? "Leave" : "Remove"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="actions">
        {sync.room?.revealed ? null : (
          <button
            type="button"
            className="show-votes"
            onClick={() => sync.reveal()}
            disabled={!sync.room || votedCount === 0}
          >
            Show votes
          </button>
        )}
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
