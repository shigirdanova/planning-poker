# Planning poker

Комната по ссылке, Fibonacci-карты, одновременное открытие голосов.

Сайт: https://shigirdanova.github.io/planning-poker/

Это статическое приложение: GitHub Pages раздаёт фронт, комнаты синхронизируются через публичный MQTT-брокер. Свой сервер не нужен.

## Локально

```bash
npm install
npm run dev
```

Откройте http://localhost:5173 — создайте комнату и откройте ту же ссылку во втором окне.

## Деплой

Пуш в `main` собирает сайт и публикует его на GitHub Pages.
