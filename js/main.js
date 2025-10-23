import * as THREE from 'three';
import { scene, camera, renderer } from './SceneSetup.js';
import { gameState } from './State.js';
import { CONFIG } from './Config.js';
import { UIManager } from './UIManager.js';
import { AudioManager } from './AudioManager.js';
import { initGameManager, loadTrackAndRestart, checkLapCompletion, togglePause } from './GameManager.js';
import { NetworkManager } from './NetworkManager.js';
import { createF1Car } from './CarModel.js';
import { carState, updatePhysics } from './CarPhysics.js';
import { trackData, roadHalfWidth } from './TrackBuilder.js';
import { getAvailableTracks } from './Utils.js';
import { TouchControls } from './TouchControls.js';

// Global variables
let audioManager, networkManager, uiManager, touchControls, player;
let gameStarted = false;
let isTouchDevice = 'ontouchstart' in window;


let lastPhysicsUpdateTime = 0;
const physicsTimeStep = 1000 / 60; // Target 60 physics updates per second
let accumulatedPhysicsTime = 0; // Accumulator for physics updates

// --- JITTER FIX: INTERPOLATION ---
const prevCarPosition = new THREE.Vector3();
const prevCarRotation = new THREE.Euler(0, 0, 0); // Using Euler for Y rotation
const currentCarPosition = new THREE.Vector3();
const currentCarRotation = new THREE.Euler(0, 0, 0);

// --- JITTER FIX: Smoothed Camera ---
const cameraTargetPosition = new THREE.Vector3();
const cameraLookAtTarget = new THREE.Vector3();
const tempVec3 = new THREE.Vector3();


const CAR_Y_OFFSET = 0.8;


export async function initGame(trackName = 'Monza Standard', isMultiplayer = false) {
    // Reset game state when starting a new game
    gameStarted = false;
    gameState.isMultiplayer = isMultiplayer;

    // --- INITIALIZATION ---
    try {
        player = await createF1Car();
        console.log('Car configuration loaded (from localStorage or default).');
    } catch (error) {
        console.warn('Error creating car, using default:', error);
        player = await createF1Car();
    }
    player.name = "playerCar";
    scene.add(player);

    audioManager = new AudioManager(camera, player);


    if (gameState.isMultiplayer) {
        networkManager = new NetworkManager();
        await networkManager.connect(); // Only connect if multiplayer
    } else {
        // If not multiplayer, ensure networkManager is null or a dummy object
        networkManager = null; // Or a dummy object with no-op methods if other parts of code expect it
        console.log("Single player mode: NetworkManager not initialized.");
    }

    uiManager = new UIManager(networkManager); // uiManager still needs networkManager for button setup etc.

    // Initialize touch controls
    touchControls = new TouchControls('touch-controls');

    initGameManager(uiManager, audioManager, networkManager);
    gameState.networkManager = networkManager; // gameState.networkManager will be null in single-player

    // --- INPUT EVENT LISTENERS ---
    window.addEventListener("keydown", e => {
        gameState.keys[e.key.toLowerCase()] = true;
        if (e.key.toLowerCase() === 'p') togglePause();
    });
    window.addEventListener("keyup", e => gameState.keys[e.key.toLowerCase()] = false);

    const handleButtonClick = (button, callback) => {
        if (!button) return;
        button.addEventListener('click', callback);
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            callback();
        }, {
            passive: false
        });
    };

    handleButtonClick(uiManager.resumeButton, () => togglePause());
    handleButtonClick(document.getElementById('mute-button'), () => audioManager.toggleMute());
    if (uiManager.editorButton) handleButtonClick(uiManager.editorButton, () => {
        window.open('trackEditor.html', '_blank');
    });


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

        // --- NETWORK MANAGER EVENT HANDLERS ---

        networkManager.addEventListener('roomJoined', (event) => {
            const {
                roomId,
                players,
                track,
                hostId
            } = event.detail;
            gameState.isMultiplayer = !networkManager.singlePlayerMode; // This seems redundant if already handled
            uiManager.showWaitingForPlayersScreen(roomId, players, hostId, networkManager.clientId);

            console.log('Loading track:', track);
            loadTrackAndRestart(track, scene, camera, player);

            // This part for singlePlayerMode within networkManager.addEventListener('roomJoined')
            // should probably be removed or rethinked. For now, it won't be hit if networkManager is null.
            if (networkManager.singlePlayerMode) {
                setTimeout(() => networkManager.startGame(), 500);
            }
        });

        networkManager.addEventListener('playerListUpdated', (event) => {
            const {
                players,
                hostId
            } = event.detail;
            uiManager.updatePlayerList(players, hostId);
            uiManager.updateStartButtonVisibility(hostId, networkManager.clientId);
        });

        networkManager.addEventListener('gameStarted', () => {
            console.log('Starting game for all players');
            uiManager.hideWaitingScreen();

            // Ensure audio is initialized for all players
            if (!gameState.audioInitialized) {
                audioManager.init().then(() => {
                    audioManager.startEngine();
                });
            } else {
                audioManager.startEngine();
            }

            // Start animation loop if not already started
            if (!gameStarted) {
                gameStarted = true;
                // Initialize interpolation states for the first frame
                prevCarPosition.copy(carState.position);
                currentCarPosition.copy(carState.position);
                prevCarRotation.set(0, carState.rotationAngle, 0);
                currentCarRotation.set(0, carState.rotationAngle, 0);
                animate();
            }
        });
    }

    // --- INITIAL AUDIO & CONNECTION SETUP ---
    await audioManager.init();
    audioManager.startEngine();


    // If not multiplayer, just proceed.
    if (!gameState.isMultiplayer) {
        console.log("Single player game initiated, skipping network connection.");
    }
    // If multiplayer, networkManager.connect() was already called above.
    // The previous logic for `networkManager.createRoom('Player', trackName, true);`
    // was trying to create a single-player *room* even if the connection failed.
    // Now, if it's single player, we don't even try to connect.
    // If it's multiplayer, the connection and room creation/joining will be explicit via UI.


    // Load the selected track
    loadTrackAndRestart(trackName, scene, camera, player);

    // Start the animation loop if not already started
    if (!gameStarted) {
        gameStarted = true;
        // Initialize interpolation states for the first frame
        prevCarPosition.copy(carState.position);
        currentCarPosition.copy(carState.position);
        prevCarRotation.set(0, carState.rotationAngle, 0);
        currentCarRotation.set(0, carState.rotationAngle, 0);
        animate();
    }
}

