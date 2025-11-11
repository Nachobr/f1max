import { scene, camera, renderer } from './SceneSetup.js';
import { gameState } from './State.js';
import { initGameManager, setRenderer, loadTrackAndRestart } from './GameStateManager.js';
import { AudioManager } from './AudioManager.js';
import { NetworkManager } from './NetworkManager.js';
import { createF1Car } from './CarModel.js';
import { InputManager } from './InputManager.js';
import { GameLoop } from './GameLoop.js';
import { UIManager } from './UIManager.js';
import { MemoryMonitor } from './MemoryMonitor.js';
import { TextureManager } from './TextureManager.js';
import { CameraManager } from './CameraManager.js';
import { getAvailableTracks } from './Utils.js';
import { clearTrack, trackData } from './TrackBuilder.js'; // ✅ ADDED for track disposal

export class GameInitializer {
    constructor() {
        this.gameStarted = false;
        this.initGameInProgress = false;
        this.player = null;
        this.audioManager = null;
        this.networkManager = null;
        this.uiManager = null;
        this.inputManager = null;
        this.gameLoop = null;
        this.memoryMonitor = null;
        this.textureManager = null;
        this.cameraManager = null;
        window.gameInitializer = this;
    }

    async initGame(trackName = 'Monza Standard', isMultiplayer = false) {
        if (this.initGameInProgress) {
            console.warn('🚫 initGame already in progress, skipping duplicate call');
            return;
        }

        this.initGameInProgress = true;
        console.trace(`🎯 INIT GAME CALLED - Track: ${trackName}, Multiplayer: ${isMultiplayer}, Called from:`);

        const initGameCallId = Math.random().toString(36).substr(2, 9);
        console.log(`🔢 InitGame Instance ID: ${initGameCallId}`);
        this.gameStarted = false;
        gameState.isMultiplayer = isMultiplayer;

        // ✅ CRITICAL: Reset game state keys to prevent stale input
        if (gameState.keys) {
            gameState.keys = {};
        }

        // ✅ Clean up existing instances properly
        if (this.inputManager) {
            await this.inputManager.cleanup();
            this.inputManager = null;
        }

        if (this.gameLoop) {
            this.gameLoop.stop();
            this.gameLoop = null;
        }

        // Initialize core systems
        this.memoryMonitor = new MemoryMonitor(renderer, scene);
        this.textureManager = new TextureManager(renderer);

        // ✅ Always create fresh InputManager
        this.inputManager = new InputManager();
        this.uiManager = new UIManager(this.networkManager);
        this.gameLoop = new GameLoop();

        try {
            const car = await createF1Car();
            this.player = car.model;
            gameState.playerParts = car.parts;
            this.player.name = "playerCar";
            scene.add(this.player);
        } catch (error) {
            
            const car = await createF1Car();
            this.player = car.model;
            gameState.playerParts = car.parts;
            this.player.name = "playerCar";
            scene.add(this.player);
        }

        // Initialize camera manager
        this.cameraManager = new CameraManager(camera, this.player);
        window.cameraManager = this.cameraManager; // ✅ Set fresh global reference

        // Initialize audio manager
        this.audioManager = new AudioManager(camera, this.player);
        await this.audioManager.init();

        // Initialize network if multiplayer
        if (gameState.isMultiplayer) {
            this.networkManager = new NetworkManager();
            await this.networkManager.connect();
            gameState.networkManager = this.networkManager;
            this.uiManager.setNetworkManager(this.networkManager);
        }

        // Initialize input system
        this.inputManager.init(this.uiManager, this.audioManager, this.cameraManager);

        // Setup game state manager
        initGameManager(this.uiManager, this.audioManager, this.networkManager);
        setRenderer(renderer);

        // Setup game loop
        this.gameLoop.init({
            player: this.player,
            inputManager: this.inputManager,
            audioManager: this.audioManager,
            uiManager: this.uiManager,
            networkManager: this.networkManager,
            memoryMonitor: this.memoryMonitor,
            cameraManager: this.cameraManager
        });

        // Setup multiplayer event handlers if applicable
        if (this.networkManager) {
            this.setupMultiplayerHandlers();
        }

        // Load track and start game
        loadTrackAndRestart(trackName, scene, camera, this.player);

        // Start audio engine
        this.audioManager.startEngine();

        this.startGameLoop();
        //console.log(`✅ Game initialization complete for Instance ID: ${initGameCallId}`);
    }

    setupMultiplayerHandlers() {
        if (!this.networkManager) return;

        this.networkManager.addEventListener('roomJoined', (event) => {
            const { roomId, players, track, hostId } = event.detail;
            gameState.isMultiplayer = !this.networkManager.singlePlayerMode;
            this.uiManager.showWaitingForPlayersScreen(roomId, players, hostId, this.networkManager.clientId);
            loadTrackAndRestart(track, scene, camera, this.player);

            if (this.networkManager.singlePlayerMode) {
                setTimeout(() => this.networkManager.startGame(), 500);
            }
        });

        this.networkManager.addEventListener('playerListUpdated', (event) => {
            const { players, hostId } = event.detail;
            this.uiManager.updatePlayerList(players, hostId);
            this.uiManager.updateStartButtonVisibility(hostId, this.networkManager.clientId);
        });

        this.networkManager.addEventListener('gameStarted', () => {
            this.uiManager.hideWaitingScreen();
            if (!gameState.audioInitialized) {
                this.audioManager.init().then(() => this.audioManager.startEngine());
            } else {
                this.audioManager.startEngine();
            }

            if (!this.gameStarted) {
                this.startGameLoop();
            }
        });
    }

