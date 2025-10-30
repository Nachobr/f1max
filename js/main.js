import * as THREE from 'three';
import { scene, camera, renderer } from './SceneSetup.js';
import { gameState } from './State.js';
import { CONFIG } from './Config.js';
import { UIManager } from './UIManager.js';
import { AudioManager } from './AudioManager.js';
import { initGameManager, loadTrackAndRestart, checkLapCompletion, togglePause, setRenderer } from './GameManager.js';
import { NetworkManager } from './NetworkManager.js';
import { createF1Car } from './CarModel.js';
import { carState, updatePhysics } from './CarPhysics.js';
import { trackData, roadHalfWidth } from './TrackBuilder.js';
import { getAvailableTracks } from './Utils.js';
import { TouchControls } from './TouchControls.js';
import { CameraManager } from './CameraManager.js';
import { MemoryMonitor, getMemoryStatus } from './MemoryMonitor.js';
import { TextureManager } from './TextureManager.js';
import { GyroControls } from './GyroControls.js';

// Global variables
let gyroControls;
let cameraManager;
let audioManager, networkManager, uiManager, touchControls, player;
let memoryMonitor, textureManager;
let gameStarted = false;
let isTouchDevice = 'ontouchstart' in window;
let keydownHandler, keyupHandler;
let lastTurnDirection = 0;

let lastPhysicsUpdateTime = 0;
const physicsTimeStep = 1000 / 60;
let accumulatedPhysicsTime = 0;

// --- INTERPOLATION ---
const prevCarPosition = new THREE.Vector3();
const prevCarRotation = new THREE.Euler(0, 0, 0);
const currentCarPosition = new THREE.Vector3();
const currentCarRotation = new THREE.Euler(0, 0, 0);

const CAR_Y_OFFSET = 0.8;

