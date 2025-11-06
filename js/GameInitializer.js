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

export class GameInitializer {
    constructor() {
        this.gameStarted = false;
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

        this.initGameCallId = Math.random().toString(36).substr(2, 9);
        console.log(`🔢 InitGame Instance ID: ${this.initGameCallId}`);
        this.gameStarted = false;
        gameState.isMultiplayer = isMultiplayer;

        if (this.inputManager) {
            this.inputManager.cleanup();
            this.inputManager = null;
        }

        if (this.gameLoop) {
            this.gameLoop.stop();
            this.gameLoop = null;
        }



        // Initialize core systems
        this.memoryMonitor = new MemoryMonitor(renderer, scene);
        this.textureManager = new TextureManager(renderer);
        // Reuse InputManager if it exists, otherwise create a new one
        if (!this.inputManager) {
            this.inputManager = new InputManager();
        }
        this.uiManager = new UIManager(this.networkManager);

        this.gameLoop = new GameLoop();

        try {
            // Create player car
            //console.log('🚗 Creating player car...');
            const car = await createF1Car();
            this.player = car.model;
            gameState.playerParts = car.parts;
            this.player.name = "playerCar";
            scene.add(this.player);
            //console.log('✅ Player car created and added to scene');
        } catch (error) {
            //console.warn('Error creating car, using default:', error);
            const car = await createF1Car();
            this.player = car.model;
            gameState.playerParts = car.parts;
            this.player.name = "playerCar";
            scene.add(this.player);
        }

        // Initialize camera manager
        //console.log('📷 Initializing camera manager...');
        this.cameraManager = new CameraManager(camera, this.player);
        window.cameraManager = this.cameraManager;

        // Initialize audio manager
        //console.log('🔊 Initializing audio manager...');
        this.audioManager = new AudioManager(camera, this.player);
        await this.audioManager.init();


        // Initialize network if multiplayer
        if (gameState.isMultiplayer) {
            //console.log('🌐 Initializing network manager...');
            this.networkManager = new NetworkManager();
            await this.networkManager.connect();
            gameState.networkManager = this.networkManager;
            // Update UI manager with network manager
            this.uiManager.setNetworkManager(this.networkManager);
        }



        // Initialize input system
        //console.log('🎮 Initializing input manager...');
        this.inputManager.init(this.uiManager, this.audioManager, this.cameraManager);

        // Setup game state manager
        //console.log('📊 Setting up game manager...');
        initGameManager(this.uiManager, this.audioManager, this.networkManager);
        setRenderer(renderer);

        // Setup game loop
        //console.log('🔄 Setting up game loop...');
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
        //console.log('🏁 Loading track and starting game...');
        loadTrackAndRestart(trackName, scene, camera, this.player);

        // Start audio engine
        //console.log('🔊 Starting audio engine...');
        this.audioManager.startEngine();

        this.startGameLoop();
        //console.log('✅ Game initialization complete!');
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
        await this.cleanup();
        await this.initGame(trackName, gameState.isMultiplayer);
    }

    async cleanup() {
        console.log('🧹 InputManager cleaning up - removing listeners');
        this.gameStarted = false;

        if (this.gameLoop) {
            this.gameLoop.stop();
        }



        if (this.inputManager) {
            this.inputManager.cleanup();
        }

        // Clean up global references
        window.cameraManager = null;
        window.audioManager = null;
        window.memoryMonitor = null;
        window.gyroControls = null;

        this.player = null;
        this.audioManager = null;
        this.networkManager = null;
        this.uiManager = null;
        this.inputManager = null;
        this.gameLoop = null;
        this.gameStateManager = null;
        this.memoryMonitor = null;
        this.textureManager = null;
        this.cameraManager = null;

        //console.log('✅ Game cleanup complete');
    }
}

// Menu navigation functions
export function setupMenuNavigation(gameInitializer) {
    document.getElementById('mute-button').addEventListener('click', function () {
        //console.log('🔊 Pause menu mute button clicked');
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
        await gameInitializer.cleanup();
        document.getElementById('pauseMenu').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
    });

    document.getElementById('start-singleplayer-button').addEventListener('click', function () {
        const trackSelect = document.getElementById('trackSelect-single');
        const selectedTrack = trackSelect.value;
        if (selectedTrack) {
            //console.log(`🎮 Starting single player game with track: ${selectedTrack}`);
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