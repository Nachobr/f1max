import { gameState } from './State.js';
import { CONFIG } from './Config.js';
import { togglePause } from './GameStateManager.js'; // ✅ FIXED: Added missing import

export class InputManager {
    constructor() {
        this.keydownHandler = null;
        this.keyupHandler = null;
        this.gameState = gameState;
        this.isTouchDevice = 'ontouchstart' in window;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.isTouching = false;
        this.gyroControls = null;
        this.initBound = false;
        this.uiManager = null;
        this.audioManager = null;
        this.cameraManager = null;
    }

    init(uiManager, audioManager, cameraManager) {
        if (this.initBound) {
            console.warn('InputManager already initialized, skipping');
            return;
        }

        this.uiManager = uiManager;
        this.audioManager = audioManager;
        this.cameraManager = cameraManager;

        this.keydownHandler = (event) => this.handleKeyDown(event);
        this.keyupHandler = (event) => this.handleKeyUp(event);

        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);

        // Touch controls
        if (this.isTouchDevice) {
            this.setupTouchControls();
        }

        // Gyroscope controls
        this.setupGyroscope();

        this.initBound = true;
        console.log('✅ InputManager initialized');
    }

    handleKeyDown(event) {
        const key = event.key.toLowerCase();
        
        // ✅ DEFENSIVE: Check if gameState.keys exists
        if (!gameState.keys) {
            gameState.keys = {};
        }
        
        gameState.keys[key] = true;

        // ✅ FIXED: Process pause key FIRST, before checking isPaused
        if (key === 'escape' || key === 'p') {
            togglePause();
            return; // Don't process other keys when pausing/unpausing
        }
        
        // ✅ Now check if paused for other keys
        if (gameState.isPaused) return;

        if (key === 'c') {
            window.cameraManager?.toggleCamera();
        } else if (key === 'm') {
            this.audioManager?.toggleMute();
        }
    }

    handleKeyUp(event) {
        const key = event.key.toLowerCase();
        
        // ✅ DEFENSIVE: Check if gameState.keys exists
        if (gameState.keys) {
            gameState.keys[key] = false;
        }
    }

    getInputState() {
        // ✅ DEFENSIVE: Ensure keys object exists
        if (!gameState.keys) {
            gameState.keys = {};
        }

        // ✅ ORIGINAL LOGIC: Return keys object directly
        let inputState = { ...gameState.keys };

        // ✅ Apply touch/gyro overrides
        if (this.isTouchDevice && this.touchControls) {
            inputState['w'] = this.touchControls.buttons.throttle.pressed;
            inputState['s'] = this.touchControls.buttons.brake.pressed;

            let steer = 0;
            if (this.gyroControls && this.gyroControls.enabled) {
                steer = this.gyroControls.getSteering();
            } else {
                steer = this.touchControls.joystick.horizontal;
            }

            inputState['a'] = steer < -0.2;
            inputState['d'] = steer > 0.2;
        }

        return inputState;
    }

    getGyroSteering() {
        return this.gyroControls;
    }

    setupTouchControls() {
        const canvas = renderer.domElement;

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.isTouching = true;
            this.touchStartX = e.touches[0].clientX;
            this.touchCurrentX = this.touchStartX;
            this.touchStartY = e.touches[0].clientY;
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.touchCurrentX = e.touches[0].clientX;
        });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.isTouching = false;
        });
    }

    setupGyroscope() {
        if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+
            document.getElementById('enable-gyro-button')?.addEventListener('click', async () => {
                try {
                    const response = await DeviceOrientationEvent.requestPermission();
                    if (response === 'granted') {
                        window.addEventListener('deviceorientation', (event) => {
                            this.gyroControls = event.gamma * 0.02;
                        });
                    }
                } catch (error) {
                    console.warn('Gyroscope permission denied:', error);
                }
            });
        } else if ('DeviceOrientationEvent' in window) {
            // Non iOS 13+
            window.addEventListener('deviceorientation', (event) => {
                this.gyroControls = event.gamma * 0.02;
            });
        }
    }

    // ✅ FIXED: Made async and properly clears all state
    async cleanup() {
        console.log('⌨️ InputManager async cleanup...');
        
        // Remove event listeners
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
        if (this.keyupHandler) {
            document.removeEventListener('keyup', this.keyupHandler);
            this.keyupHandler = null;
        }

        // Clear game state keys
        if (this.gameState?.keys) {
            this.gameState.keys = {};
        }

        // Reset touch and gyro state
        this.isTouching = false;
        this.touchStartX = 0;
        this.touchCurrentX = 0;
        this.gyroControls = null;
        this.initBound = false;

        // Clear references
        this.uiManager = null;
        this.audioManager = null;
        this.cameraManager = null;

        // Small delay to ensure event loop processes removal
        await new Promise(resolve => setTimeout(resolve, 0));
        
        console.log('✅ InputManager cleanup complete');
    }
}