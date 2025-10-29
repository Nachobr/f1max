// js/UIManager.js
import { formatTime } from './Utils.js';
import { gameState } from './State.js';

export class UIManager {
    constructor(networkManager) {
        this.networkManager = networkManager;

        // ---  DOM REFERENCES (Synchronized with index.html) ---
        this.hud = document.getElementById('hud');
        this.warning = document.getElementById('warning');
        this.pauseMenu = document.getElementById('pauseMenu');
        this.networkMenu = document.getElementById('networkMenu');
        this.audioButton = document.getElementById('audio-init-button');

        // Waiting Screen
        this.waitingScreen = document.getElementById('waiting-for-players');
        this.playerList = document.getElementById('player-list');
        this.roomIdDisplay = document.getElementById('room-id-display');
        this.startGameButton = document.getElementById('start-game-button');

        // HUD Elements
        this.hudLapElement = document.getElementById('hud-lap');
        this.hudCurrentTimeElement = document.getElementById('hud-current-time');
        this.hudLastTimeElement = document.getElementById('hud-last-time');
        this.hudBestTimeElement = document.getElementById('hud-best-time');
        this.hudSpeedElement = document.getElementById('hud-speed');

        // Buttons
        this.resumeButton = document.getElementById('resume-button');
        this.editorButton = document.getElementById('editor-button');
        this.createRoomButton = document.getElementById('create-room-button');
        this.joinRoomButton = document.getElementById('join-room-button');

        // Inputs
        this.playerNameInput = document.getElementById('playerNameInput');
        this.trackSelectNetwork = document.getElementById('trackSelect-network');
        this.roomIdInput = document.getElementById('roomIdInput');

        // Gyro Toggle

        this.mobileGyroToggle = document.getElementById('mobile-gyro-toggle');

        console.log('🎮 UIManager gyro toggles:', {
            main: !!this.gyroToggle,
            mobile: !!this.mobileGyroToggle
        });


    }



    showNotification(message, type = 'info') {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : '#2196F3'};
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 1000;
        font-family: Arial, sans-serif;
    `;

        document.body.appendChild(notification);

        // Auto remove after 2 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
    }

    showSinglePlayerMessage() {
        this.hideNetworkMenu();
        const msgDiv = document.createElement('div');
        msgDiv.textContent = 'Server not found. Starting single-player...';
        msgDiv.style.cssText = `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 101; color: white; background: rgba(0,0,0,0.9); padding: 30px; border-radius: 10px; font-size: 20px;`;
        document.body.appendChild(msgDiv);
        setTimeout(() => msgDiv.remove(), 2000);
    }

    showWaitingForPlayersScreen(roomId, players, hostId, clientId) {
        if (this.networkManager.singlePlayerMode) {
            this.roomIdDisplay.textContent = 'SINGLE PLAYER';
            this.playerList.innerHTML = `<li>${players[0].name}</li>`;
            this.startGameButton.textContent = 'Starting...';
            this.startGameButton.style.display = 'block';
            this.startGameButton.disabled = true;
        } else {
            this.roomIdDisplay.textContent = `ROOM ID: ${roomId}`;
            this.updatePlayerList(players, hostId);
            this.updateStartButtonVisibility(hostId, clientId);
        }
        this.hideNetworkMenu();
        this.waitingScreen.style.display = 'block';
    }

    updateStartButtonVisibility(hostId, clientId) {
        if (hostId === clientId) {
            this.startGameButton.style.display = 'block';
            this.startGameButton.disabled = false;
            this.startGameButton.textContent = 'Start Race (Host Only)';
        } else {
            this.startGameButton.style.display = 'block';
            this.startGameButton.disabled = true;
            this.startGameButton.textContent = 'Waiting for Host to Start...';
        }
    }

    updateMemoryStatus(status) {
        const memoryElement = document.getElementById('memory-status');
        if (memoryElement) {
            memoryElement.textContent = `Memory: ${status}`;
        }
    }

    updatePlayerList(players, hostId) {
        this.playerList.innerHTML = '';
        players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = player.name;
            if (player.id === hostId) {
                li.textContent += ' (Host)';
                li.style.color = '#ffdd77';
            }
            this.playerList.appendChild(li);
        });
    }

    showNetworkMenu() { if (this.networkMenu) this.networkMenu.style.display = 'block'; }
    hideNetworkMenu() { if (this.networkMenu) this.networkMenu.style.display = 'none'; }
    hideWaitingScreen() { if (this.waitingScreen) this.waitingScreen.style.display = 'none'; }
    populateTrackSelect(tracks) { if (this.trackSelectNetwork) { this.trackSelectNetwork.innerHTML = tracks.map(t => `<option value="${t}">${t}</option>`).join(''); } }
    updateHUD(data) {
        if (!this.hud) return;
        this.hudLapElement.textContent = `Lap: ${gameState.currentLap}/${gameState.totalLaps}`;
        this.hudCurrentTimeElement.textContent = `Time: ${formatTime(performance.now() - gameState.lapStartTime)}`;
        this.hudLastTimeElement.textContent = `Last: ${gameState.lapTimes.length > 0 ? formatTime(gameState.lapTimes.slice(-1)[0]) : '--:--.---'}`;
        this.hudBestTimeElement.textContent = `Best: ${gameState.bestLapTime === Infinity ? '--:--.---' : formatTime(gameState.bestLapTime)}`;
        this.hudSpeedElement.textContent = `Speed: ${Math.round(data.speed * 189)} KM/H`;
        this.warning.style.display = data.isWrongWay ? 'block' : 'none';
        if (this.hudSpeedElement && window.gyroControls) {
            const gyroStatus = window.gyroControls.enabled ? 'GYRO' : 'TOUCH';
            this.hudSpeedElement.textContent = `Speed: ${Math.round(data.speed * 189)} KM/H [${gyroStatus}]`;
        }
    }
    togglePauseMenu() { if (this.pauseMenu) { this.pauseMenu.style.display = gameState.isPaused ? 'block' : 'none'; } }
    showRaceResults() { const totalTime = performance.now() - gameState.startTime; let resultsHTML = `<h2>Race Finished!</h2><p>Total Time: ${formatTime(totalTime)}</p><button onclick="window.location.reload()">Back to Menu</button>`; if (this.pauseMenu) { this.pauseMenu.innerHTML = resultsHTML; this.pauseMenu.style.display = 'block'; } }
}