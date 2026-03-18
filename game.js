// Game Constants
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const MOVE_SPEED = 5;
const PLAYER_SIZE = 30;

// Persistence (localStorage)
const STORAGE_KEY = 'leveldevil:stats:v1';
const SETTINGS_KEY = 'leveldevil:settings:v1';

function clearAllSavedData() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    try { localStorage.removeItem(SETTINGS_KEY); } catch {}
    persistentStats = loadStats();
    settings = loadSettings();
    updateStatsUI();
    updateMuteUI();
}

// Game State
let gameState = {
    currentLevel: 0,
    deaths: 0,
    keys: {},
    gameRunning: true,
    paused: false,
    levelTimer: 0,
    jumpBuffer: 0,
    deathAnimation: {
        active: false,
        x: 0,
        y: 0,
        timer: 0,
        maxTime: 90 // 1.5 seconds at 60fps
    }
};

let persistentStats = loadStats();

let settings = loadSettings();

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return { muted: false, reducedMotion: false, hud: false, lastLevel: null };
        const parsed = JSON.parse(raw);
        return {
            muted: Boolean(parsed.muted),
            reducedMotion: Boolean(parsed.reducedMotion),
            hud: Boolean(parsed.hud),
            lastLevel: typeof parsed.lastLevel === 'number' ? parsed.lastLevel : null
        };
    } catch {
        return { muted: false, reducedMotion: false, hud: false, lastLevel: null };
    }
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // ignore
    }
}

// Audio (simple WebAudio synth beeps)
let audioCtx = null;

function ensureAudioContext() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
}

function setMuted(nextMuted) {
    settings.muted = Boolean(nextMuted);
    saveSettings();
    updateMuteUI();
}

function toggleMuted() {
    if (!settings.muted) {
        // Play feedback before muting
        playSound('muteOn');
        setMuted(true);
        return;
    }
    setMuted(false);
    playSound('muteOff');
}

function toggleReducedMotion() {
    settings.reducedMotion = !settings.reducedMotion;
    saveSettings();
}

function updateMuteUI() {
    const btn = document.getElementById('mute-btn');
    if (!btn) return;
    btn.textContent = settings.muted ? '🔇' : '🔊';
    btn.setAttribute('aria-label', settings.muted ? 'Unmute' : 'Mute');
    btn.setAttribute('title', settings.muted ? 'Unmute (M)' : 'Mute (M)');
}

function playSound(type) {
    if (settings.muted) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    let freq = 440;
    let dur = 0.09;
    let vol = 0.05;
    let shape = 'square';
    
    if (type === 'jump') { freq = 660; dur = 0.06; vol = 0.045; shape = 'square'; }
    if (type === 'death') { freq = 110; dur = 0.16; vol = 0.06; shape = 'sawtooth'; }
    if (type === 'complete') { freq = 880; dur = 0.12; vol = 0.05; shape = 'triangle'; }
    if (type === 'pause') { freq = 330; dur = 0.05; vol = 0.04; shape = 'square'; }
    if (type === 'unpause') { freq = 392; dur = 0.05; vol = 0.04; shape = 'square'; }
    if (type === 'muteOn') { freq = 196; dur = 0.06; vol = 0.035; shape = 'triangle'; }
    if (type === 'muteOff') { freq = 523.25; dur = 0.06; vol = 0.035; shape = 'triangle'; }
    
    osc.type = shape;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    
    osc.start(now);
    osc.stop(now + dur + 0.02);
}

function loadStats() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { bestRunDeaths: null, bestLevelTimesMs: {} };
        }
        const parsed = JSON.parse(raw);
        return {
            bestRunDeaths: typeof parsed.bestRunDeaths === 'number' ? parsed.bestRunDeaths : null,
            bestLevelTimesMs: parsed.bestLevelTimesMs && typeof parsed.bestLevelTimesMs === 'object' ? parsed.bestLevelTimesMs : {}
        };
    } catch {
        return { bestRunDeaths: null, bestLevelTimesMs: {} };
    }
}

function saveStats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persistentStats));
    } catch {
        // ignore storage failures (private mode, quota, etc.)
    }
}

function formatBestTime(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
    const seconds = ms / 1000;
    if (seconds < 10) return `${seconds.toFixed(2)}s`;
    return `${seconds.toFixed(1)}s`;
}

function updateStatsUI() {
    const bestRunDeathsEl = document.getElementById('best-run-deaths');
    const bestLevelTimeEl = document.getElementById('best-level-time');
    if (bestRunDeathsEl) {
        bestRunDeathsEl.textContent =
            typeof persistentStats.bestRunDeaths === 'number' ? String(persistentStats.bestRunDeaths) : '—';
    }
    if (bestLevelTimeEl) {
        const key = String(gameState.currentLevel);
        bestLevelTimeEl.textContent = formatBestTime(persistentStats.bestLevelTimesMs[key]);
    }
}

// Player
const player = {
    x: 50,
    y: 300,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    velocityX: 0,
    velocityY: 0,
    onGround: false,
    coyoteTimer: 0,
    color: '#3498db'
};

