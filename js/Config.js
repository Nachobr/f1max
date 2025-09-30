export const CONFIG = {
    // Scene & Renderer
    PLAYER_COLOR: 0xff4400,
    REMOTE_COLOR: 0x00aaff,
    GROUND_COLOR: 0x4a7c59,
    BACKGROUND_COLOR: 0x222222,

    // Game Rules
    TOTAL_LAPS: 5,

    // Networking
    SERVER_URL: 'ws://localhost:8080', // <-- CHANGE FOR PRODUCTION
    INPUT_SEND_RATE_HZ: 12, // Send input 12 times per second

    // Audio
    DEFAULT_VOLUME: 0.5,

    // Physics (Example - you can move more constants here)
    MAX_SPEED: 3.0,
};

export const TRACKS = [
    'Track1',
    'Track2',
    'Track3',
];