// --- MENU NAVIGATION FUNCTIONS ---
export function setupMenuNavigation() {
    // Audio initialization button
    document.getElementById('multiplayer-button').addEventListener('click', function() {
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('networkMenu').style.display = 'block';
        loadTrackList('trackSelect-network');
    });

    document.getElementById('singleplayer-button').addEventListener('click', function() {
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('track-select-menu').style.display = 'block';
        loadTrackList('trackSelect-single');
    });

    document.getElementById('track-select-button').addEventListener('click', function() {
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('track-select-menu').style.display = 'block';
        loadTrackList('trackSelect-single');
    });

    document.getElementById('track-editor-button').addEventListener('click', function() {
        window.open('trackEditor.html', '_blank');
    });

    // Back button handlers
    document.getElementById('back-to-main-button').addEventListener('click', function() {
        document.getElementById('networkMenu').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
    });

    document.getElementById('back-to-main-from-track').addEventListener('click', function() {
        document.getElementById('track-select-menu').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
    });

    document.getElementById('back-to-lobby-button').addEventListener('click', function() {
        document.getElementById('waiting-for-players').style.display = 'none';
        document.getElementById('networkMenu').style.display = 'block';
        // ✅ FIX: If going back to lobby, ensure networkManager is properly disconnected or reset if it was a single-player multiplayer test
        if (networkManager && networkManager.isConnected) {
            networkManager.disconnect(); // Assuming a disconnect method exists
        }
    });

    document.getElementById('back-to-main-from-pause').addEventListener('click', () => {
        // Clean up current game
        if (player && scene) {
            scene.remove(player);
            player = null; // Set player to null
        }
        gameStarted = false;
        gameState.isPaused = false;

        document.getElementById('pauseMenu').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';

        // Reset audio properly
        if (audioManager) {
            audioManager.destroy(); // Call the new destroy method
            audioManager = null; // Set audioManager to null
        }
        // ✅ FIX: Ensure networkManager is cleaned up if it existed
        if (networkManager && networkManager.isConnected) {
            networkManager.disconnect();
        }
        networkManager = null; // Clear reference
    });

    // Single player start
    document.getElementById('start-singleplayer-button').addEventListener('click', function() {
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

// Function to load track list into a select element
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

// Function to start single player game
function startSinglePlayerGame(trackName) {
    console.log('Starting single player game with track:', trackName);
    initGame(trackName, false); // Explicitly setting isMultiplayer to false
}


// --- CORE ANIMATION LOOP ---
let frameCounter = 0;
const networkTickRate = 1000 / CONFIG.INPUT_SEND_RATE_HZ;
let lastNetworkUpdate = 0;


function animate(currentTime = 0) {
    requestAnimationFrame(animate);

    // If the game is paused or not started, skip all game logic but keep the loop running.
    if (gameState.isPaused || !gameStarted) {
        return;
    }

    const deltaTime = currentTime - lastPhysicsUpdateTime;
    lastPhysicsUpdateTime = currentTime;
    accumulatedPhysicsTime += deltaTime;

    // --- INPUT UPDATES ---
    if (isTouchDevice && touchControls) {
        gameState.keys['w'] = touchControls.buttons.throttle.pressed;
        gameState.keys['s'] = touchControls.buttons.brake.pressed;
        const steer = touchControls.joystick.horizontal;
        gameState.keys['a'] = steer < -0.2;
        gameState.keys['d'] = steer > 0.2;
    }

    // --- FIXED PHYSICS UPDATE (can run multiple times per frame or not at all) ---
    while (accumulatedPhysicsTime >= physicsTimeStep) {
        // Store current state as previous for interpolation
        prevCarPosition.copy(currentCarPosition);
        prevCarRotation.copy(currentCarRotation);

        // Update physics
        const {
            position,
            rotationAngle,
            speed,
            isWrongWay
        } = updatePhysics(gameState.keys, carState, trackData.curve, trackData.divisions, roadHalfWidth);

        // Store new physics state
        currentCarPosition.copy(position);
        currentCarRotation.set(0, rotationAngle, 0); // Assuming rotationAngle is around Y

        // Update audio based on the new physics state
        if (audioManager) {
            audioManager.update(speed);
        }

        // Check for lap completion and update HUD periodically
        // Doing this here ensures it's tied to physics updates
        if (frameCounter % 3 === 0 && uiManager) {
            if (checkLapCompletion(position, speed)) {
                return;
            }
            uiManager.updateHUD({
                isWrongWay,
                speed: carState.speed
            });
        }

        accumulatedPhysicsTime -= physicsTimeStep;
    }

    // --- RENDER & VISUAL UPDATES (runs every frame for smoothness) ---
    if (player && camera) {
        // Calculate interpolation factor (alpha)
        let alpha = accumulatedPhysicsTime / physicsTimeStep;
        if (alpha < 0) alpha = 0; // Clamp to prevent issues if accumulatedTime somehow goes negative
        if (alpha > 1) alpha = 1; // Clamp to prevent overshooting

        // Interpolate player car's visual position and rotation
        player.position.copy(prevCarPosition).lerp(currentCarPosition, alpha);
        
        // ✅ FIX: Apply the visual offset AFTER physics has been calculated.
        // This keeps the physics simulation flat on y=0 but lifts the visual model.
        player.position.y = CAR_Y_OFFSET;

        player.rotation.y = prevCarRotation.y + (currentCarRotation.y - prevCarRotation.y) * alpha;

        // --- CAMERA SMOOTHING ---
        // Calculate ideal camera position based on interpolated player position
        tempVec3.set(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y)); // Car's forward direction
        tempVec3.multiplyScalar(-6).add(new THREE.Vector3(0, 5, 0)); // Camera offset
        cameraTargetPosition.copy(player.position).add(tempVec3);

        // Smoothly lerp camera to target position
        camera.position.lerp(cameraTargetPosition, 0.1); // Adjusted lerp factor for smoothness

        // Calculate ideal look-at target slightly ahead of the car for better perspective
        cameraLookAtTarget.copy(player.position);
        camera.lookAt(cameraLookAtTarget);
    }

    // --- NETWORK SYNCHRONIZATION ---

    if (gameState.isMultiplayer && networkManager && networkManager.isConnected) {
        // Send input at regular intervals
        if (currentTime - lastNetworkUpdate > networkTickRate) {
            networkManager.sendInput(carState);
            lastNetworkUpdate = currentTime;
        }

        // Force send position update every 30 frames regardless of tick rate
        // This is still useful as a fallback, but interpolation on client side is key.
        if (frameCounter % 60 === 0) {
            networkManager.sendInput(carState);
        }

        // Update remote players (NetworkManager should handle interpolation for them)
        networkManager.updateRemotePlayers();
    }

    // --- RENDER SCENE ---
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }

    // Increment and reset frame counter
    frameCounter++;
    if (frameCounter >= 1000) frameCounter = 0;
}
// Export loadTrackByName for use in index.html
export {
    loadTrackAndRestart as loadTrackByName
};

document.addEventListener('DOMContentLoaded', async () => {
    // Set up all menu navigation
    setupMenuNavigation();

    // Initialize touch controls display
    if ('ontouchstart' in window) {
        document.getElementById('touch-controls').style.display = 'block';
    }
});