// Level Definitions
const levels = [
    {
        name: "Tutorial",
        platforms: [
            { x: 0, y: 550, width: 800, height: 50, color: '#34495e', solid: true },
            { x: 200, y: 450, width: 150, height: 20, color: '#34495e', solid: true },
            { x: 450, y: 350, width: 150, height: 20, color: '#34495e', solid: true },
        ],
        spikes: [],
        movingPlatforms: [],
        fakePlatforms: [],
        dynamicSpikes: [],
        fallingBlocks: [],
        disappearingPlatforms: [],
        triggers: [],
        goal: { x: 700, y: 500, width: 40, height: 40 },
        playerStart: { x: 50, y: 500 }
    },
    {
        name: "The Fake Out",
        platforms: [
            { x: 0, y: 550, width: 150, height: 50, color: '#34495e', solid: true },
            { x: 200, y: 450, width: 100, height: 20, color: '#34495e', solid: true },
            { x: 400, y: 350, width: 100, height: 20, color: '#34495e', solid: true },
            { x: 600, y: 450, width: 200, height: 20, color: '#34495e', solid: true },
        ],
        spikes: [
            { x: 320, y: 530, width: 40, height: 20 },
            { x: 510, y: 330, width: 40, height: 20 }
        ],
        movingPlatforms: [],
        fakePlatforms: [
            { x: 400, y: 450, width: 100, height: 20, color: '#3d5466', solid: false }
        ],
        dynamicSpikes: [
            { x: 450, y: 330, width: 40, height: 20, triggered: false, visible: false },
            { x: 680, y: 430, width: 40, height: 20, triggered: false, visible: false }
        ],
        fallingBlocks: [],
        disappearingPlatforms: [],
        triggers: [
            { x: 420, y: 350, condition: 'platformLanding', action: 'showSpike', target: 0, triggered: false, platformY: 350 },
            { x: 650, y: 450, condition: 'platformLanding', action: 'showSpike', target: 1, triggered: false, platformY: 450 }
        ],
        goal: { x: 720, y: 400, width: 40, height: 40 },
        playerStart: { x: 50, y: 500 }
    },
    {
        name: "Moving Troubles",
        platforms: [
            { x: 0, y: 550, width: 150, height: 50, color: '#34495e', solid: true },
            { x: 170, y: 480, width: 60, height: 15, color: '#34495e', solid: true },
            { x: 650, y: 550, width: 150, height: 50, color: '#34495e', solid: true },
        ],
        spikes: [
            { x: 240, y: 530, width: 30, height: 20 },
            { x: 300, y: 530, width: 30, height: 20 },
            { x: 360, y: 530, width: 30, height: 20 },
            { x: 420, y: 530, width: 30, height: 20 },
            { x: 480, y: 530, width: 30, height: 20 },
            { x: 540, y: 530, width: 30, height: 20 },
            { x: 600, y: 530, width: 30, height: 20 }
        ],
        movingPlatforms: [
            { x: 250, y: 380, width: 120, height: 20, color: '#9b59b6', speed: 2, range: 250, direction: 1, startX: 250, axis: 'x' }
        ],
        fakePlatforms: [],
        dynamicSpikes: [],
        fallingBlocks: [
            { x: 400, y: -50, width: 40, height: 40, velocityY: 0, color: '#e67e22', triggered: false, visible: false }
        ],
        disappearingPlatforms: [],
        triggers: [
            { x: 350, condition: 'playerX', action: 'dropBlock', target: 0, triggered: false }
        ],
        goal: { x: 720, y: 500, width: 40, height: 40 },
        playerStart: { x: 50, y: 500 }
    },
    {
        name: "The Trap",
        platforms: [
            { x: 0, y: 550, width: 200, height: 50, color: '#34495e', solid: true },
            { x: 500, y: 350, width: 120, height: 20, color: '#34495e', solid: true },
            { x: 300, y: 250, width: 120, height: 20, color: '#34495e', solid: true },
        ],
        spikes: [
            { x: 440, y: 430, width: 40, height: 20 },
            { x: 210, y: 530, width: 30, height: 20 },
            { x: 250, y: 530, width: 30, height: 20 }
        ],
        movingPlatforms: [
            { x: 100, y: 350, width: 100, height: 20, color: '#9b59b6', speed: 1.5, range: 150, direction: 1, startY: 350, axis: 'y' }
        ],
        fakePlatforms: [
            { x: 500, y: 450, width: 120, height: 20, color: '#3d5466', solid: false }
        ],
        dynamicSpikes: [
            { x: 540, y: 330, width: 40, height: 20, triggered: false, visible: false }
        ],
        fallingBlocks: [],
        disappearingPlatforms: [
            { x: 300, y: 450, width: 120, height: 20, color: '#34495e', timer: 0, disappearing: false, disappeared: false }
        ],
        triggers: [
            { x: 500, condition: 'playerX', action: 'showSpike', target: 0, triggered: false },
            { x: 300, condition: 'platformTouch', action: 'startDisappear', target: 0, triggered: false, platformIndex: 0 }
        ],
        goal: { x: 350, y: 200, width: 40, height: 40 },
        playerStart: { x: 80, y: 500 }
    },
    {
        name: "Devil's Playground",
        platforms: [
            { x: 0, y: 550, width: 100, height: 50, color: '#34495e', solid: true },
            { x: 550, y: 400, width: 80, height: 20, color: '#34495e', solid: true },
            { x: 700, y: 550, width: 100, height: 50, color: '#34495e', solid: true },
        ],
        spikes: [
            { x: 120, y: 530, width: 30, height: 20 },
            { x: 180, y: 530, width: 30, height: 20 },
            { x: 240, y: 530, width: 30, height: 20 },
            { x: 300, y: 530, width: 30, height: 20 },
            { x: 360, y: 530, width: 30, height: 20 },
            { x: 420, y: 530, width: 30, height: 20 },
            { x: 480, y: 530, width: 30, height: 20 },
            { x: 540, y: 530, width: 30, height: 20 },
            { x: 600, y: 530, width: 30, height: 20 },
            { x: 660, y: 530, width: 30, height: 20 }
        ],
        movingPlatforms: [
            { x: 250, y: 380, width: 100, height: 20, color: '#9b59b6', speed: 2.5, range: 230, direction: 1, startX: 250, axis: 'x' },
            { x: 680, y: 250, width: 80, height: 20, color: '#9b59b6', speed: 2, range: 180, direction: 1, startY: 250, axis: 'y' }
        ],
        fakePlatforms: [
            { x: 260, y: 480, width: 60, height: 15, color: '#3d5466', solid: false }
        ],
        dynamicSpikes: [
            { x: 520, y: 380, width: 30, height: 20, triggered: false, visible: false }
        ],
        fallingBlocks: [
            { x: 380, y: -50, width: 40, height: 40, velocityY: 0, color: '#e67e22', triggered: false, visible: false },
            { x: 680, y: -50, width: 40, height: 40, velocityY: 0, color: '#e67e22', triggered: false, visible: false }
        ],
        disappearingPlatforms: [
            { x: 150, y: 480, width: 80, height: 15, color: '#34495e', timer: 0, disappearing: false, disappeared: false }
        ],
        triggers: [
            { x: 300, condition: 'playerX', action: 'dropBlock', target: 0, triggered: false },
            { x: 520, condition: 'playerX', action: 'showSpike', target: 0, triggered: false },
            { x: 720, condition: 'playerX', action: 'dropBlock', target: 1, triggered: false },
            { x: 150, condition: 'platformTouch', action: 'startDisappear', target: 0, triggered: false, platformIndex: 0 }
        ],
        goal: { x: 740, y: 500, width: 40, height: 40, isFake: true, moveOnApproach: true, realGoalX: 740, realGoalY: 100 },
        playerStart: { x: 30, y: 500 }
    }
];

