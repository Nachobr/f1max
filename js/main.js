import { setupMenuNavigation, loadTrackByName } from './GameInitializer.js';
import { togglePause } from './GameStateManager.js';
import { GameInitializer } from './GameInitializer.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    window.gameInitializer = new GameInitializer();
    
    // Setup menu navigation
    setupMenuNavigation(window.gameInitializer);

    // Setup touch device UI
    if ('ontouchstart' in window) {
        const touchControls = document.getElementById('touch-controls');
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');

        if (touchControls) touchControls.style.display = 'block';
        if (mobileMenuToggle) mobileMenuToggle.style.display = 'block';
    }

    //console.log('🚀 Game initialized with modular architecture');
});

// Global exports for HTML onclick handlers
window.toggleCamera = () => {
    // ✅ DEFENSIVE: Check if global reference exists
    if (window.cameraManager) {
        window.cameraManager.toggleCamera();
    } else {
        console.warn('❌ CameraManager not available');
    }
};

window.loadTrackByName = loadTrackByName;
window.togglePause = togglePause;


window.gameInitializerInstance = window.gameInitializer;