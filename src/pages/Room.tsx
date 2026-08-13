import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CARDS } from "../shared/types";
import type { RoomState } from "../shared/types";
import { useRoomSync } from "../sync";

function stats(room: RoomState) {
  const nums = room.players
    .map((p) => p.vote)
    .filter((v): v is string => v !== null && /^\d+$/.test(v))
    .map(Number);
  if (nums.length === 0) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return {
    avg: Number.isInteger(avg) ? String(avg) : avg.toFixed(1).replace(".", ","),
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}

export default function Room() {
  const { roomId = "" } = useParams();
  const [name, setName] = useState(() => sessionStorage.getItem("pp-name") ?? "");
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const sync = useRoomSync(roomId, name.trim(), joined);

  const summary = useMemo(
    () => (sync.room?.revealed ? stats(sync.room) : null),
    [sync.room],
  );
  const votedCount = sync.room?.players.filter((p) => p.hasVoted).length ?? 0;

  function join() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Введите имя");
      return;
    }
    sessionStorage.setItem("pp-name", trimmed);
    setJoined(true);
    setError("");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (!joined) {
    return (
      <div className="shell name-gate">
        <p className="brand">Комната {roomId}</p>
        <h1>Как вас представить?</h1>
        <div className="panel">
          <div className="row">
            <input
              type="text"
              placeholder="Ваше имя"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") join();
              }}
            />
            <button type="button" onClick={join}>
              Войти
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="toolbar">
        <div>
          <p className="brand">Planning poker</p>
          <Link to="/" style={{ color: "var(--muted)" }}>
            Новая комната
          </Link>
        </div>
        <button type="button" className="secondary" onClick={() => void copyLink()}>
          {copied ? "Ссылка скопирована" : "Скопировать ссылку"}
        </button>
      </div>

      <input
        className="topic"
        type="text"
        placeholder="Что оцениваем? Например: CAT-123 логин"
        value={sync.room?.topic ?? ""}
        maxLength={200}
        onChange={(e) => sync.setTopic(e.target.value)}
      />

      {sync.status !== "online" ? (
        <p className="hint">Подключаемся к комнате…</p>
      ) : null}

      {summary ? (
        <div className="stats">
          <span>
            Среднее <b>{summary.avg}</b>
          </span>
          <span>
            Разброс{" "}
            <b>
              {summary.min}–{summary.max}
            </b>
          </span>
        </div>
      ) : (
        <p className="hint">
          Проголосовали {votedCount} из {sync.room?.players.length ?? 0}
        </p>
      )}

      <div className="players">
        {(sync.room?.players ?? []).map((player) => (
          <div className="player" key={player.id}>
            <strong>{player.name}</strong>
            {sync.room?.revealed ? (
              <div className="chip">{player.vote ?? "—"}</div>
            ) : player.hasVoted ? (
              <div className="chip back">•</div>
            ) : (
              <div className="chip empty">ждём</div>
            )}
          </div>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 18 }}>
        <button
          type="button"
          onClick={() => sync.reveal()}
          disabled={!sync.room || sync.room.revealed || votedCount === 0}
        >
          Открыть карты
        </button>
        <button type="button" className="secondary" onClick={() => sync.newRound()}>
          Новый раунд
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
