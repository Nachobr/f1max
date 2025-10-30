import { gameState } from './State.js';
import { GyroControls } from './GyroControls.js';
import { TouchControls } from './TouchControls.js';
import { togglePause } from './GameStateManager.js';

export class InputManager {
    constructor() {
        this.gyroControls = null;
        this.touchControls = null;
        this.keydownHandler = null;
        this.keyupHandler = null;
        this.isTouchDevice = 'ontouchstart' in window;
        this.cameraManager = null;
        this.uiManager = null;
    }

    init(uiManager, audioManager, cameraManager) {
        this.uiManager = uiManager;
        this.cameraManager = cameraManager;
        this.gyroControls = new GyroControls();
        this.touchControls = new TouchControls('touch-controls');

        // Make available globally
        window.gyroControls = this.gyroControls;

        this.setupKeyboardInput();
        this.setupTouchInput();
        this.setupGyroInput();

        if (this.isTouchDevice) {
            this.setupMobileControls(audioManager);
        }
    }

    setupKeyboardInput() {
        this.keydownHandler = e => {
            
            const key = e.key.toLowerCase();
            gameState.keys[key] = true;

            if (key === 'p') togglePause();

            if (key === 'c') {
                console.log('⌨️ C key pressed');

                // ALWAYS use window.cameraManager since we know it works
                if (window.cameraManager) {
                    window.cameraManager.toggleCamera();
                    window.cameraManager.update();

                    if (window.updateCameraHUDText) {
                        window.updateCameraHUDText();
                    }
                } else {
                    console.warn('❌ window.cameraManager not available');
                }
            }

            // Debug keys
            if (key === 'm' && window.memoryMonitor) {
                window.memoryMonitor.debugMemoryUsage();
            }
            if (key === 'l' && window.memoryMonitor) {
                window.memoryMonitor.forceCleanup();
            }
        };

        this.keyupHandler = e => {
            gameState.keys[e.key.toLowerCase()] = false;
        };

        window.addEventListener("keydown", this.keydownHandler);
        window.addEventListener("keyup", this.keyupHandler);


    }

    setupTouchInput() {
        if (!this.isTouchDevice || !this.uiManager) return;

        const handleButtonClick = (button, callback) => {
            if (!button) return;
            button.addEventListener('click', callback);
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                callback();
            }, { passive: false });
        };

        handleButtonClick(this.uiManager.resumeButton, () => togglePause());
        handleButtonClick(document.getElementById('mute-button'), () => {
            if (window.audioManager) window.audioManager.toggleMute();
        });
    }

    setupGyroInput() {
        this.setupGyroToggle();
        this.setupGyroSensitivity();
        this.setupGyroCalibration();
        this.setupTiltModeToggle();
    }

    setupGyroToggle() {
        const mobileGyroToggle = document.getElementById('mobile-gyro-toggle');
        if (!mobileGyroToggle) return;

        mobileGyroToggle.addEventListener('change', async (e) => {
            await this.handleGyroToggle(e.target.checked);
        });
    }

    async handleGyroToggle(shouldEnable) {
        if (!this.gyroControls) return;

        if (shouldEnable) {
            const success = await this.gyroControls.enable();
            if (success) {
                this.touchControls.hideJoystick();
                this.showControlNotification('Tilt Steering Enabled - Tilt device to steer');
                // Clear residual steering input
                gameState.keys['a'] = false;
                gameState.keys['d'] = false;
            } else {
                document.getElementById('mobile-gyro-toggle').checked = false;
                this.showControlNotification('Gyro Access Denied - Using touch controls');
                this.touchControls.showJoystick();
            }
        } else {
            this.gyroControls.disable();
            this.touchControls.showJoystick();
            this.showControlNotification('Touch Steering Enabled');
            gameState.keys['a'] = false;
            gameState.keys['d'] = false;
        }
    }

    setupGyroSensitivity() {
        const mobileSensitivity = document.getElementById('mobile-gyro-sensitivity');
        if (!mobileSensitivity) return;

        mobileSensitivity.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (this.gyroControls) {
                this.gyroControls.setSensitivity(value);
            }
            document.getElementById('mobile-sensitivity-value').textContent = value.toFixed(1);
        });
    }

    setupGyroCalibration() {
        const mobileCalibrate = document.getElementById('mobile-gyro-calibrate');
        if (!mobileCalibrate) return;

        mobileCalibrate.addEventListener('click', () => {
            if (this.gyroControls) this.gyroControls.calibrate();
        });

        mobileCalibrate.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.gyroControls) this.gyroControls.calibrate();
        });
    }

    setupTiltModeToggle() {
        const mobileTiltMode = document.getElementById('mobile-tilt-mode');
        if (!mobileTiltMode) return;

        mobileTiltMode.addEventListener('click', () => {
            if (this.gyroControls) {
                this.gyroControls.toggleTiltMode();
                const currentMode = this.gyroControls.tiltMode === 'gamma' ? 'Left-Right' : 'Front-Back';
                mobileTiltMode.textContent = 'Tilt Mode: ' + currentMode;
            }
        });

        mobileTiltMode.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.gyroControls) {
                this.gyroControls.toggleTiltMode();
                const currentMode = this.gyroControls.tiltMode === 'gamma' ? 'Left-Right' : 'Front-Back';
                mobileTiltMode.textContent = 'Tilt Mode: ' + currentMode;
            }
        });
    }

    setupMobileControls() {
        if (!this.uiManager) return;

        // Setup mobile-specific control handlers
        const debugMemoryButton = document.getElementById('debug-memory');
        if (debugMemoryButton) {
            this.setupButtonHandler(debugMemoryButton, () => {
                if (window.memoryMonitor) window.memoryMonitor.debugMemoryUsage();
            });
        }

        const cleanupMemoryButton = document.getElementById('cleanup-memory');
        if (cleanupMemoryButton) {
            this.setupButtonHandler(cleanupMemoryButton, () => {
                if (window.memoryMonitor) window.memoryMonitor.forceCleanup();
            });
        }

        if (this.uiManager.editorButton) {
            this.setupButtonHandler(this.uiManager.editorButton, () => {
                window.open('trackEditor.html', '_blank');
            });
        }
    }

    setupButtonHandler(button, callback) {
        if (!button) return;

        button.addEventListener('click', callback);
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            callback();
        }, { passive: false });
    }

    getInputState() {
        let inputState = { ...gameState.keys };

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
        return (this.gyroControls && this.gyroControls.enabled) ?
            this.gyroControls.getSteering() : null;
    }

    showControlNotification(message) {
        let notification = document.getElementById('control-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'control-notification';
            notification.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 1000;
                font-family: Arial, sans-serif;
                font-size: 16px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s;
            `;
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.style.opacity = '1';

        setTimeout(() => {
            notification.style.opacity = '0';
        }, 2000);
    }

    cleanup() {
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.keyupHandler) {
            document.removeEventListener('keyup', this.keyupHandler);
        }

        // Remove touch event listeners
        if (this.touchEventListeners) {
            this.touchEventListeners.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
        }

        // Remove gyro event listeners
        if (this.gyroHandler && window.DeviceOrientationEvent) {
            window.removeEventListener('deviceorientation', this.gyroHandler);
        }

        this.uiManager = null;
    }

    // For external camera control
    setCameraToggleCallback(callback) {
        this.toggleCameraCallback = callback;
    }
}