// Randomization utilities
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function randomBool(probability = 0.5) {
    return Math.random() < probability;
}

// Randomize level elements for replayability
function randomizeLevel(level, levelIndex) {
    // Don't randomize tutorial level
    if (levelIndex === 0) return;
    
    // Randomize spike positions (shift by ±20 pixels)
    level.spikes.forEach(spike => {
        if (!spike.originalX) spike.originalX = spike.x;
        spike.x = spike.originalX + randomInt(-20, 20);
    });
    
    // Randomize dynamic spike positions
    level.dynamicSpikes.forEach(spike => {
        if (!spike.originalX) spike.originalX = spike.x;
        if (!spike.originalY) spike.originalY = spike.y;
        spike.x = spike.originalX + randomInt(-30, 30);
        spike.y = spike.originalY + randomInt(-15, 15);
    });
    
    // Randomize falling block X positions
    level.fallingBlocks.forEach(block => {
        if (!block.originalX) block.originalX = block.x;
        block.x = block.originalX + randomInt(-40, 40);
    });
    
    // Randomize trigger positions (±30 pixels)
    level.triggers.forEach(trigger => {
        if (trigger.condition === 'playerX') {
            if (!trigger.originalX) trigger.originalX = trigger.x;
            trigger.x = trigger.originalX + randomInt(-30, 30);
        }
    });
    
    // Randomize moving platform speeds (±20%)
    level.movingPlatforms.forEach(platform => {
        if (!platform.originalSpeed) platform.originalSpeed = platform.speed;
        platform.speed = platform.originalSpeed * (0.8 + Math.random() * 0.4);
    });
    
    // Random chance to swap fake platforms with real ones
    if (level.fakePlatforms.length > 0 && randomBool(0.3)) {
        level.fakePlatforms.forEach(fakePlat => {
            fakePlat.solid = randomBool(0.5); // 50% chance to make it real!
        });
    }
    
    // Level-specific randomization
    if (levelIndex === 1) { // Level 2: The Fake Out
        // Randomly position the fake platform between real platforms
        if (level.fakePlatforms.length > 0) {
            level.fakePlatforms[0].x = randomChoice([350, 400, 450]);
        }
    }
    
    if (levelIndex === 2) { // Level 3: Moving Troubles
        // Random spike field density (remove some spikes randomly)
        const spikeCount = level.spikes.length;
        for (let i = 0; i < spikeCount; i++) {
            if (randomBool(0.3)) { // 30% chance to remove spike
                level.spikes[i].removed = true;
            }
        }
    }
    
    if (levelIndex === 3) { // Level 4: The Trap
        // Randomly adjust disappearing platform timer (faster or slower)
        level.disappearingPlatforms.forEach(platform => {
            platform.disappearSpeed = randomChoice([0.8, 1.0, 1.3]);
        });
    }
    
    if (levelIndex === 4) { // Level 5: Devil's Playground
        // Randomly add/remove some ground spikes
        level.spikes.forEach(spike => {
            if (randomBool(0.25)) { // 25% chance to remove
                spike.removed = true;
            }
        });
        
        // Random moving platform ranges
        level.movingPlatforms.forEach(platform => {
            if (!platform.originalRange) platform.originalRange = platform.range;
            platform.range = platform.originalRange * (0.8 + Math.random() * 0.4);
        });
    }
}

