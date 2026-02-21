/**
 * ScribblePlay MVP - Main Application Logic
 */

// --- Supabase Setup ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseClient = (typeof supabase !== 'undefined') ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- State Management ---
const state = {
    screen: 'home',
    difficulty: 'Easy',
    words: [],
    currentWord: '',
    currentClue: '',
    timer: 300,
    timerInterval: null,
    score: 0,
    startTime: 0,
    currentTool: 'pencil',
    undoStack: [],
    maxUndo: 20,
    highScore: localStorage.getItem('scribble_highscore') || 0,
    drawnCount: 0,
    targetCount: 0,
    sessionWords: [],
    isPaused: false
};

// --- DOM Elements ---
const screens = {
    home: document.getElementById('home-screen'),
    game: document.getElementById('game-screen'),
    results: document.getElementById('results-screen'),
    pauseOverlay: document.getElementById('pause-overlay'),
    referenceImg: document.getElementById('reference-image'),
    accuracyVal: document.getElementById('accuracy-val')
};

const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const wordHintDisplay = document.getElementById('word-hint');
const timerDisplay = document.getElementById('timer');
const scoreDisplay = document.getElementById('current-score');
const highScoreDisplay = document.getElementById('high-score-val');

// --- Initialization ---
async function init() {
    highScoreDisplay.textContent = state.highScore;

    // Load words from Supabase or Fallback
    try {
        if (supabaseClient) {
            const { data, error } = await supabaseClient.from('words').select('*');
            if (error) throw error;
            state.words = data;
        } else {
            throw new Error("Supabase not initialized");
        }
    } catch (err) {
        console.warn("Supabase fetch failed, falling back to local JSON:", err);
        const response = await fetch('./data/words.json');
        state.words = await response.json();
    }

    setupEventListeners();
    // Ensure canvas is sized before anything else
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function setupEventListeners() {
    // Navigation
    document.getElementById('start-game').addEventListener('click', startGame);
    document.getElementById('play-again').addEventListener('click', startGame);
    document.getElementById('go-home').addEventListener('click', () => switchScreen('home'));

    // Game Actions
    document.getElementById('clear-canvas').addEventListener('click', clearCanvas);
    document.getElementById('submit-drawing').addEventListener('click', submitDrawing);

    // Tools
    document.getElementById('tool-pencil').addEventListener('click', () => setTool('pencil'));
    document.getElementById('tool-fill').addEventListener('click', () => setTool('fill'));
    document.getElementById('tool-eraser').addEventListener('click', () => setTool('eraser'));
    document.getElementById('tool-undo').addEventListener('click', undo);

    // Pause functionality
    document.getElementById('pause-game').addEventListener('click', togglePause);
    document.getElementById('resume-game').addEventListener('click', togglePause);

    // Canvas Drawing
    let isDrawing = false;

    const getCoordinates = (e) => {
        const rect = canvas.getBoundingClientRect();
        // Handle Mouse and Touch events
        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e) => {
        if (state.isPaused) return;
        if (state.currentTool === 'fill') {
            const coords = getCoordinates(e);
            floodFill(Math.floor(coords.x), Math.floor(coords.y));
            return;
        }

        isDrawing = true;
        saveState(); // Save before starting a new stroke
        const coords = getCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
    };

    const stopDrawing = () => {
        if (isDrawing) {
            ctx.stroke();
            ctx.beginPath();
        }
        isDrawing = false;
    };

    const draw = (e) => {
        if (!isDrawing || state.isPaused) return;

        const coords = getCoordinates(e);

        ctx.lineWidth = document.getElementById('brush-size').value;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (state.currentTool === 'eraser') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = document.getElementById('brush-size').value * 4;
        } else {
            ctx.strokeStyle = document.getElementById('color-picker').value;
        }

        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Mobile support
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startDrawing(e.touches[0]);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        draw(e.touches[0]);
    }, { passive: false });

    canvas.addEventListener('touchend', stopDrawing);
}

