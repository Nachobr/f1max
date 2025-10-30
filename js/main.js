import { GameInitializer, setupMenuNavigation, loadTrackByName } from './GameInitializer.js';
import { togglePause } from './GameStateManager.js';

// Global initialization
let gameInitializer;


document.addEventListener('DOMContentLoaded', async () => {
    window.gameInitializer = gameInitializer;

    window.cameraManager = gameInitializer.cameraManager;
    // Setup menu navigation
    setupMenuNavigation(gameInitializer);

    // Setup touch device UI
    if ('ontouchstart' in window) {
        const touchControls = document.getElementById('touch-controls');
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');

        if (touchControls) touchControls.style.display = 'block';
        if (mobileMenuToggle) mobileMenuToggle.style.display = 'block';
    }

    console.log('🚀 Game initialized with modular architecture');
});

// Global exports for HTML onclick handlers
window.toggleCamera = () => {
    if (window.cameraManager) {
        window.cameraManager.toggleCamera();
    }
};

window.loadTrackByName = loadTrackByName;
window.togglePause = togglePause;


// Make gameInitializer globally available for debugging
window.gameInitializer = () => gameInitializer;