    startGameLoop() {
        if (!this.gameStarted) {
            this.gameStarted = true;
            this.gameLoop.start();
            //console.log('🎬 Game loop started!');
        }
    }

    async restartGame(trackName) {
        console.log('🔄 Restart sequence started...');
        await this.cleanup();
        
        await new Promise(resolve => setTimeout(resolve, 50));
        await this.initGame(trackName, gameState.isMultiplayer);
        //console.log('🎯 Restart sequence complete');
    }


    async cleanup() {
       // console.log('🧹 Starting async cleanup...');

        // Reset flags
        this.initGameInProgress = false;
        this.gameStarted = false;

        // ✅ CRITICAL: Stop game loop IMMEDIATELY and clear reference
        if (this.gameLoop) {
            this.gameLoop.stop();
            this.gameLoop = null; // Clear it so physics can't run
            await new Promise(resolve => setTimeout(resolve, 50)); // Wait for frames to clear
        }

        // ✅ NOW safe to cleanup InputManager and clear data
        if (this.inputManager) {
            await this.inputManager.cleanup();
            this.inputManager = null;
        }

        // Dispose car model
        if (this.player) {
            console.log('🧹 Removing car from scene...');
            scene.remove(this.player);

            // Dispose car geometry and materials
            this.player.traverse((child) => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            material.dispose();
                        });
                    } else {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            });

            this.player = null;
            gameState.playerParts = null;
        }


        if (trackData.sceneMeshes?.length > 0) {
            console.log(`🧹 Clearing ${trackData.sceneMeshes.length} track meshes`);
            clearTrack(scene);
            trackData.sceneMeshes = []; // ✅ Only clear the mesh array
            // ❌ DON'T set trackData.curve = null or trackData.divisions = null
        }

        // Clear global references
        window.cameraManager = null;
        window.audioManager = null;
        window.memoryMonitor = null;
        window.gyroControls = null;

        // Clear local references
        this.audioManager = null;
        this.networkManager = null;
        this.uiManager = null;
        this.memoryMonitor = null;
        this.textureManager = null;
        this.cameraManager = null;

        // Force renderer cleanup
        if (renderer) {
            renderer.renderLists.dispose();
        }

        console.log('✅ Cleanup complete - Track data structure preserved');
    }
}

// Menu navigation functions
export function setupMenuNavigation(gameInitializer) {
    document.getElementById('mute-button').addEventListener('click', function () {
        muteAudio();
    });

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
        if (gameInitializer.networkManager && gameInitializer.networkManager.isConnected) {
            gameInitializer.networkManager.disconnect();
        }
    });


    document.getElementById('back-to-main-from-pause').addEventListener('click', async () => {
        console.log('📋 Back to Main clicked - starting cleanup...');
        await gameInitializer.cleanup();
        // Small delay to ensure event loop clears
        await new Promise(resolve => setTimeout(resolve, 50));
        document.getElementById('pauseMenu').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
        console.log('📋 Menu switch complete');
    });

    document.getElementById('start-singleplayer-button').addEventListener('click', function () {
        const trackSelect = document.getElementById('trackSelect-single');
        const selectedTrack = trackSelect.value;
        if (selectedTrack) {
            gameInitializer.initGame(selectedTrack, false);
            document.getElementById('track-select-menu').style.display = 'none';
        } else {
            alert('Please select a track first!');
        }
    });

    // Multiplayer button handlers
    const createRoomButton = document.getElementById('create-room-button');
    const joinRoomButton = document.getElementById('join-room-button');
    const startGameButton = document.getElementById('start-game-button');

    if (createRoomButton) {
        createRoomButton.addEventListener('click', function () {
            const playerName = document.getElementById('player-name-input')?.value || 'Player';
            const selectedTrack = document.getElementById('trackSelect-network')?.value;
            if (gameInitializer.networkManager) {
                gameInitializer.networkManager.createRoom(playerName, selectedTrack);
            }
        });
    }

    if (joinRoomButton) {
        joinRoomButton.addEventListener('click', function () {
            const playerName = document.getElementById('player-name-input')?.value || 'Player';
            const roomId = document.getElementById('room-id-input')?.value;
            if (gameInitializer.networkManager) {
                gameInitializer.networkManager.joinRoom(roomId, playerName);
            }
        });
    }

    if (startGameButton) {
        startGameButton.addEventListener('click', function () {
            if (gameInitializer.networkManager) {
                gameInitializer.networkManager.startGame();
            }
        });
    }
}

function loadTrackList(selectElementId) {
    const trackNames = getAvailableTracks();
    const select = document.getElementById(selectElementId);
    if (!select) return;

    select.innerHTML = '';
    trackNames.forEach(trackName => {
        const option = document.createElement('option');
        option.value = trackName;
        option.textContent = trackName;
        select.appendChild(option);
    });
}

// Export for global access
export { loadTrackAndRestart as loadTrackByName };