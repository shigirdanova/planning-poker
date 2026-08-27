import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getStoredName, setStoredName } from "../identity";
import { consensus } from "../shared/consensus";
import { CARDS } from "../shared/types";
import type { RoomState } from "../shared/types";
import { roomShareUrl } from "../share";
import { playRevealSound } from "../sound";
import { useRoomSync } from "../sync";

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.4 2.6a1.2 1.2 0 0 1 1.7 1.7L6.2 11.2 4 12l.8-2.2 6.6-7.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="3.5" cy="8" r="1.15" fill="currentColor" />
      <circle cx="8" cy="8" r="1.15" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.15" fill="currentColor" />
    </svg>
  );
}

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
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sync.kicked) return;
    setJoined(false);
    setError("You were removed from the room");
  }, [sync.kicked]);

  useEffect(() => {
    if (!menuFor) return;
    function onPointer(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (menuRef.current?.contains(event.target)) return;
      setMenuFor(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuFor(null);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);

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
          const menuOpen = menuFor === player.id;
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
                {editing ? null : (
                  <div className="player-menu" ref={menuOpen ? menuRef : undefined}>
                    <button
                      type="button"
                      className="icon"
                      aria-label={mine ? "Your options" : "Player options"}
                      aria-expanded={menuOpen}
                      onClick={() => setMenuFor(menuOpen ? null : player.id)}
                    >
                      {mine ? <PencilIcon /> : <MoreIcon />}
                    </button>
                    {menuOpen ? (
                      <div className="menu" role="menu">
                        {mine ? (
                          <>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuFor(null);
                                setEditingName(player.name);
                              }}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuFor(null);
                                sync.removePlayer(player.id);
                              }}
                            >
                              Leave
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuFor(null);
                              sync.removePlayer(player.id);
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
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
