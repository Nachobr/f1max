import { gameState } from './State.js';
import { carState } from './CarPhysics.js';
import { trackData, loadTrackDefinition, generateTrackMesh, clearTrack } from './TrackBuilder.js';
import { getTrackProperties } from './Utils.js';

let uiManager;
let audioManager;
let networkManager;
let renderer;

// NEW: Track kerb state for audio feedback
let wasOnKerb = false;

export function initGameManager(ui, audio, network) {
    uiManager = ui;
    audioManager = audio;
    networkManager = network;
}

export function setRenderer(ref) {
    renderer = ref;
}

export function togglePause() {
    
    gameState.isPaused = !gameState.isPaused;
    

    if (uiManager) {
        uiManager.togglePauseMenu();
    } else {
        console.warn('❌ UIManager not available in GameStateManager');
    }

    // Make sure the function is globally available
    window.gameStateManager = { togglePause };
}

export function handleLapFinish() {
    const currentTime = performance.now();
    const newLapTime = currentTime - gameState.lapStartTime;

    gameState.lapTimes.push(newLapTime);
    if (newLapTime < gameState.bestLapTime) {
        gameState.bestLapTime = newLapTime;
    }
    gameState.lapStartTime = currentTime;

    if (gameState.currentLap >= gameState.totalLaps) {
        gameState.isPaused = true;
        audioManager.playFinishSound();
        uiManager.showRaceResults();
        return true;
    }

    gameState.currentLap++;
    return false;
}

// NEW: Handle kerb audio feedback
export function updateKerbFeedback(isOnKerb) {
    if (isOnKerb && !wasOnKerb) {
        // Just hit kerb - play sound
        if (audioManager) {
            audioManager.playKerbSound();
        }
    }
    wasOnKerb = isOnKerb;
}

export function loadTrackAndRestart(trackName, scene, camera, player) {
    // Clear existing track
    if (trackData.sceneMeshes?.length > 0) {
        clearTrack(scene);
    }

    // Cleanup remote players
    if (gameState.remotePlayers && gameState.remotePlayers.size > 0) {
        gameState.remotePlayers.forEach(({ mesh }) => {
            if (mesh && scene) scene.remove(mesh);
            if (mesh && mesh.geometry) mesh.geometry.dispose();
            if (mesh && mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(material => material.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        });
        gameState.remotePlayers.clear();
    }

    // Load and generate new track
    loadTrackDefinition(trackName);
    generateTrackMesh(scene);

    // Reset car physics state
    const startPosition = trackData.curve.getPointAt(0);
    const tempTangent = trackData.curve.getTangentAt(0);
    const rotationAngle = Math.atan2(tempTangent.x, tempTangent.z);

    carState.position.copy(startPosition);
    carState.rotationAngle = rotationAngle;
    carState.velocityAngle = rotationAngle;
    carState.speed = 0;
    carState.currentT = 0;
    carState.isOnKerb = false; // NEW: Reset kerb state
    carState.kerbEffectTimer = 0; // NEW

    if (player) {
        player.position.copy(carState.position);
        player.rotation.y = carState.rotationAngle;
    }

    // Reset game state
    gameState.currentLap = 1;
    gameState.previousT = 0;
    gameState.lapTimes = [];
    gameState.bestLapTime = Infinity;
    gameState.startTime = performance.now();
    gameState.lapStartTime = performance.now();
    gameState.isPaused = false;

    // NEW: Reset kerb feedback state
    wasOnKerb = false;

    if (uiManager) {
        uiManager.togglePauseMenu();
        uiManager.hideNetworkMenu();
    }

    // Camera positioning
    if (camera && startPosition) {
        const carForwardAngle = rotationAngle;
        const cameraDistance = 15;
        const cameraHeight = 8;

        const cameraX = startPosition.x - Math.sin(carForwardAngle) * cameraDistance;
        const cameraZ = startPosition.z - Math.cos(carForwardAngle) * cameraDistance;

        camera.position.set(cameraX, cameraHeight, cameraZ);
        camera.lookAt(startPosition.x, startPosition.y + 2, startPosition.z);
    }

    if (audioManager) {
        audioManager.stopAll();
        audioManager.startEngine();
    }
}

export function checkLapCompletion(position, speed) {
    if (!trackData.curve) return false;

    const trackProps = getTrackProperties(position, trackData.curve, trackData.divisions, carState.currentT);
    carState.currentT = trackProps.closestT;

    if (gameState.previousT > 0.95 && carState.currentT < 0.05 && speed > 0.5) {
        if (handleLapFinish()) {
            return true;
        }
    }
    gameState.previousT = carState.currentT;
    return false;
}