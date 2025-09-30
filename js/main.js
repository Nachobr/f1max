// js/main.js
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
import { getAvailableTracks } from './Utils.js'; // Import the new function

document.addEventListener('DOMContentLoaded', () => {

    // --- INITIALIZATION ---
    const player = createF1Car(CONFIG.PLAYER_COLOR);
    player.name = "playerCar";
    scene.add(player);

    const audioManager = new AudioManager(camera, player);
    const networkManager = new NetworkManager();
    const uiManager = new UIManager(networkManager);

    initGameManager(uiManager, audioManager, networkManager);
    gameState.networkManager = networkManager;

    // --- CORE EVENT LISTENERS ---
    window.addEventListener("keydown", e => { gameState.keys[e.key.toLowerCase()] = true; if (e.key.toLowerCase() === 'p') togglePause(); });
    window.addEventListener("keyup", e => gameState.keys[e.key.toLowerCase()] = false);
    uiManager.resumeButton.addEventListener('click', () => togglePause());
    document.getElementById('mute-button').addEventListener('click', () => audioManager.toggleMute());
    uiManager.editorButton.addEventListener('click', () => { window.open('trackEditor.html', '_blank'); });

    // --- NETWORK MENU EVENT LISTENERS ---
    uiManager.createRoomButton.addEventListener('click', () => {
        const playerName = uiManager.playerNameInput.value || 'Player';
        const selectedTrack = uiManager.trackSelectNetwork.value;
        networkManager.createRoom(playerName, selectedTrack);
    });
    uiManager.joinRoomButton.addEventListener('click', () => {
        const playerName = uiManager.playerNameInput.value || 'Player';
        const roomId = uiManager.roomIdInput.value;
        networkManager.joinRoom(roomId, playerName);
    });
    uiManager.startGameButton.addEventListener('click', () => networkManager.startGame());

    // --- NETWORK MANAGER EVENT HANDLERS ---
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
        console.log('Game started, starting animation loop.');
        uiManager.hideWaitingScreen();
        animate();
    });

    // --- INITIAL AUDIO & CONNECTION SETUP ---
    uiManager.audioButton.addEventListener('click', async () => {
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
            console.error("Initialization failed.", err);
            alert("Could not initialize the game. Please check browser permissions and refresh.");
        }
    });
    
    // ✅ FIX: Use the new function to populate the dropdown with ALL available tracks.
    const availableTracks = getAvailableTracks();
    uiManager.populateTrackSelect(availableTracks);

    // ✅ FIX: The entire animate loop is now inside DOMContentLoaded to ensure access to all variables.
    // --- CORE ANIMATION LOOP ---
    let frameCounter = 0;
    const forwardVector = new THREE.Vector3();
    const lookAtVector = new THREE.Vector3();
    const networkTickRate = 1000 / CONFIG.INPUT_SEND_RATE_HZ;
    let lastNetworkUpdate = 0;

    function animate(currentTime) {
        if (gameState.isPaused) {
            requestAnimationFrame(animate);
            return;
        }
        requestAnimationFrame(animate);
        
        const { position, rotationAngle, velocityAngle, speed, isWrongWay } = updatePhysics(gameState.keys, carState, trackData.curve, trackData.divisions, roadHalfWidth);
        player.position.copy(position);
        player.rotation.y = rotationAngle;

        audioManager.update(speed);

        const carForwardAngle = rotationAngle - Math.PI / 2;
        forwardVector.set(Math.cos(carForwardAngle), 0, Math.sin(carForwardAngle));
        const idealPosition = position.clone().add(forwardVector.multiplyScalar(-12)).add(new THREE.Vector3(0, 6, 0));
        camera.position.lerp(idealPosition, 0.1);
        const lookAtAngle = velocityAngle - Math.PI / 2;
        lookAtVector.set(Math.cos(lookAtAngle), 0, Math.sin(lookAtAngle));
        camera.lookAt(position.clone().add(lookAtVector.multiplyScalar(5)));

        if (gameState.isMultiplayer && networkManager.isConnected) {
            if (currentTime - lastNetworkUpdate > networkTickRate) {
                networkManager.sendInput(carState);
                lastNetworkUpdate = currentTime;
            }
            networkManager.updateRemotePlayers();
        }
        
        if (frameCounter % 3 === 0) {
            if (checkLapCompletion(position, speed)) { return; }
            uiManager.updateHUD({ isWrongWay });
        }
        renderer.render(scene, camera);
        frameCounter++;
    }
});