// Initialize level
function loadLevel(levelIndex) {
    if (levelIndex >= levels.length) {
        alert('Congratulations! You beat all levels!');
        levelIndex = 0;
        gameState.deaths = 0;
    }
    
    const level = levels[levelIndex];
    
    // Apply randomization on each level load!
    randomizeLevel(level, levelIndex);
    
    player.x = level.playerStart.x;
    player.y = level.playerStart.y;
    player.velocityX = 0;
    player.velocityY = 0;
    player.onGround = false;
    gameState.currentLevel = levelIndex;
    gameState.gameRunning = true;
    gameState.paused = false;
    gameState.levelTimer = 0;

    // Persist last played level (for reload convenience)
    settings.lastLevel = levelIndex;
    saveSettings();
    
    // Reset all triggers and dynamic elements
    level.triggers.forEach(trigger => {
        trigger.triggered = false;
    });
    
    level.dynamicSpikes.forEach(spike => {
        spike.visible = false;
        spike.triggered = false;
    });
    
    level.fallingBlocks.forEach(block => {
        block.visible = false;
        block.triggered = false;
        block.velocityY = 0;
        block.y = -50;
    });
    
    level.disappearingPlatforms.forEach(platform => {
        platform.timer = 0;
        platform.disappearing = false;
        platform.disappeared = false;
    });
    
    // Reset fake goal
    if (level.goal.isFake) {
        level.goal.moveOnApproach = true;
        level.goal.y = level.goal.y === level.realGoalY ? 500 : level.goal.y;
    }
    
    document.getElementById('level-display').textContent = levelIndex + 1;
    document.getElementById('death-count').textContent = gameState.deaths;
    updateStatsUI();
    hideModal('game-over');
    hideModal('death-screen');
    hideModal('pause-screen');
}

// Input handling
document.addEventListener('keydown', (e) => {
    // Prevent the page from scrolling while playing (space/arrows)
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
    }
    
    gameState.keys[e.code] = true;
    
    if (e.code === 'KeyM') {
        toggleMuted();
        return;
    }

    if (e.code === 'KeyL') {
        toggleLevelSelect();
        return;
    }

    if (e.code === 'KeyC') {
        clearAllSavedData();
        return;
    }

    if (e.code === 'KeyF') {
        toggleFullscreen();
        return;
    }

    if (e.code === 'KeyV') {
        toggleReducedMotion();
        return;
    }
    
    if (e.code === 'KeyP' || e.code === 'Escape') {
        // Close level select first if it's open
        if (!document.getElementById('level-select')?.classList.contains('hidden')) {
            toggleLevelSelect(false);
            return;
        }
        togglePause();
        return;
    }
    
    if (e.code === 'KeyR') {
        if (gameState.paused) togglePause(false);
        loadLevel(gameState.currentLevel);
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
    }
    gameState.keys[e.code] = false;

    // Variable jump height: releasing jump early cuts the ascent
    if ((e.code === 'Space' || e.code === 'ArrowUp') && player.velocityY < 0) {
        player.velocityY *= 0.55;
    }
});

// Fullscreen
const fullscreenBtn = document.getElementById('fullscreen-btn');
if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => toggleFullscreen());

function isFullscreen() {
    return Boolean(document.fullscreenElement);
}

function updateFullscreenUI() {
    const btn = document.getElementById('fullscreen-btn');
    if (!btn) return;
    btn.textContent = isFullscreen() ? '⤢' : '⛶';
    btn.setAttribute('aria-label', isFullscreen() ? 'Exit fullscreen' : 'Enter fullscreen');
    btn.setAttribute('title', isFullscreen() ? 'Exit fullscreen (F)' : 'Fullscreen (F)');
}

