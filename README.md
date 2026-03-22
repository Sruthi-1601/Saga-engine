# SAGA Engine 🎮

## 🎮 Live Demo
👉 https://mitrujoy-saga-engine.netlify.app/

A JSON-configured web-based learning game engine that transforms 
any educational content into a playable game — zero code required 
from educators.

Built by **Team Mitrujoy** for TaPTaP Hackathon 2026.

---

## What is SAGA Engine?

One engine. Infinite subjects. A teacher writes a single config 
file and the engine generates a fully playable educational game.

The engine is reusable because every mechanic, theme, adaptive 
logic, and analytics hook is decoupled via a central Message Bus.

---

## How to Run Locally

1. Clone the repository
   git clone https://github.com/Sruthi-1601/Saga-engine.git
2. Go into the folder
   cd saga-engine
3. Install dependencies
   npm install
4. Start the engine
   npm run dev
5. Open in browser
   http://localhost:5173

---

## 5 Subjects Available

| Subject     | Questions | Modes Available        |
|-------------|-----------|------------------------|
| History     | 8         | All 3 modes            |
| Science     | 8         | All 3 modes            |
| Mathematics | 8         | All 3 modes            |
| English     | 8         | All 3 modes            |
| Geography   | 8         | All 3 modes            |

---

## Three Game Modes

| Mode        | Description                        | Status   |
|-------------|-------------------------------------|----------|
| NeuronRush  | Rapid-fire timed Q&A               | Ready ✅ |
| QuestPath   | Space explorer story map           | Ready ✅ |
| MirrorMatch | Flip cards, match pairs            | Ready ✅ |

---

## How It Works

1. Engine reads saga-config.json
2. User selects subject and game mode
3. Message Bus broadcasts events to all modules
4. Game Logic, Mechanics, Adaptive Engine run independently
5. Renderer displays the game in browser
6. Swapping JSON changes subject, questions and behavior

---

## JSON Controls Everything

Swapping saga-config.json changes:
- Subject and questions
- Number of lives
- Timer speed per question
- Streak bonus multiplier
- Adaptive difficulty

No code changes needed — only JSON.

---

## Engine / Data Boundary

saga-config.json     → DATA  (swap to change the game)
src/ConfigParser.js  → boundary between data and engine
src/MessageBus.js    → engine event system
src/GameRuntime.js   → engine state machine
src/NeuronRush.js    → rapid fire renderer
src/QuestPath.js     → story map renderer
src/MirrorMatch.js   → card match renderer
src/main.js          → engine entry point

---

## Folder Structure

saga-engine/
├── public/
│   └── saga-config.json
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.js
    ├── MessageBus.js
    ├── ConfigParser.js
    ├── GameRuntime.js
    ├── NeuronRush.js
    ├── QuestPath.js
    └── MirrorMatch.js

---

## Tech Stack

| Layer            | Technology         |
|------------------|--------------------|
| Frontend         | Vanilla JavaScript |
| Game Engine      | Custom JS Modules  |
| Message Bus      | Custom Pub/Sub     |
| Config           | JSON               |
| Build Tool       | Vite               |
| Hosting          | Netlify            |

---

## Team Mitrujoy

Built for TaPTaP Platform — Ed-Tech Hackathon 2026
