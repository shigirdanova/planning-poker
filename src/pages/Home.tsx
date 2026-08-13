import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState(() => sessionStorage.getItem("pp-name") ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createRoom() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your name so the team can see you in the room");
      return;
    }
    sessionStorage.setItem("pp-name", trimmed);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
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
      <p className="brand">Planning poker</p>
      <h1>Estimate together without peeking</h1>
      <p className="lead">
        Create a room, copy the link, and send it to the team. Everyone who opens
        that link joins the same room and sees the same votes.
      </p>
      <div className="panel">
        <div className="row">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createRoom();
            }}
          />
          <button type="button" onClick={() => void createRoom()} disabled={busy}>
            {busy ? "Creating…" : "Create room"}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
