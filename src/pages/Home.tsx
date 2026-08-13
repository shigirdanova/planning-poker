import { nanoid } from "nanoid";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState(() => sessionStorage.getItem("pp-name") ?? "");
  const [error, setError] = useState("");

  function createRoom() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your name so the team can see you in the room");
      return;
    }
    sessionStorage.setItem("pp-name", trimmed);
    navigate(`/r/${nanoid(8)}`);
  }

  return (
    <div className="shell home">
      <p className="brand">Planning poker</p>
      <h1>Estimate together without peeking</h1>
      <p className="lead">
        Create a room, share the link, pick a card. Votes stay hidden until you
        reveal them.
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
              if (e.key === "Enter") createRoom();
            }}
          />
          <button type="button" onClick={createRoom}>
            Create room
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
