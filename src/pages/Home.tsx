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
      setError("Введите имя — так вас увидят в комнате");
      return;
    }
    sessionStorage.setItem("pp-name", trimmed);
    navigate(`/r/${nanoid(8)}`);
  }

  return (
    <div className="shell">
      <p className="brand">Planning poker</p>
      <h1>Оцените задачу вместе, не подглядывая</h1>
      <p className="lead">
        Создайте комнату, скиньте ссылку команде, выберите карту. Оценки откроются
        одновременно.
      </p>
      <div className="panel">
        <div className="row">
          <input
            type="text"
            placeholder="Ваше имя"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createRoom();
            }}
          />
          <button type="button" onClick={createRoom}>
            Создать комнату
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
