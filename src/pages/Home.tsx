import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createRoom() {
    const trimmed = roomName.trim();
    if (!trimmed) {
      setError("Enter a room name");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Could not create a room");
      const data = (await res.json()) as { id: string };
      navigate(`/r/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a room");
      setBusy(false);
    }
  }

  return (
    <div className="shell home">
      <h1>Planning poker</h1>
      <div className="panel-box">
        <div className="row">
          <input
            type="text"
            placeholder="Room name"
            value={roomName}
            maxLength={60}
            autoFocus
            onChange={(e) => setRoomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createRoom();
            }}
          />
          <button type="button" onClick={() => void createRoom()} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
