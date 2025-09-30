import { CONFIG } from './Config.js';

// The single source of truth for the game's dynamic state.
export const gameState = {
    isPaused: false,
    isMultiplayer: false,
    audioInitialized: false,

    // Lap & Timing
    currentLap: 1,
    totalLaps: CONFIG.TOTAL_LAPS,
    startTime: 0,
    lapStartTime: 0,
    lapTimes: [],
    bestLapTime: Infinity,
    previousT: 0, // For lap detection

    // Input
    keys: {},

    // Network
    networkManager: null,
    remotePlayers: new Map(),
};