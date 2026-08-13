# Planning poker

Share a room link, vote with Fibonacci cards, reveal estimates together.

No accounts. Enter a name, create a room, send the URL. The Node server keeps the room in memory and syncs votes over Socket.io.

## Local

```bash
npm install
npm run dev
```

Open http://localhost:5173, create a room, copy the link, and open it in another window.

## Deploy

One process serves the UI and the WebSocket server. Easiest host: [Render](https://render.com).

1. New → Web Service → this GitHub repo.
2. Runtime: Docker (uses the included `Dockerfile`).
3. After deploy, share `https://<your-service>.onrender.com` with the team.

The free plan spins the service down after idle time; the first request may take ~30 seconds. Rooms are lost on restart.

## GitHub Pages

Do not use GitHub Pages for this version. Pages cannot run the backend, so teammates would not share one room.
