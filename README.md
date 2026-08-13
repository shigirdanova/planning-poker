# Planning poker

Share a room link, vote with Fibonacci cards, reveal estimates together.

Live: https://shigirdanova.github.io/planning-poker/

Static app on GitHub Pages. Rooms sync over a public MQTT broker, so there is no custom server.

## Local

```bash
npm install
npm run dev
```

Open http://localhost:5173, create a room, and open the same link in another window.

## Deploy

A push to `main` builds the site and publishes it to GitHub Pages.
