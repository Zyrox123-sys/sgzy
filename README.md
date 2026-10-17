# StumbleZyx backend (Railway scaffold)

This folder is a deployable Node.js service foundation. It exposes `/` and `/health` so Railway can report whether the process is online.

## Current limitation

This is **not yet a working StumbleZyx 0.56 game backend**. The project files available so far contain client-side mod code, not the server implementation or the complete API contract. In particular, `/auth` and `/shared` deliberately return HTTP 501 instead of pretending to authenticate players or returning fabricated game data. The game will not be able to use this service until those endpoints and the other required game APIs are implemented.

Do not put passwords, account tokens, or third-party backend secrets in this project. Add only credentials for services you own, using Railway Variables.

## Deploy on Railway

1. Put this folder in a GitHub repository you control.
2. In Railway, create a project and choose **Deploy from GitHub repo**.
3. Select the repository. Railway detects `package.json`; the start command is `npm start`.
4. In the service settings, generate a public domain.
5. Open `https://YOUR-DOMAIN/health`. A JSON status response confirms only that the web process is running, not that the game API works.

Railway supplies `PORT`; the app binds to `0.0.0.0` and uses that port.
