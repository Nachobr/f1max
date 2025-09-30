// js/NetworkManager.js
import * as THREE from 'three';
import { createF1Car } from './CarModel.js';
import { CONFIG } from './Config.js';
import { gameState } from './State.js';
import { scene } from './SceneSetup.js';

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

            this.ws.onerror = () => {
                console.error('WebSocket connection failed. Falling back to single-player mode.');
                this.isConnected = false;
                this.singlePlayerMode = true;
                resolve(false);
            };
        });
    }

    _handleMessage(event) {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'welcome':
                this.clientId = data.clientId;
                break;
            case 'joined':
                this.dispatchEvent(new CustomEvent('roomJoined', { detail: data }));
                break;
            case 'playerJoined':
            case 'playerLeft':
                // ✅ FIX: Always dispatch the full data object which includes the new hostId.
                this.dispatchEvent(new CustomEvent('playerListUpdated', { detail: data }));
                break;
            case 'gameStarted':
                this.dispatchEvent(new CustomEvent('gameStarted'));
                break;
            case 'serverTick':
                if (data.players) {
                    delete data.players[this.clientId];
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

    createRoom(playerName, track) { this.send({ type: 'createRoom', playerName, track }); }
    joinRoom(roomId, playerName) { this.send({ type: 'joinRoom', roomId, playerName }); }
    startGame() { this.send({ type: 'startGame' }); }
    sendInput(carState) { this.send({ type: 'input', state: { position: { x: carState.position.x, z: carState.position.z } } }); }

    // No changes needed below
    cleanupRemotePlayers() { for (const id of gameState.remotePlayers.keys()) { this.removeRemotePlayer(id); } }
    updateRemotePlayers() { for (const id in this.latestServerState) { const state = this.latestServerState[id]; const player = gameState.remotePlayers.get(id); if (player) { player.mesh.position.lerp(new THREE.Vector3(state.x, 0, state.z), 0.25); } } }
    addRemotePlayer(id) { if (gameState.remotePlayers.has(id)) return; const mesh = createF1Car(CONFIG.REMOTE_COLOR); scene.add(mesh); gameState.remotePlayers.set(id, { mesh }); }
    removeRemotePlayer(id) { const player = gameState.remotePlayers.get(id); if (player) { scene.remove(player.mesh); if (player.mesh.geometry) player.mesh.geometry.dispose(); if (player.mesh.material) player.mesh.material.dispose(); gameState.remotePlayers.delete(id); } }
}