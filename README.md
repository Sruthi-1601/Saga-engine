# SAGA Engine 🎮

A JSON-configured web-based learning game engine that transforms 
any educational content into a playable game — zero code required 
from educators.

Built by **Team Mitrujoy** for TaPTaP Hackathon 2026.

---

## What is SAGA Engine?

One engine. Infinite subjects. A teacher writes a single config 
file and the engine generates a fully playable educational game.

The engine is reusable because every mechanic, theme, adaptive 
logic, and analytics hook is decoupled via a central Message Bus — 
modules communicate through events, not direct dependencies.

---

## How to Run Locally

1. Clone the repository
   git clone https://github.com/YourUsername/saga-engine.git

2. Go into the folder
   cd saga-engine

3. Install dependencies
   npm install

4. Start the engine
   npm run dev

5. Open in browser
   http://localhost:5173

---

## How It Works

1. Engine reads saga-config.json
2. ConfigParser validates all fields
3. Message Bus broadcasts events to all modules
4. Game Logic, Mechanics, Adaptive Engine run independently
5. NeuronRush renderer displays the game in browser

---

## JSON Schema

The entire game is controlled by saga-config.json.
Swapping this file changes the subject, questions, 
mechanics and difficulty — without touching any engine code.

Key fields:
- engine       → always "saga"
- mode         → QuestPath | NeuronRush | MirrorMatch
- metadata     → title, subject, grade, author
- mechanics    → timer, lives, streakBonus, adaptiveDifficulty
- content      → questions array with options, answer, points, hint

---

## Engine / Data Boundary

saga-config.json        → DATA  (swap this to change the game)
src/ConfigParser.js     → boundary between data and engine
src/MessageBus.js       → engine event system
src/GameRuntime.js      → engine state machine
src/NeuronRush.js       → engine renderer
src/main.js             → engine entry point

---

## Folder Structure

saga-engine/
├── index.html
├── saga-config.json
├── package.json
├── vite.config.js
└── src/
    ├── main.js
    ├── MessageBus.js
    ├── ConfigParser.js
    ├── GameRuntime.js
    └── NeuronRush.js

---

## Three Game Modes

| Mode        | Description                        | Status      |
|-------------|-------------------------------------|-------------|
| NeuronRush  | Rapid-fire timed Q&A               | Ready ✅    |
| QuestPath   | Story map, answer to advance       | Mar 21 🔜   |
| MirrorMatch | Flip cards, match pairs            | Mar 21 🔜   |

---

## Tech Stack

| Layer            | Technology        |
|------------------|-------------------|
| Frontend         | Vanilla JavaScript|
| Game Engine      | Custom JS Modules |
| Message Bus      | Custom Pub/Sub    |
| Config Validation| JSON + ConfigParser|
| Build Tool       | Vite              |
| Hosting          | GitHub Pages      |

---

## Team Mitrujoy

Built for TaPTaP Platform — Ed-Tech Hackathon 2026
