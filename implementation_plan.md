# Scribble Game Implementation Plan (MVP)

Based on the provided setup, this plan outlines the architecture and steps to build the **ScribblePlay** MVP: a single-player drawing challenge with a timer and random words.

## 🏗️ Project Structure

We will use **Vite + Vanilla JavaScript + CSS** for a lightweight, high-performance experience.

```text
/
├── index.html          # Main entry point (Home, Game, Results SPA structure)
├── style.css           # Global styles & Design System
├── main.js             # Application logic & State Management
├── assets/             # Images, Icons, etc.
└── data/
    └── words.json      # Words collection (Easy/Medium/Hard)
```

## 1. Data Collections

### Words Collection (`data/words.json`)
- **Word**: Text
- **Difficulty**: Dropdown (Easy/Medium/Hard)
- *Total: 50–100 initial words.*

### GameSessions (In-memory/LocalStorage for MVP)
- **Word**: Text
- **Score**: Number
- **TimeTaken**: Number
- **DatePlayed**: Date

## 2. Page Flow (Single Page Application)

1.  **Home Screen**:
    - Logo: "ScribblePlay"
    - Difficulty Selector.
    - "Start Game" Button.
2.  **Game Screen**:
    - **Header**: Timer (60s), Hint, Score.
    - **Canvas**: Responsive HTML5 Canvas with drawing capabilities.
    - **Toolbar**: Color picker, Brush size, Clear, Submit.
3.  **Results Screen**:
    - Final Word revelation.
    - Score & Time summary.
    - "Play Again" & "Home" buttons.

## 3. Core Logic & Scoring

- **Word Selection**: Randomly pick from the selected difficulty.
- **Drawing Engine**: Basic `mousedown`, `mousemove`, `mouseup` listeners on Canvas.
- **Scoring**: `Score = Max(0, 100 - TimeTaken)`.
- **Timer**: 60-second countdown ending the game automatically.

## 4. UI/UX Design (Premium Aesthetics)

- **Palette**: White background with soft pastel accents (Lavender, Mint, Pale Blue).
- **Typography**: Modern sans-serif (Inter/Outfit).
- **Interactions**: Glassmorphism for the UI panels over the canvas. Smooth transitions between screens.

---

### Next Steps:
1. Initialize the project directory.
2. Create the design system in `style.css`.
3. Implement the Canvas drawing engine.
4. Build the game loop and state management.

**Shall I proceed with creating the base files and folder structure?**
