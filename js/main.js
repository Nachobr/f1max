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

document.addEventListener('DOMContentLoaded', async () => {

    // --- INITIALIZATION ---
    // Load custom car configuration or use default
    let player;
    try {
        // createF1Car handles loading from localStorage internally if no config is provided
        player = await createF1Car(); 
        console.log('Car configuration loaded (from localStorage or default).');
    } catch (error) {
        console.warn('Error creating car, using default:', error);
        player = await createF1Car(); // Fallback to default if any error occurs
    }
    player.name = "playerCar";
    scene.add(player);

    const audioManager = new AudioManager(camera, player);
    const networkManager = new NetworkManager();
    const uiManager = new UIManager(networkManager);

    // Initialize the new touch controls
    const touchControls = new TouchControls('touch-controls');
    const isTouchDevice = 'ontouchstart' in window;

    initGameManager(uiManager, audioManager, networkManager);
    gameState.networkManager = networkManager;

    // Track if we've started the game loop
    let gameStarted = false;

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

        console.log('Loading track:', track); // ✅ DEBUG
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
        console.log('Starting game for all players'); // ✅ DEBUG
        uiManager.hideWaitingScreen();

        // ✅ FIX: Ensure audio is initialized for all players
        if (!gameState.audioInitialized) {
            audioManager.init().then(() => {
                audioManager.startEngine();
            });
        } else {
            audioManager.startEngine();
        }

        // ✅ FIX: Start animation loop if not already started
        if (!gameStarted) {
            gameStarted = true;
            animate();
        }
    });

    // --- INITIAL AUDIO & CONNECTION SETUP ---
    handleButtonClick(uiManager.audioButton, async () => {
        try {
            await audioManager.init();
            uiManager.audioButton.style.display = 'none';
            const connected = await networkManager.connect();
            if (connected) {
                uiManager.showNetworkMenu();
            } else {
                uiManager.showSinglePlayerMessage();
                setTimeout(() => {
                    const track = uiManager.trackSelectNetwork.value;
                    networkManager.createRoom('Player', track);
                }, 1500);
            }
        } catch (err) {
            alert("Could not initialize the game. Please check browser permissions and refresh.");
        }
    });

    const availableTracks = getAvailableTracks();
    uiManager.populateTrackSelect(availableTracks);

    // --- CORE ANIMATION LOOP ---
    let frameCounter = 0;
    const networkTickRate = 1000 / CONFIG.INPUT_SEND_RATE_HZ;
    let lastNetworkUpdate = 0;

    function animate(currentTime = 0) {
        if (gameState.isPaused) {
            requestAnimationFrame(animate);
            return;
        }
        requestAnimationFrame(animate);

        // Update game state from touch controls before physics calculation
        if (isTouchDevice) {
            gameState.keys['w'] = touchControls.buttons.throttle.pressed;
            gameState.keys['s'] = touchControls.buttons.brake.pressed;

            const steer = touchControls.joystick.horizontal;
            gameState.keys['a'] = steer < -0.2;
            gameState.keys['d'] = steer > 0.2;
        }

        const { position, rotationAngle, speed, isWrongWay } = updatePhysics(gameState.keys, carState, trackData.curve, trackData.divisions, roadHalfWidth);
        player.position.copy(position);
        player.rotation.y = rotationAngle;

        audioManager.update(speed);

        const carDirection = player.getWorldDirection(new THREE.Vector3());
        const cameraOffset = carDirection.multiplyScalar(-8).add(new THREE.Vector3(0, 6, 0));
        const idealPosition = player.position.clone().add(cameraOffset);
        camera.position.lerp(idealPosition, 0.1);
        camera.lookAt(player.position);

        // ✅ FIX: Improved network synchronization
        if (gameState.isMultiplayer && networkManager.isConnected) {
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

        if (frameCounter % 3 === 0) {
            if (checkLapCompletion(position, speed)) { return; }
            uiManager.updateHUD({ isWrongWay, speed: carState.speed });
        }

        renderer.render(scene, camera);
        frameCounter++;

        // Reset frame counter to prevent overflow
        if (frameCounter >= 1000) frameCounter = 0;
    }
});