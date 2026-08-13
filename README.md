# Planning poker

Share a room link, vote with Fibonacci cards, reveal estimates together.

No accounts. Enter a name, create a room, send the URL. The server keeps the room in memory and syncs votes over Socket.io. When everyone has voted, cards open on their own.

## Local

```bash
cp .env.example .env   # optional: add LINEAR_API_KEY
npm install
npm run dev
```

Open http://localhost:5173

## Linear

Set `LINEAR_API_KEY` to a Linear personal API key (Settings → API). Then in a room paste `CAT-123` or a Linear URL and pull the issue. After reveal, save the median numeric vote back to the issue estimate field.

## Google Meet

There is no Marketplace add-on. Use **Compact layout for Meet** (or **Meet layout** in a room) and open that URL in a split view next to the call. The server allows the page to be framed from `meet.google.com`.

## Deploy

One process serves the UI and WebSocket server. Easiest host: [Render](https://render.com).

1. New → Web Service → this GitHub repo.
2. Runtime: Docker.
3. Add `LINEAR_API_KEY` if you want issue sync.
4. Share `https://<your-service>.onrender.com`.

Rooms are lost on restart. The free plan may sleep when idle.
