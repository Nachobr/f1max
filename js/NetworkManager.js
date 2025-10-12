// js/NetworkManager.js
import * as THREE from 'three';
import { createF1Car } from './CarModel.js';
import { CONFIG } from './Config.js';
import { gameState } from './State.js';
import { scene } from './SceneSetup.js';
import { carState } from './CarPhysics.js'; // ✅ ADD THIS IMPORT

export class NetworkManager extends EventTarget {
    constructor() {
        super();
        this.ws = null;
        this.clientId = null;
        this.isConnected = false;
        this.latestServerState = {};
        this.singlePlayerMode = false;
    }

    connect() {
        return new Promise((resolve) => {
            this.ws = new WebSocket(CONFIG.SERVER_URL);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.singlePlayerMode = false;
                console.log('WebSocket connected.');
                resolve(true);
            };

            this.ws.onmessage = this._handleMessage.bind(this);
            this.ws.onclose = () => {
                this.isConnected = false;
                console.log('WebSocket disconnected.');
                this.cleanupRemotePlayers();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
                this.singlePlayerMode = true;
                console.log('Falling back to single-player mode.');
                resolve(false);
            };
        });
    }

    _handleMessage(event) {
        const data = JSON.parse(event.data);
        console.log(`Received message type: ${data.type}`, data); // ✅ DEBUG

        switch (data.type) {
            case 'welcome':
                this.clientId = data.clientId;
                break;
            case 'joined':
            case 'playerJoined':
            case 'playerLeft':
                console.log(`Player list update:`, data.players); // ✅ DEBUG
                this.updatePlayerMeshes(data.players);
                this.dispatchEvent(new CustomEvent(data.type === 'joined' ? 'roomJoined' : 'playerListUpdated', { detail: data }));
                break;
            case 'gameStarted':
                console.log('Game started event received'); // ✅ DEBUG
                this.dispatchEvent(new CustomEvent('gameStarted'));
                break;
            case 'serverTick':
                console.log(`Server tick received, players in state:`, Object.keys(data.players || {})); // ✅ DEBUG
                if (data.players) {
                    delete data.players[this.clientId]; // Remove self
                    this.latestServerState = data.players;
                }
                break;
        }
    }

    send(data) {
        if (this.singlePlayerMode) {
            this._handleSinglePlayerMessage(data);
            return;
        }
        if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('WebSocket not connected, cannot send:', data.type);
        }
    }

    _handleSinglePlayerMessage(data) {
        switch (data.type) {
            case 'createRoom':
                this.clientId = 'host-singleplayer';
                const roomDetails = {
                    roomId: 'SINGLE',
                    players: [{ id: this.clientId, name: data.playerName }],
                    track: data.track,
                    hostId: this.clientId
                };
                this.dispatchEvent(new CustomEvent('roomJoined', { detail: roomDetails }));
                break;
            case 'startGame':
                this.dispatchEvent(new CustomEvent('gameStarted'));
                break;
        }
    }

    createRoom(playerName, track) {
        this.send({ type: 'createRoom', playerName, track });
    }

    joinRoom(roomId, playerName) {
        this.send({ type: 'joinRoom', roomId, playerName });
    }

    startGame() {
        this.send({ type: 'startGame' });
    }

    sendInput(carState) {
        if (!carState) {
            console.warn('No carState provided to sendInput');
            return;
        }

        this.send({
            type: 'input',
            state: {
                position: {
                    x: carState.position.x,
                    z: carState.position.z
                },
                rotationAngle: carState.rotationAngle
            }
        });
    }

    // js/NetworkManager.js - UPDATED updatePlayerMeshes function
    updatePlayerMeshes(players) {
        const serverPlayerIds = new Set(players.map(p => p.id));

        console.log('Updating player meshes. Server players:', players.map(p => p.id));
        console.log('Current remote players:', Array.from(gameState.remotePlayers.keys()));

        // Remove players that left
        for (const localId of gameState.remotePlayers.keys()) {
            if (!serverPlayerIds.has(localId)) {
                console.log(`Removing remote player: ${localId}`);
                this.removeRemotePlayer(localId);
            }
        }

        // ✅ FIX: Add ALL remote players (excluding self)
        for (const player of players) {
            if (player.id !== this.clientId && !gameState.remotePlayers.has(player.id)) {
                console.log(`Adding remote player: ${player.id}`);
                this.addRemotePlayer(player.id);
            }
        }

        console.log(`Final remote players:`, Array.from(gameState.remotePlayers.keys()));
    }

    addRemotePlayer(id) {
        if (gameState.remotePlayers.has(id)) return;
        const mesh = createF1Car(CONFIG.REMOTE_COLOR);
        mesh.name = `remoteCar_${id}`; // ✅ Give it a name for debugging
        scene.add(mesh);
        gameState.remotePlayers.set(id, { mesh });
        console.log(`SUCCESS: Added 3D model for remote player ${id}`);
    }

    removeRemotePlayer(id) {
        const player = gameState.remotePlayers.get(id);
        if (player) {
            scene.remove(player.mesh);
            if (player.mesh.geometry) player.mesh.geometry.dispose();
            if (player.mesh.material) player.mesh.material.dispose();
            gameState.remotePlayers.delete(id);
            console.log(`Removed remote player: ${id}`);
        }
    }

    cleanupRemotePlayers() {
        for (const id of gameState.remotePlayers.keys()) {
            this.removeRemotePlayer(id);
        }
    }

    updateRemotePlayers() {
        for (const id in this.latestServerState) {
            const state = this.latestServerState[id];
            const player = gameState.remotePlayers.get(id);
            if (player && state.x !== undefined && state.z !== undefined && state.rotY !== undefined) {
                player.mesh.position.lerp(new THREE.Vector3(state.x, 0, state.z), 0.25);
                const targetQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, state.rotY, 0));
                player.mesh.quaternion.slerp(targetQuaternion, 0.25);

                console.log(`Updating remote player ${id} position:`, state.x, state.z); // ✅ DEBUG
            }
        }
    }
}