function toggleFullscreen() {
    const container = document.querySelector('.game-container');
    if (!container) return;
    if (!document.fullscreenEnabled) return;
    
    if (!isFullscreen()) {
        container.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
}

document.addEventListener('fullscreenchange', () => {
    updateFullscreenUI();
});

// Level select
const levelSelectBtn = document.getElementById('level-select-btn');
const levelSelectModal = document.getElementById('level-select');
const levelGrid = document.getElementById('level-select-grid');

if (levelSelectBtn) levelSelectBtn.addEventListener('click', () => toggleLevelSelect());

function buildLevelSelect() {
    if (!levelGrid) return;
    if (levelGrid.childElementCount > 0) return;
    levels.forEach((lvl, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'level-tile';
        btn.innerHTML = `<div class="lvl">Level ${idx + 1}</div><div class="name">${lvl.name}</div>`;
        btn.addEventListener('click', () => {
            toggleLevelSelect(false);
            loadLevel(idx);
            setUrlLevel(idx);
        });
        levelGrid.appendChild(btn);
    });
}

function setUrlLevel(levelIndex) {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('level', String(levelIndex + 1));
        window.history.replaceState({}, '', url.toString());
    } catch {
        // ignore
    }
}

function toggleLevelSelect(forceValue) {
    buildLevelSelect();
    if (!levelSelectModal) return;

    const next = typeof forceValue === 'boolean'
        ? forceValue
        : levelSelectModal.classList.contains('hidden');

    if (next) {
        // Pause gameplay while selecting
        if (!gameState.paused) togglePause(true, { showOverlay: false });
        levelSelectModal.classList.remove('hidden');
    } else {
        levelSelectModal.classList.add('hidden');
        // Keep the game paused if the pause modal is showing; otherwise resume.
        if (!document.getElementById('pause-screen')?.classList.contains('hidden')) return;
        togglePause(false, { showOverlay: false });
    }
}

// Touch controls
function setKey(code, pressed) {
    gameState.keys[code] = pressed;
}

function bindHoldButton(btn, keyCode) {
    if (!btn) return;
    const down = (e) => {
        e.preventDefault();
        setKey(keyCode, true);
    };
    const up = (e) => {
        e.preventDefault();
        setKey(keyCode, false);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
}

function bindActionButton(btn, action) {
    if (!btn) return;
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (action === 'restart') {
            if (gameState.paused) togglePause(false);
            loadLevel(gameState.currentLevel);
        } else if (action === 'pause') {
            togglePause();
        }
    });
}

document.querySelectorAll('.touch-btn[data-key]').forEach((btn) => {
    bindHoldButton(btn, btn.getAttribute('data-key'));
});

document.querySelectorAll('.touch-btn[data-action]').forEach((btn) => {
    bindActionButton(btn, btn.getAttribute('data-action'));
});

// Pause controls
const resumeBtn = document.getElementById('resume-btn');
const restartBtn = document.getElementById('restart-btn');
const muteBtn = document.getElementById('mute-btn');

if (resumeBtn) resumeBtn.addEventListener('click', () => togglePause(false));
if (restartBtn) restartBtn.addEventListener('click', () => {
    togglePause(false);
    loadLevel(gameState.currentLevel);
});
if (muteBtn) muteBtn.addEventListener('click', () => toggleMuted());

function togglePause(forceValue, options = {}) {
    if (!gameState.gameRunning && !gameState.deathAnimation.active) return;
    if (gameState.deathAnimation.active) return;
    
    const showOverlay = options.showOverlay !== false;
    const next = typeof forceValue === 'boolean' ? forceValue : !gameState.paused;
    gameState.paused = next;
    
    if (gameState.paused) {
        if (showOverlay) showModal('pause-screen');
        else hideModal('pause-screen');
        playSound('pause');
    } else {
        hideModal('pause-screen');
        playSound('unpause');
        // Prevent instant re-trigger when unpausing with the same keydown
        gameState.keys['KeyP'] = false;
        gameState.keys['Escape'] = false;
    }
}

// Collision detection
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function checkPlatformCollision(player, platform) {
    if (checkCollision(player, platform)) {
        const playerBottom = player.y + player.height;
        const playerPrevBottom = playerBottom - player.velocityY;
        const platformTop = platform.y;
        
        // Landing on top of platform
        if (playerPrevBottom <= platformTop && player.velocityY > 0) {
            player.y = platform.y - player.height;
            player.velocityY = 0;
            player.onGround = true;
            return true;
        }
        
        // Hit from below
        if (player.y < platform.y && player.velocityY < 0) {
            player.y = platform.y + platform.height;
            player.velocityY = 0;
        }
        
        // Side collisions
        if (player.x + player.width <= platform.x + Math.abs(player.velocityX)) {
            player.x = platform.x - player.width;
            player.velocityX = 0;
        } else if (player.x >= platform.x + platform.width - Math.abs(player.velocityX)) {
            player.x = platform.x + platform.width;
            player.velocityX = 0;
        }
    }
    return false;
}

