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
    networkManager = new NetworkManager();
    uiManager = new UIManager(networkManager);

    // Initialize touch controls
    touchControls = new TouchControls('touch-controls');

    initGameManager(uiManager, audioManager, networkManager);
    gameState.networkManager = networkManager;

    // --- INPUT EVENT LISTENERS ---
    window.addEventListener("keydown", e => {
        gameState.keys[e.key.toLowerCase()] = true;
        if (e.key.toLowerCase() === 'p') togglePause();
    });
    window.addEventListener("keyup", e => gameState.keys[e.key.toLowerCase()] = false);

    const handleButtonClick = (button, callback) => {
        if (!button) return;
        button.addEventListener('click', callback);
        button.addEventListener('touchstart', (e) => { e.preventDefault(); callback(); }, { passive: false });
    };

    handleButtonClick(uiManager.resumeButton, () => togglePause());
    handleButtonClick(document.getElementById('mute-button'), () => audioManager.toggleMute());
    if (uiManager.editorButton) handleButtonClick(uiManager.editorButton, () => { window.open('trackEditor.html', '_blank'); });
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
    handleButtonClick(document.getElementById('car-editor-button'), () => {
        window.open('carEdtior/carEditindex.html', '_blank');
    });

    // --- NETWORK MANAGER EVENT HANDLERS ---
    networkManager.addEventListener('roomJoined', (event) => {
        const { roomId, players, track, hostId } = event.detail;
        gameState.isMultiplayer = !networkManager.singlePlayerMode;
        uiManager.showWaitingForPlayersScreen(roomId, players, hostId, networkManager.clientId);

        console.log('Loading track:', track);
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
            animate();
        }
    });

    // --- INITIAL AUDIO & CONNECTION SETUP ---
    await audioManager.init();
    audioManager.startEngine();

    // Connect to network if not already connected
    if (!networkManager.isConnected) {
        const connected = await networkManager.connect();
        if (connected) {
            // If connected, but started from single player, create a room for single player
            if (!gameState.isMultiplayer) {
                networkManager.createRoom('Player', trackName, true);
            }
        } else {
            // If connection fails, ensure single player mode is active
            networkManager.singlePlayerMode = true;
            networkManager.createRoom('Player', trackName, true);
        }
    }

    // Load the selected track
    loadTrackAndRestart(trackName, scene, camera, player);

    // Start the animation loop if not already started
    if (!gameStarted) {
        gameStarted = true;
        animate();
    }
}

// --- MENU NAVIGATION FUNCTIONS ---
export function setupMenuNavigation() {
    // Audio initialization button
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

    // Back button handlers
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
    });

    document.getElementById('back-to-main-from-pause').addEventListener('click', function () {
        // Clean up current game
        if (player && scene) {
            scene.remove(player);
        }
        gameStarted = false;
        gameState.isPaused = false;

        document.getElementById('pauseMenu').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';

        // Reset audio
        if (audioManager) {
            audioManager.stopEngine();
        }
    });

    // Single player start
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
    initGame(trackName, false);
}




// --- CORE ANIMATION LOOP ---
let frameCounter = 0;
const networkTickRate = 1000 / CONFIG.INPUT_SEND_RATE_HZ;
let lastNetworkUpdate = 0;

// In the animate function in main.js
function animate(currentTime = 0) {
    if (gameState.isPaused || !gameStarted) {
        requestAnimationFrame(animate);
        return;
    }
    requestAnimationFrame(animate);

    // Update game state from touch controls before physics calculation
    if (isTouchDevice && touchControls) {
        gameState.keys['w'] = touchControls.buttons.throttle.pressed;
        gameState.keys['s'] = touchControls.buttons.brake.pressed;

        const steer = touchControls.joystick.horizontal;
        gameState.keys['a'] = steer < -0.2;
        gameState.keys['d'] = steer > 0.2;
    }

    const { position, rotationAngle, speed, isWrongWay } = updatePhysics(gameState.keys, carState, trackData.curve, trackData.divisions, roadHalfWidth);

    if (player) {
        player.position.copy(position);
        player.rotation.y = rotationAngle;
    }

    if (audioManager) {
        audioManager.update(speed);
    }

    if (player && camera) {
        const carDirection = player.getWorldDirection(new THREE.Vector3());
        const cameraOffset = carDirection.multiplyScalar(-6).add(new THREE.Vector3(0, 5, 0));
        const idealPosition = player.position.clone().add(cameraOffset);

        // Adjust lerp factor based on speed for smoother camera at high speeds
        const lerpFactor = Math.min(0.4, 2.5 + Math.abs(carState.speed) * 0.2);
        camera.position.lerp(idealPosition, lerpFactor);
        camera.lookAt(player.position);
    }

    // Network synchronization
    if (gameState.isMultiplayer && networkManager && networkManager.isConnected) {
        // Send input at regular intervals
        if (currentTime - lastNetworkUpdate > networkTickRate) {
            networkManager.sendInput(carState);
            lastNetworkUpdate = currentTime;
        }

        // Force send position update every 30 frames regardless of tick rate
        if (frameCounter % 30 === 0) {
            networkManager.sendInput(carState);
        }

        // Update remote players
        networkManager.updateRemotePlayers();
    }

    if (frameCounter % 3 === 0 && uiManager) {
        if (checkLapCompletion(position, speed)) { return; }
        uiManager.updateHUD({ isWrongWay, speed: carState.speed });
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }

    frameCounter++;

    // Reset frame counter to prevent overflow
    if (frameCounter >= 1000) frameCounter = 0;
}
// Export loadTrackByName for use in index.html
export { loadTrackAndRestart as loadTrackByName };

document.addEventListener('DOMContentLoaded', async () => {
    // Set up all menu navigation
    setupMenuNavigation();

    // Initialize touch controls display
    if ('ontouchstart' in window) {
        document.getElementById('touch-controls').style.display = 'block';
    }
});