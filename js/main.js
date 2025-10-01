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

document.addEventListener('DOMContentLoaded', () => {

    const player = createF1Car(CONFIG.PLAYER_COLOR);
    player.name = "playerCar";
    scene.add(player);

    const audioManager = new AudioManager(camera, player);
    const networkManager = new NetworkManager();
    const uiManager = new UIManager(networkManager);

    initGameManager(uiManager, audioManager, networkManager);
    gameState.networkManager = networkManager;

    window.addEventListener("keydown", e => { gameState.keys[e.key.toLowerCase()] = true; if (e.key.toLowerCase() === 'p') togglePause(); });
    window.addEventListener("keyup", e => gameState.keys[e.key.toLowerCase()] = false);
    uiManager.resumeButton.addEventListener('click', () => togglePause());
    document.getElementById('mute-button').addEventListener('click', () => audioManager.toggleMute());
    if(uiManager.editorButton) uiManager.editorButton.addEventListener('click', () => { window.open('trackEditor.html', '_blank'); });

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
        animate();
    });

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
            alert("Could not initialize the game. Please check browser permissions and refresh.");
        }
    });
    
    const availableTracks = getAvailableTracks();
    uiManager.populateTrackSelect(availableTracks);

    let frameCounter = 0;
    const networkTickRate = 1000 / CONFIG.INPUT_SEND_RATE_HZ;
    let lastNetworkUpdate = 0;

    function animate(currentTime) {
        if (gameState.isPaused) {
            requestAnimationFrame(animate);
            return;
        }
        requestAnimationFrame(animate);
        
        const { position, rotationAngle, speed, isWrongWay } = updatePhysics(gameState.keys, carState, trackData.curve, trackData.divisions, roadHalfWidth);
        player.position.copy(position);
        player.rotation.y = rotationAngle;

        audioManager.update(speed);

        // --- ✅ CAMERA UPDATE (THE FIX) ✅ ---
        // 1. Get the car's forward direction as a vector.
        const carDirection = player.getWorldDirection(new THREE.Vector3());

        // 2. Calculate the ideal camera position: 12 units behind and 6 units above the car.
        const cameraOffset = carDirection.multiplyScalar(-12).add(new THREE.Vector3(0, 6, 0));
        const idealPosition = player.position.clone().add(cameraOffset);
        
        // 3. Smoothly move (interpolate) the camera towards that ideal position.
        camera.position.lerp(idealPosition, 0.1);

        // 4. Always make the camera look directly at the car's current position for stability.
        camera.lookAt(player.position);
        // --- End of Fix ---

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