// Process triggers (LEVEL DEVIL TROLLING!)
function processTriggers() {
    const level = levels[gameState.currentLevel];
    
    level.triggers.forEach(trigger => {
        if (trigger.triggered) return;
        
        if (trigger.condition === 'playerX' && player.x > trigger.x) {
            trigger.triggered = true;
            
            if (trigger.action === 'showSpike') {
                const spike = level.dynamicSpikes[trigger.target];
                spike.visible = true;
                spike.triggered = true;
            } else if (trigger.action === 'dropBlock') {
                const block = level.fallingBlocks[trigger.target];
                block.visible = true;
                block.triggered = true;
            }
        } else if (trigger.condition === 'platformLanding') {
            // Only trigger when player lands on the specific platform
            const onCorrectPlatform = player.onGround && 
                player.x > trigger.x && 
                Math.abs(player.y + player.height - trigger.platformY) < 25;
            
            if (onCorrectPlatform) {
                trigger.triggered = true;
                
                if (trigger.action === 'showSpike') {
                    const spike = level.dynamicSpikes[trigger.target];
                    spike.visible = true;
                    spike.triggered = true;
                } else if (trigger.action === 'dropBlock') {
                    const block = level.fallingBlocks[trigger.target];
                    block.visible = true;
                    block.triggered = true;
                }
            }
        } else if (trigger.condition === 'timer' && gameState.levelTimer > trigger.time) {
            trigger.triggered = true;
            
            if (trigger.action === 'showSpike') {
                const spike = level.dynamicSpikes[trigger.target];
                spike.visible = true;
                spike.triggered = true;
            } else if (trigger.action === 'dropBlock') {
                const block = level.fallingBlocks[trigger.target];
                block.visible = true;
                block.triggered = true;
            }
        } else if (trigger.condition === 'platformTouch') {
            const platform = level.disappearingPlatforms[trigger.platformIndex];
            if (player.onGround && 
                player.x + player.width > platform.x && 
                player.x < platform.x + platform.width &&
                Math.abs(player.y + player.height - platform.y) < 5) {
                trigger.triggered = true;
                platform.disappearing = true;
            }
        }
    });
}

// Update falling blocks
function updateFallingBlocks() {
    const level = levels[gameState.currentLevel];
    
    level.fallingBlocks.forEach(block => {
        if (!block.visible) return;
        
        block.velocityY += GRAVITY;
        block.y += block.velocityY;
        
        // Check collision with player
        if (checkCollision(player, block)) {
            playerDie();
        }
        
        // Remove if off screen
        if (block.y > canvas.height) {
            block.visible = false;
        }
    });
}

// Update disappearing platforms
function updateDisappearingPlatforms() {
    const level = levels[gameState.currentLevel];
    
    level.disappearingPlatforms.forEach(platform => {
        if (platform.disappearing && !platform.disappeared) {
            const speed = platform.disappearSpeed || 1.0;
            platform.timer += speed;
            
            // Platform blinks before disappearing
            if (platform.timer > 30 && platform.timer < 60) {
                // Blinking phase
            } else if (platform.timer >= 60) {
                platform.disappeared = true;
            }
        }
    });
}

// Update fake goal (moves away when player gets close)
function updateFakeGoal() {
    const level = levels[gameState.currentLevel];
    const goal = level.goal;
    
    if (goal.isFake && goal.moveOnApproach) {
        const distanceToPlayer = Math.sqrt(
            Math.pow(player.x - goal.x, 2) + Math.pow(player.y - goal.y, 2)
        );
        
        if (distanceToPlayer < 150 && goal.y === 500) {
            // Move goal up suddenly!
            goal.y = goal.realGoalY;
            goal.moveOnApproach = false;
        }
    }
}

