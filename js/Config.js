export const CONFIG = {
    // Scene & Renderer
    PLAYER_COLOR: 0xff4400,
    REMOTE_COLOR: 0x00aaff,
    GROUND_COLOR: 0x4a7c59,
    BACKGROUND_COLOR: 0x222222,

    // Game Rules
    TOTAL_LAPS: 5,

    // Networking
    SERVER_URL: 'ws://192.168.100.58:8080', // <-- CHANGE FOR PRODUCTION
    INPUT_SEND_RATE_HZ: 12, // Send input 12 times per second

    // Audio
    DEFAULT_VOLUME: 1.5,

    // Physics
    MAX_SPEED: 3.0,

    // NEW: Kerb Physics
    KERB_SLOWDOWN_STRAIGHT: 0.98,    // Minimal speed loss when going straight
    KERB_SLOWDOWN_TURNING: 0.92,     // Significant speed loss when turning
    KERB_HANDLING_REDUCTION: 0.3,    // Temporary handling reduction
    KERB_EFFECT_DURATION: 0.3,       // How long kerb effects last (seconds)
};

export const TRACKS = [
    'Mexico GP',
    'Monza Standard',
    'Track2',
    'Track3'
];