export async function initGame(trackName = 'Monza Standard', isMultiplayer = false) {
    gameStarted = false;
    gameState.isMultiplayer = isMultiplayer;
    gyroControls = new GyroControls();

    // Add this line to make it available globally
    window.gyroControls = gyroControls;
    // Initialize memory monitoring system
    memoryMonitor = new MemoryMonitor(renderer, scene);
    textureManager = new TextureManager(renderer);

    //console.log('🎮 Memory monitoring system initialized');

    try {
        const car = await createF1Car();
        player = car.model;
        gameState.playerParts = car.parts;
    } catch (error) {
        console.warn('Error creating car, using default:', error);
        const car = await createF1Car();
        player = car.model;
        gameState.playerParts = car.parts;
    }
    player.name = "playerCar";
    scene.add(player);
    cameraManager = new CameraManager(camera, player);

    audioManager = new AudioManager(camera, player);

    if (gameState.isMultiplayer) {
        networkManager = new NetworkManager();
        await networkManager.connect();
    } else {
        networkManager = null;
    }

    uiManager = new UIManager(networkManager);
    touchControls = new TouchControls('touch-controls');
    initGameManager(uiManager, audioManager, networkManager);
    gameState.networkManager = networkManager;
    setRenderer(renderer);
    // --- INPUT EVENT LISTENERS ---
    keydownHandler = e => {
        const key = e.key.toLowerCase();
        gameState.keys[key] = true;
        if (key === 'p') togglePause();
        if (key === 'c') cameraManager.toggleCamera();

        // Debug keys for memory monitoring
        if (key === 'm' && memoryMonitor) {
            // console.log('🔍 Manual memory check triggered');
            memoryMonitor.debugMemoryUsage();
        }
        if (key === 'l' && memoryMonitor) {
            // console.log('🧹 Manual cleanup triggered');
            memoryMonitor.forceCleanup();
        }
    };

    keyupHandler = e => {
        gameState.keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", keydownHandler);
    window.addEventListener("keyup", keyupHandler);

    const handleButtonClick = (button, callback) => {
        if (!button) return;
        button.addEventListener('click', callback);
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            callback();
        }, { passive: false });
    };

    handleButtonClick(uiManager.resumeButton, () => togglePause());
    handleButtonClick(document.getElementById('mute-button'), () => audioManager.toggleMute());

    // Gyro toggle event listeners
    function showControlNotification(message) {
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


    const mobileGyroToggle = document.getElementById('mobile-gyro-toggle');


    if (mobileGyroToggle) {
        console.log('🎮 Setting up gyro toggle listeners');

        const handleGyroToggle = async (shouldEnable) => {
            console.log('🎮 Gyro toggle changed to:', shouldEnable);

            if (gyroControls) {
                if (shouldEnable) {
                    console.log('🎮 Attempting to enable gyro...');
                    const success = await gyroControls.enable();
                    if (success) {
                        console.log('🎮 Gyro enabled successfully');
                        if (touchControls) {
                            touchControls.hideJoystick();
                        }
                        showControlNotification('Tilt Steering Enabled - Tilt device to steer');

                        // Clear any residual steering input
                        gameState.keys['a'] = false;
                        gameState.keys['d'] = false;
                    } else {
                        mobileGyroToggle.checked = false;
                        showControlNotification('Gyro Access Denied - Using touch controls');
                        if (touchControls) {
                            touchControls.showJoystick();
                        }
                    }
                } else {
                    console.log('🎮 Disabling gyro...');
                    gyroControls.disable();
                    if (touchControls) {
                        touchControls.showJoystick();
                    }
                    showControlNotification('Touch Steering Enabled');

                    // Clear steering input
                    gameState.keys['a'] = false;
                    gameState.keys['d'] = false;
                }
            } else {
                console.error('❌ gyroControls not available');
                mobileGyroToggle.checked = false;
            }
        };

        // Mobile → Main
        mobileGyroToggle.addEventListener('change', function (e) {

            handleGyroToggle(e.target.checked);
        });

        // Main → Mobile

    } else {
        console.warn('❌ Gyro toggle elements not found:', {

            mobile: !!mobileGyroToggle
        });
    }

    const mobileSensitivity = document.getElementById('mobile-gyro-sensitivity');
    const mobileCalibrate = document.getElementById('mobile-gyro-calibrate');

    if (mobileSensitivity) {
        mobileSensitivity.addEventListener('input', function (e) {
            const value = parseFloat(e.target.value);
            if (gyroControls) {
                gyroControls.setSensitivity(value);
            }
            document.getElementById('mobile-sensitivity-value').textContent = value.toFixed(1);
        });
    }

    // SIMPLIFIED: Just use click/touch for calibration
    if (mobileCalibrate) {
        mobileCalibrate.addEventListener('click', function () {
            if (gyroControls) {
                gyroControls.calibrate();
            }
        });

        mobileCalibrate.addEventListener('touchstart', function (e) {
            e.preventDefault();
            if (gyroControls) {
                gyroControls.calibrate();
            }
        });
    }

    const mobileTiltMode = document.getElementById('mobile-tilt-mode');

    if (mobileTiltMode) {
        mobileTiltMode.addEventListener('click', function () {
            if (gyroControls) {
                gyroControls.toggleTiltMode();
                // Update button text
                const currentMode = gyroControls.tiltMode === 'gamma' ? 'Left-Right' : 'Front-Back';
                mobileTiltMode.textContent = 'Tilt Mode: ' + currentMode;
            }
        });

        mobileTiltMode.addEventListener('touchstart', function (e) {
            e.preventDefault();
            if (gyroControls) {
                gyroControls.toggleTiltMode();
                const currentMode = gyroControls.tiltMode === 'gamma' ? 'Left-Right' : 'Front-Back';
                mobileTiltMode.textContent = 'Tilt Mode: ' + currentMode;
            }
        });
    }

    // Add memory debug button if available in UI
    const debugMemoryButton = document.getElementById('debug-memory');
    if (debugMemoryButton) {
        handleButtonClick(debugMemoryButton, () => {
            if (memoryMonitor) memoryMonitor.debugMemoryUsage();
        });
    }

    const cleanupMemoryButton = document.getElementById('cleanup-memory');
    if (cleanupMemoryButton) {
        handleButtonClick(cleanupMemoryButton, () => {
            if (memoryMonitor) memoryMonitor.forceCleanup();
        });
    }

    if (uiManager.editorButton) {
        handleButtonClick(uiManager.editorButton, () => {
            window.open('trackEditor.html', '_blank');
        });
    }

    if (gameState.isMultiplayer && networkManager) {
        handleButtonClick(uiManager.createRoomButton, () => {
            const playerName = uiManager.playerNameInput.value || 'Player';
            const selectedTrack = uiManager.trackSelectNetwork.value;
            networkManager.createRoom(playerName, selectedTrack);
        });

        handleButtonClick(uiManager.joinRoomButton, () => {
            const playerName = uiManager.playerNameInput.value || 'Player';
            const roomId = uiManager.roomIdInput.value;
            networkManager.joinRoom(roomId, playerName);
        });

        handleButtonClick(uiManager.startGameButton, () => networkManager.startGame());

        // Network event handlers...
        networkManager.addEventListener('roomJoined', (event) => {
            const { roomId, players, track, hostId } = event.detail;
            gameState.isMultiplayer = !networkManager.singlePlayerMode;
            uiManager.showWaitingForPlayersScreen(roomId, players, hostId, networkManager.clientId);
            loadTrackAndRestart(track, scene, camera, player);

            if (networkManager.singlePlayerMode) {
                setTimeout(() => networkManager.startGame(), 500);
            }
        });

        networkManager.addEventListener('playerListUpdated', (event) => {
            const { players, hostId } = event.detail;
            uiManager.updatePlayerList(players, hostId);
            uiManager.updateStartButtonVisibility(hostId, networkManager.clientId);
        });

        networkManager.addEventListener('gameStarted', () => {
            uiManager.hideWaitingScreen();
            if (!gameState.audioInitialized) {
                audioManager.init().then(() => audioManager.startEngine());
            } else {
                audioManager.startEngine();
            }

            if (!gameStarted) {
                gameStarted = true;
                prevCarPosition.copy(carState.position);
                currentCarPosition.copy(carState.position);
                prevCarRotation.set(0, carState.rotationAngle, 0);
                currentCarRotation.set(0, carState.rotationAngle, 0);
                animate();
            }
        });
    }

    await audioManager.init();
    audioManager.startEngine();

    if (!gameState.isMultiplayer) {
        // Single player mode
    }

    loadTrackAndRestart(trackName, scene, camera, player);

    if (!gameStarted) {
        gameStarted = true;
        prevCarPosition.copy(carState.position);
        currentCarPosition.copy(carState.position);
        prevCarRotation.set(0, carState.rotationAngle, 0);
        currentCarRotation.set(0, carState.rotationAngle, 0);
        animate();
    }
}

