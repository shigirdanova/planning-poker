# Planning poker

Share a room link, vote with Fibonacci cards, reveal estimates together.

No accounts. Create a room, send the URL, enter a name to join. The server keeps the room in memory and syncs votes over Socket.io. When everyone has voted, cards open on their own.

## Local

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Deploy

Live: https://web--planning-poker--2s2g2lvzd8cp.code.run

One process serves the UI and WebSocket server. Rooms are lost on restart.