// Update game state
function update() {
    // Handle death animation and auto-restart
    if (gameState.deathAnimation.active) {
        gameState.deathAnimation.timer++;
        
        if (gameState.deathAnimation.timer >= gameState.deathAnimation.maxTime) {
            gameState.deathAnimation.active = false;
            loadLevel(gameState.currentLevel);
        }
        return;
    }
    
    if (!gameState.gameRunning) return;
    if (gameState.paused) return;
    
    const level = levels[gameState.currentLevel];
    
    // Increment level timer for time-based triggers
    gameState.levelTimer++;
    
    // Process dynamic triggers
    processTriggers();
    updateFallingBlocks();
    updateDisappearingPlatforms();
    updateFakeGoal();
    
    // Jump buffer countdown
    if (gameState.jumpBuffer > 0) gameState.jumpBuffer--;
    
    // Player movement
    player.velocityX = 0;
    if (gameState.keys['ArrowLeft']) {
        player.velocityX = -MOVE_SPEED;
    }
    if (gameState.keys['ArrowRight']) {
        player.velocityX = MOVE_SPEED;
    }
    
    // Jumping
    const jumpPressed = gameState.keys['Space'] || gameState.keys['ArrowUp'];
    if (jumpPressed) {
        gameState.jumpBuffer = 6; // ~100ms at 60fps
        gameState.keys['Space'] = false;
        gameState.keys['ArrowUp'] = false;
    }
    
    if (gameState.jumpBuffer > 0 && (player.onGround || player.coyoteTimer > 0)) {
        player.velocityY = JUMP_FORCE;
        player.onGround = false;
        player.coyoteTimer = 0;
        gameState.jumpBuffer = 0;
        playSound('jump');
    }
    
    // Apply gravity
    player.velocityY += GRAVITY;
    
    // Update position
    player.x += player.velocityX;
    player.y += player.velocityY;
    
    // Check ground
    player.onGround = false;
    
    // Check platform collisions
    level.platforms.forEach(platform => {
        if (platform.solid) {
            checkPlatformCollision(player, platform);
        }
    });
    
    // Check fake platform collisions (if randomized to be solid)
    level.fakePlatforms.forEach(platform => {
        if (platform.solid) {
            checkPlatformCollision(player, platform);
        }
    });
    
    // Check moving platform collisions
    level.movingPlatforms.forEach(platform => {
        if (checkPlatformCollision(player, platform)) {
            // Move player with platform
            if (platform.axis === 'x') {
                player.x += platform.speed * platform.direction;
            } else if (platform.axis === 'y') {
                // For vertical platforms, move player up/down with platform
                player.y += platform.speed * platform.direction;
            }
        }
        
        // Update moving platform position
        if (platform.axis === 'x') {
            platform.x += platform.speed * platform.direction;
            if (Math.abs(platform.x - platform.startX) > platform.range) {
                platform.direction *= -1;
            }
        } else {
            platform.y += platform.speed * platform.direction;
            if (Math.abs(platform.y - platform.startY) > platform.range) {
                platform.direction *= -1;
            }
        }
    });
    
    // Check spike collisions
    level.spikes.forEach(spike => {
        if (!spike.removed && checkCollision(player, spike)) {
            playerDie();
        }
    });
    
    // Check dynamic spike collisions
    level.dynamicSpikes.forEach(spike => {
        if (spike.visible && checkCollision(player, spike)) {
            playerDie();
        }
    });
    
    // Check disappearing platform collisions
    level.disappearingPlatforms.forEach(platform => {
        if (!platform.disappeared) {
            checkPlatformCollision(player, platform);
        }
    });

    // Coyote time (a few frames of grace after leaving ground)
    if (player.onGround) {
        player.coyoteTimer = 6;
    } else if (player.coyoteTimer > 0) {
        player.coyoteTimer--;
    }
    
    // Check goal collision
    if (checkCollision(player, level.goal)) {
        levelComplete();
    }
    
    // Boundaries
    if (player.y > canvas.height) {
        playerDie();
    }
    
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
}

// Player death
function playerDie() {
    gameState.deaths++;
    gameState.gameRunning = false;
    playSound('death');
    
    // Store death position and activate death animation
    gameState.deathAnimation.active = true;
    gameState.deathAnimation.x = player.x;
    gameState.deathAnimation.y = player.y;
    gameState.deathAnimation.timer = 0;
    
    // Update death counter display immediately
    document.getElementById('death-count').textContent = gameState.deaths;
}

// Level complete
function levelComplete() {
    gameState.gameRunning = false;
    showModal('game-over');
    playSound('complete');

    // Persist best time for this level
    const elapsedMs = Math.round((gameState.levelTimer / 60) * 1000);
    const levelKey = String(gameState.currentLevel);
    const prevBest = persistentStats.bestLevelTimesMs[levelKey];
    if (typeof prevBest !== 'number' || elapsedMs < prevBest) {
        persistentStats.bestLevelTimesMs[levelKey] = elapsedMs;
        saveStats();
        updateStatsUI();
    }

    // If this was the final level, persist best run deaths
    if (gameState.currentLevel === levels.length - 1) {
        const prevRunBest = persistentStats.bestRunDeaths;
        if (typeof prevRunBest !== 'number' || gameState.deaths < prevRunBest) {
            persistentStats.bestRunDeaths = gameState.deaths;
            saveStats();
            updateStatsUI();
        }
    }
    
    setTimeout(() => {
        if (gameState.keys['Space']) {
            loadLevel(gameState.currentLevel + 1);
        }
    }, 100);
}

// Modal functions
function showModal(id) {
    document.getElementById(id).classList.remove('hidden');
    
    // Only some modals advance on SPACE
    if (id !== 'game-over' && id !== 'death-screen') return;
    
    const modalHandler = (e) => {
        if (e.code === 'Space') {
            if (id === 'game-over') {
                loadLevel(gameState.currentLevel + 1);
            } else if (id === 'death-screen') {
                loadLevel(gameState.currentLevel);
            }
            document.removeEventListener('keydown', modalHandler);
        }
    };
    
    document.addEventListener('keydown', modalHandler);
}

function hideModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// Render
function draw() {
    const level = levels[gameState.currentLevel];
    
    // Clear canvas
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw platforms
    level.platforms.forEach(platform => {
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
    });
    
    // Draw fake platforms (look real but you fall through... or maybe not!)
    level.fakePlatforms.forEach(platform => {
        // If randomized to be solid, show slightly different color
        if (platform.solid) {
            ctx.fillStyle = '#34495e'; // Look like real platform
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 2;
            ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
        } else {
            ctx.fillStyle = platform.color;
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 2;
            ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
        }
    });
    
    // Draw moving platforms
    level.movingPlatforms.forEach(platform => {
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.strokeStyle = '#8e44ad';
        ctx.lineWidth = 3;
        ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
    });
    
    // Draw spikes
    level.spikes.forEach(spike => {
        if (!spike.removed) {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            for (let i = 0; i < spike.width; i += 20) {
                ctx.moveTo(spike.x + i, spike.y + spike.height);
                ctx.lineTo(spike.x + i + 10, spike.y);
                ctx.lineTo(spike.x + i + 20, spike.y + spike.height);
            }
            ctx.closePath();
            ctx.fill();
        }
    });
    
    // Draw dynamic spikes (appear suddenly!)
    level.dynamicSpikes.forEach(spike => {
        if (spike.visible) {
            ctx.fillStyle = '#ff0000';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            for (let i = 0; i < spike.width; i += 20) {
                ctx.moveTo(spike.x + i, spike.y + spike.height);
                ctx.lineTo(spike.x + i + 10, spike.y);
                ctx.lineTo(spike.x + i + 20, spike.y + spike.height);
            }
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    });
    
    // Draw falling blocks
    level.fallingBlocks.forEach(block => {
        if (block.visible) {
            ctx.fillStyle = block.color;
            ctx.fillRect(block.x, block.y, block.width, block.height);
            ctx.strokeStyle = '#d35400';
            ctx.lineWidth = 3;
            ctx.strokeRect(block.x, block.y, block.width, block.height);
            
            // Draw warning lines
            ctx.strokeStyle = 'rgba(230, 126, 34, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(block.x + block.width / 2, 0);
            ctx.lineTo(block.x + block.width / 2, block.y);
            ctx.stroke();
        }
    });
    
    // Draw disappearing platforms
    level.disappearingPlatforms.forEach(platform => {
        if (!platform.disappeared) {
            // Blinking effect when disappearing
            if (!settings.reducedMotion && platform.disappearing && platform.timer > 30) {
                const blinkFrequency = Math.floor(platform.timer / 5);
                if (blinkFrequency % 2 === 0) {
                    ctx.globalAlpha = 0.3;
                }
            }
            
            ctx.fillStyle = platform.color;
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 2;
            ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
            ctx.globalAlpha = 1.0;
        }
    });
    
    // Draw goal
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(level.goal.x, level.goal.y, level.goal.width, level.goal.height);
    ctx.fillStyle = '#27ae60';
    ctx.font = '20px Arial';
    ctx.fillText('🚪', level.goal.x + 8, level.goal.y + 28);
    
    // Draw player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.strokeStyle = '#2980b9';
    ctx.lineWidth = 3;
    ctx.strokeRect(player.x, player.y, player.width, player.height);
    
    // Draw eyes
    ctx.fillStyle = 'white';
    ctx.fillRect(player.x + 8, player.y + 8, 6, 6);
    ctx.fillRect(player.x + 16, player.y + 8, 6, 6);
    ctx.fillStyle = 'black';
    ctx.fillRect(player.x + 10, player.y + 10, 3, 3);
    ctx.fillRect(player.x + 18, player.y + 10, 3, 3);
    
    // Draw death animation indicator
    if (gameState.deathAnimation.active) {
        const deathX = gameState.deathAnimation.x;
        const deathY = gameState.deathAnimation.y;
        const progress = gameState.deathAnimation.timer / gameState.deathAnimation.maxTime;
        
        // Pulsating red X effect (optional for reduced motion)
        const pulseScale = settings.reducedMotion ? 1 : (1 + Math.sin(progress * Math.PI * 8) * 0.3);
        const opacity = 1 - progress; // Fade out
        
        ctx.save();
        ctx.globalAlpha = opacity;
        
        // Red square background
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(deathX, deathY, PLAYER_SIZE, PLAYER_SIZE);
        
        // Draw X mark
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4 * pulseScale;
        ctx.lineCap = 'round';
        
        // First diagonal \
        ctx.beginPath();
        ctx.moveTo(deathX + 5, deathY + 5);
        ctx.lineTo(deathX + PLAYER_SIZE - 5, deathY + PLAYER_SIZE - 5);
        ctx.stroke();
        
        // Second diagonal /
        ctx.beginPath();
        ctx.moveTo(deathX + PLAYER_SIZE - 5, deathY + 5);
        ctx.lineTo(deathX + 5, deathY + PLAYER_SIZE - 5);
        ctx.stroke();
        
        // Death text
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('☠', deathX + PLAYER_SIZE / 2, deathY - 10);
        
        ctx.restore();
    }
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Get level from URL parameter (e.g., ?level=3)
function getStartLevel() {
    const urlParams = new URLSearchParams(window.location.search);
    const levelParam = urlParams.get('level');
    
    if (levelParam !== null) {
        const levelNum = parseInt(levelParam, 10);
        // Level numbers are 1-based in URL (level=1), but 0-based in array
        const levelIndex = levelNum - 1;
        
        if (levelIndex >= 0 && levelIndex < levels.length) {
            console.log(`Starting at Level ${levelNum} (${levels[levelIndex].name})`);
            return levelIndex;
        } else {
            console.warn(`Invalid level ${levelNum}. Starting at Level 1.`);
            return 0;
        }
    }
    return 0; // Default to first level
}

// Start game
loadLevel(getStartLevel());
updateStatsUI();
updateMuteUI();
updateFullscreenUI();
gameLoop();