export function toggleCamera() {
    if (cameraManager) {
        cameraManager.toggleCamera();

    }
}

// Make available for mobile menu
window.toggleCamera = toggleCamera;

// --- MENU NAVIGATION FUNCTIONS ---
export function setupMenuNavigation() {
    document.getElementById('multiplayer-button').addEventListener('click', function () {
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('networkMenu').style.display = 'block';
        loadTrackList('trackSelect-network');
    });

    document.getElementById('singleplayer-button').addEventListener('click', function () {
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('track-select-menu').style.display = 'block';
        loadTrackList('trackSelect-single');
    });

    document.getElementById('track-select-button').addEventListener('click', function () {
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('track-select-menu').style.display = 'block';
        loadTrackList('trackSelect-single');
    });

    document.getElementById('track-editor-button').addEventListener('click', function () {
        window.open('trackEditor.html', '_blank');
    });

    // Back button handlers...
    document.getElementById('back-to-main-button').addEventListener('click', function () {
        document.getElementById('networkMenu').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
    });

    document.getElementById('back-to-main-from-track').addEventListener('click', function () {
        document.getElementById('track-select-menu').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
    });

    document.getElementById('back-to-lobby-button').addEventListener('click', function () {
        document.getElementById('waiting-for-players').style.display = 'none';
        document.getElementById('networkMenu').style.display = 'block';
        if (networkManager && networkManager.isConnected) {
            networkManager.disconnect();
        }
    });

    document.getElementById('back-to-main-from-pause').addEventListener('click', () => {
        if (player && scene) scene.remove(player);
        player = null;
        gameStarted = false;
        gameState.isPaused = false;
        document.getElementById('pauseMenu').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';

        if (audioManager) {
            audioManager.destroy();
            audioManager = null;
        }

        if (networkManager && networkManager.isConnected) {
            networkManager.disconnect();
        }
        networkManager = null;

        // Cleanup memory monitoring
        if (memoryMonitor) {
            memoryMonitor.dispose();
            memoryMonitor = null;
        }

        if (textureManager) {
            textureManager.disposeAll();
            textureManager = null;
        }
    });

    document.getElementById('start-singleplayer-button').addEventListener('click', function () {
        const trackSelect = document.getElementById('trackSelect-single');
        const selectedTrack = trackSelect.value;
        if (selectedTrack) {
            startSinglePlayerGame(selectedTrack);
            document.getElementById('track-select-menu').style.display = 'none';
        } else {
            alert('Please select a track first!');
        }
    });
}