// --- Game Logic ---
function startGame() {
    state.difficulty = document.getElementById('difficulty').value;

    // Set target count based on difficulty
    if (state.difficulty === 'Easy') state.targetCount = 8;
    else if (state.difficulty === 'Medium') state.targetCount = 12;
    else if (state.difficulty === 'Hard') state.targetCount = 15;

    // Filter and Shuffle words
    const filtered = state.words.filter(w => w.difficulty === state.difficulty);
    state.sessionWords = [...filtered].sort(() => 0.5 - Math.random());

    state.drawnCount = 0;
    state.timer = 300;
    state.score = 0;
    state.startTime = Date.now();
    state.currentTool = 'pencil';
    state.undoStack = [];
    state.isPaused = false;
    screens.pauseOverlay.classList.remove('active');

    switchScreen('game');

    setTimeout(() => {
        setTool('pencil');
        resizeCanvas();
        nextWord();
        startTimer();
    }, 50);
}

function nextWord() {
    const wordIdx = state.drawnCount;
    // Don't repeat words - ensure we have words left
    if (wordIdx >= state.sessionWords.length || wordIdx >= state.targetCount) {
        endGame();
        return;
    }

    const wordObj = state.sessionWords[wordIdx];
    state.currentWord = wordObj.word;
    state.currentClue = wordObj.clue;

    // Load reference image (using public Icon API)
    screens.referenceImg.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${wordObj.word.toLowerCase()}&backgroundColor=ffffff`;

    clearCanvas();
    updateDisplays();
    showFeedback(`Draw ${state.drawnCount + 1}/${state.targetCount}: ${state.currentWord}`);
}

async function submitDrawing() {
    const accuracy = await calculateAccuracy();

    if (accuracy < 40) {
        showFeedback(`Need more detail! Current accuracy: ${Math.round(accuracy)}% (Need 40%)`);
        return;
    }

    state.drawnCount++;
    state.score += 10 + Math.floor(accuracy / 10);

    if (state.drawnCount >= state.targetCount) {
        endGame();
    } else {
        nextWord();
    }
}

async function calculateAccuracy() {
    return new Promise((resolve) => {
        const size = 64; // Small resolution for comparison
        const compareCanvas = document.createElement('canvas');
        compareCanvas.width = size;
        compareCanvas.height = size;
        const cCtx = compareCanvas.getContext('2d');

        // 1. Capture user drawing
        cCtx.drawImage(canvas, 0, 0, size, size);
        const userData = cCtx.getImageData(0, 0, size, size).data;

        // 2. Load and capture reference
        const refImg = new Image();
        refImg.crossOrigin = "anonymous";
        refImg.src = screens.referenceImg.src;
        refImg.onload = () => {
            cCtx.clearRect(0, 0, size, size);
            cCtx.drawImage(refImg, 0, 0, size, size);
            const refData = cCtx.getImageData(0, 0, size, size).data;

            // 3. Compare pixel density
            let activeMatches = 0;
            let totalRefActive = 0;

            for (let i = 0; i < userData.length; i += 4) {
                // Check if pixel is "active" (not white)
                const isUserActive = userData[i] < 240 || userData[i + 1] < 240 || userData[i + 2] < 240;
                const isRefActive = refData[i] < 240 || refData[i + 1] < 240 || refData[i + 2] < 240;

                if (isRefActive) totalRefActive++;
                if (isRefActive && isUserActive) activeMatches++;
            }

            // Accuracy based on how much of the reference the user covered
            const accuracy = totalRefActive > 0 ? (activeMatches / totalRefActive) * 100 : 0;

            // Scaled accuracy for better user experience
            const scaledAccuracy = Math.min(100, accuracy * 2);
            screens.accuracyVal.textContent = `${Math.round(scaledAccuracy)}%`;
            resolve(scaledAccuracy);
        };
        refImg.onerror = () => resolve(50); // Safe fallback
    });
}

function togglePause() {
    state.isPaused = !state.isPaused;
    screens.pauseOverlay.classList.toggle('active', state.isPaused);

    if (state.isPaused) {
        showFeedback("Game Paused");
    } else {
        showFeedback("Game Resumed");
    }
}

function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        if (state.isPaused) return;
        state.timer--;
        timerDisplay.textContent = state.timer;
        if (state.timer <= 0) {
            endGame();
        }
    }, 1000);
}

function endGame() {
    clearInterval(state.timerInterval);

    const timeTaken = Math.floor((Date.now() - state.startTime) / 1000);
    // Score is current state.score + time bonus if all completed
    if (state.drawnCount >= state.targetCount) {
        state.score += Math.max(0, 60 - timeTaken);
    }

    if (state.score > state.highScore) {
        state.highScore = state.score;
        localStorage.setItem('scribble_highscore', state.score);
        highScoreDisplay.textContent = state.highScore;
    }

    document.getElementById('final-word').textContent = `${state.drawnCount}/${state.targetCount} Images`;
    document.getElementById('time-taken').textContent = timeTaken;
    document.getElementById('score-earned').textContent = state.score;

    // Save to Supabase
    if (supabaseClient) {
        supabaseClient.from('game_sessions').insert([
            {
                word: `${state.drawnCount} drawings`,
                score: state.score,
                time_taken: timeTaken
            }
        ]).then(({ error }) => {
            if (error) console.error("Error saving session:", error);
        });
    }

    switchScreen('results');
}

// --- Utilities ---
function switchScreen(screenName) {
    Object.keys(screens).forEach(key => {
        screens[key].classList.toggle('active', key === screenName);
    });
    state.screen = screenName;
}

function resizeCanvas() {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) return;

    // Set internal resolution to match displayed size
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Fill with white background
    clearCanvas();
}

function clearCanvas() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Reset path state
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
}

function setTool(tool) {
    state.currentTool = tool;
    document.getElementById('tool-pencil').classList.toggle('active', tool === 'pencil');
    document.getElementById('tool-fill').classList.toggle('active', tool === 'fill');
    document.getElementById('tool-eraser').classList.toggle('active', tool === 'eraser');

    if (tool === 'fill') {
        canvas.style.cursor = 'crosshair';
    } else {
        canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
    }
}

function saveState() {
    state.undoStack.push(canvas.toDataURL());
    if (state.undoStack.length > state.maxUndo) {
        state.undoStack.shift();
    }
}

function undo() {
    if (state.undoStack.length === 0) return;

    const previousState = state.undoStack.pop();
    const img = new Image();
    img.src = previousState;
    img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
}

function floodFill(startX, startY) {
    saveState();
    const targetColor = hexToRgb(document.getElementById('color-picker').value);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    const startPos = (startY * canvas.width + startX) * 4;
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];

    if (startR === targetColor.r && startG === targetColor.g && startB === targetColor.b) return;

    const stack = [[startX, startY]];

    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const pos = (y * canvas.width + x) * 4;

        if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
        if (pixels[pos] !== startR || pixels[pos + 1] !== startG || pixels[pos + 2] !== startB) continue;

        pixels[pos] = targetColor.r;
        pixels[pos + 1] = targetColor.g;
        pixels[pos + 2] = targetColor.b;
        pixels[pos + 3] = 255;

        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}


function updateDisplays() {
    wordHintDisplay.innerHTML = `${state.currentWord} <small style="display:block; font-size: 0.8rem; font-weight: normal; opacity: 0.8;">${state.currentClue || ''}</small>`;
    timerDisplay.textContent = state.timer;
    scoreDisplay.textContent = state.score;
    document.getElementById('progress').textContent = `${state.drawnCount}/${state.targetCount}`;
}

function showFeedback(msg) {
    const toast = document.createElement('div');
    toast.className = 'feedback-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}


// Init App
init();
