# Ludo Arena v2 — multiplayer playable prototype

## Features
- 2-player and 4-player rooms
- Quick matchmaking and private room codes
- Server-controlled dice rolls and turn order
- Four tokens per player
- Roll six to leave the yard
- Token movement, safe squares, captures, home lane and win condition
- Extra turn on a six or capture
- Free play only: no entry fees, deposits, cash prizes or cash withdrawals

## Run locally
1. Install Node.js LTS.
2. Extract this ZIP.
3. In the extracted folder run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

For a real online test between different phones, deploy the Node.js app on a host supporting persistent WebSocket connections. Share the deployed URL; both players open it on their phones.

## Prototype limitations before public launch
This is a playable prototype, not a production-certified service. It needs QA for edge cases, reconnect/resume, abandoned games, abuse/rate limiting, secure account system, privacy policy, child safety, accessibility, analytics, and hosting configuration. Two-player mode uses red and yellow seats. Board presentation is a simplified circular Ludo-style track rather than a traditional cross-shaped board. Test with friends before public release.