function loadTrackList(selectElementId) {
    const trackNames = getAvailableTracks();
    const select = document.getElementById(selectElementId);
    select.innerHTML = '';
    trackNames.forEach(trackName => {
        const option = document.createElement('option');
        option.value = trackName;
        option.textContent = trackName;
        select.appendChild(option);
    });
}

function startSinglePlayerGame(trackName) {
    initGame(trackName, false);
}

// --- CORE ANIMATION LOOP ---
let frameCounter = 0;
const networkTickRate = 1000 / CONFIG.INPUT_SEND_RATE_HZ;
let lastNetworkUpdate = 0;

function animate(currentTime = 0) {
    requestAnimationFrame(animate);

    // Safety check at the very beginning
    if (!player || !camera || !renderer) {
        console.warn('Essential components missing, skipping frame');
        return;
    }

    // Update memory monitoring system
    if (memoryMonitor) {
        memoryMonitor.update();

        // Update HUD with memory status every 2 seconds
        if (frameCounter % 120 === 0 && uiManager) {
            const memoryStatus = getMemoryStatus();
            uiManager.updateMemoryStatus(memoryStatus);
        }
    }

    if (gameState.isPaused || !gameStarted) return;

    const deltaTime = currentTime - lastPhysicsUpdateTime;
    lastPhysicsUpdateTime = currentTime;
    accumulatedPhysicsTime += deltaTime;

    // --- INPUT UPDATES ---
    if (isTouchDevice && touchControls) {

        gameState.keys['w'] = touchControls.buttons.throttle.pressed;
        gameState.keys['s'] = touchControls.buttons.brake.pressed;

        let steer = 0;

        // Priority: Gyro controls if enabled, otherwise touch joystick
        if (gyroControls && gyroControls.enabled) {
            steer = gyroControls.getSteering();
        } else {
            steer = touchControls.joystick.horizontal;
        }

        gameState.keys['a'] = steer < -0.2;
        gameState.keys['d'] = steer > 0.2;
    }

    // --- FIXED PHYSICS UPDATE ---
    while (accumulatedPhysicsTime >= physicsTimeStep) {
        prevCarPosition.copy(currentCarPosition);
        prevCarRotation.copy(currentCarRotation);

        const gyroSteering = (gyroControls && gyroControls.enabled) ? gyroControls.getSteering() : null;
        const physicsResult = updatePhysics(gameState.keys, carState, trackData.curve, trackData.divisions, roadHalfWidth, gyroSteering);
        const { position, rotationAngle, speed, isWrongWay, turnDirection } = physicsResult;

        lastTurnDirection = turnDirection;
        currentCarPosition.copy(position);
        currentCarRotation.set(0, rotationAngle, 0);

        if (gameState.playerParts) {
            const { wheels, wheelPivots } = gameState.playerParts;
            const wheelRadius = 0.33;
            const circumference = 2 * Math.PI * wheelRadius;
            const rotationDelta = (speed / circumference) * (physicsTimeStep / 1000);

            if (wheels.frontLeftMeshes) {
                wheels.frontLeftMeshes.forEach(mesh => mesh.rotation.x -= rotationDelta);
            }
            if (wheels.frontRightMeshes) {
                wheels.frontRightMeshes.forEach(mesh => mesh.rotation.x -= rotationDelta);
            }

            let steerAngle = 0;
            if (gyroControls && gyroControls.enabled) {
                // Use gyro steering value directly (mobile)
                steerAngle = gyroControls.getSteering() * 0.4;
            } else if (isTouchDevice) {
                // Touch device with joystick
                steerAngle = turnDirection * 0.4;
            } else {
                // Desktop - reverse the direction for correct visual
                steerAngle = -turnDirection * 0.4;
            }
            if (wheelPivots && wheelPivots.frontLeft) wheelPivots.frontLeft.rotation.z = steerAngle;
            if (wheelPivots && wheelPivots.frontRight) wheelPivots.frontRight.rotation.z = steerAngle;
        }

        if (audioManager) audioManager.update(speed);
        if (frameCounter % 3 === 0 && uiManager) {
            if (checkLapCompletion(position, speed)) return;
            uiManager.updateHUD({ isWrongWay, speed: carState.speed });
        }
        accumulatedPhysicsTime -= physicsTimeStep;
    }

    // --- RENDER & VISUAL UPDATES ---
    if (player && camera) {
        let alpha = Math.max(0, Math.min(1, accumulatedPhysicsTime / physicsTimeStep));

        player.position.copy(prevCarPosition).lerp(currentCarPosition, alpha);
        player.position.y = CAR_Y_OFFSET;
        player.rotation.y = prevCarRotation.y + (currentCarRotation.y - prevCarRotation.y) * alpha;

        // --- UPDATED CAMERA LOGIC ---
        cameraManager.update();
    }

    // --- NETWORK SYNCHRONIZATION ---
    if (gameState.isMultiplayer && networkManager && networkManager.isConnected) {
        if (currentTime - lastNetworkUpdate > networkTickRate) {
            networkManager.sendInput(carState);
            lastNetworkUpdate = currentTime;
        }

        if (frameCounter % 60 === 0) {
            networkManager.sendInput(carState);
        }

        networkManager.updateRemotePlayers();
    }

    // --- RENDER SCENE ---
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }

    frameCounter++;
    if (frameCounter >= 1000) frameCounter = 0;
}

export function cleanupGame() {
    gameStarted = false;

    if (gyroControls) {
        gyroControls.dispose();
        gyroControls = null;
    }

    // Cleanup memory monitoring system
    if (memoryMonitor) {
        memoryMonitor.dispose();
        memoryMonitor = null;
    }

    if (textureManager) {
        textureManager.disposeAll();
        textureManager = null;
    }

    if (player && scene) scene.remove(player);
    if (audioManager) audioManager.destroy();
    if (networkManager) networkManager.disconnect();

    window.removeEventListener("keydown", keydownHandler);
    window.removeEventListener("keyup", keyupHandler);

    //console.log('🎮 Game cleanup completed');
}

export { loadTrackAndRestart as loadTrackByName };

document.addEventListener('DOMContentLoaded', async () => {
    setupMenuNavigation();



    if ('ontouchstart' in window) {
        document.getElementById('touch-controls').style.display = 'block';
        document.getElementById('mobile-menu-toggle').style.display = 'block';
        //document.getElementById('gyro-controls').style.display = 'block';
    }
    //window.gyroControls = null
    //console.log('🚀 Game initialized with memory monitoring');
    //console.log('💡 Press M for memory check, L for cleanup');
});