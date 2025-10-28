import { gameState } from './State.js';
import { carState } from './CarPhysics.js';
import { trackData, loadTrackDefinition, generateTrackMesh, clearTrack } from './TrackBuilder.js';
import { getTrackProperties } from './Utils.js';

let uiManager;
let audioManager;
let networkManager;
let renderer; // Need renderer reference for memory logging

export function initGameManager(ui, audio, network) {
    uiManager = ui;
    audioManager = audio;
    networkManager = network;
}

// Add renderer reference for memory monitoring
export function setRenderer(ref) {
    renderer = ref;
}

/** Toggles the game's paused state. */
export function togglePause() {
    gameState.isPaused = !gameState.isPaused;
    uiManager.togglePauseMenu();
}

/** Handles the logic for completing a lap. */
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
        return true; // Race is finished
    }

    gameState.currentLap++;
    return false; // Race continues
}

/** Resets and restarts the game with a given track. */
export function loadTrackAndRestart(trackName, scene, camera, player) {
    console.log(`🔄 Loading track ${trackName} - Current geometries: ${renderer ? renderer.info.memory.geometries : 'N/A'}`);
    
    // COMPREHENSIVE CLEANUP BEFORE LOADING NEW TRACK
    if (trackData.sceneMeshes?.length > 0) {
        console.log(`🧹 Clearing ${trackData.sceneMeshes.length} track meshes`);
        clearTrack(scene);
    }
    
    // Cleanup remote players
    if (gameState.remotePlayers && gameState.remotePlayers.size > 0) {
        console.log(`🧹 Clearing ${gameState.remotePlayers.size} remote players`);
        gameState.remotePlayers.forEach(({ mesh }) => {
            if (mesh && scene) scene.remove(mesh);
            // Dispose remote player geometries/materials if needed
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
    
    if (uiManager) {
        uiManager.togglePauseMenu();
        uiManager.hideNetworkMenu();
    }

    // Reset camera position
    if (camera && startPosition) {
        const carForwardAngle = rotationAngle - Math.PI / 2;
        const backwardX = startPosition.x - 12 * Math.cos(carForwardAngle);
        const backwardZ = startPosition.z - 12 * Math.sin(carForwardAngle);
        camera.position.set(backwardX, 6, backwardZ);
    }
    
    if (audioManager) {
        audioManager.stopAll();
        audioManager.startEngine();
    }
    
    console.log(`✅ Track loaded - New geometries: ${renderer ? renderer.info.memory.geometries : 'N/A'}`);
    console.log(`📊 Track meshes: ${trackData.sceneMeshes ? trackData.sceneMeshes.length : 0}`);
}

/** Checks if a lap has been completed. */
export function checkLapCompletion(position, speed) {
    if (!trackData.curve) return false;
    
    const trackProps = getTrackProperties(position, trackData.curve, trackData.divisions, carState.currentT);
    carState.currentT = trackProps.closestT;

    // Lap Detection Logic
    if (gameState.previousT > 0.95 && carState.currentT < 0.05 && speed > 0.5) {
        if (handleLapFinish()) {
            return true; // Race finished
        }
    }
    gameState.previousT = carState.currentT;
    return false; // Race continues
}