import { gameState } from './State.js';
import { carState } from './CarPhysics.js';
import { trackData, loadTrackDefinition, generateTrackMesh, clearTrack } from './TrackBuilder.js';
import { getTrackProperties } from './Utils.js';

let uiManager;
let audioManager;
let networkManager;
let renderer;

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
    uiManager.togglePauseMenu();
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

export function loadTrackAndRestart(trackName, scene, camera, player) {
    //console.log(`🔄 Loading track ${trackName} - Current geometries: ${renderer ? renderer.info.memory.geometries : 'N/A'}`);

    // Clear existing track
    if (trackData.sceneMeshes?.length > 0) {
        //console.log(`🧹 Clearing ${trackData.sceneMeshes.length} track meshes`);
        clearTrack(scene);
    }

    // Cleanup remote players
    if (gameState.remotePlayers && gameState.remotePlayers.size > 0) {
        //console.log(`🧹 Clearing ${gameState.remotePlayers.size} remote players`);
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

    if (player) {
        player.position.copy(carState.position);
        player.rotation.y = carState.rotationAngle;
        //console.log(`🚗 Player positioned at:`, carState.position);
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

    // FIXED: Better camera positioning
    if (camera && startPosition) {
        // Position camera behind and above the car
        const carForwardAngle = rotationAngle;
        const cameraDistance = 15;
        const cameraHeight = 8;

        const cameraX = startPosition.x - Math.sin(carForwardAngle) * cameraDistance;
        const cameraZ = startPosition.z - Math.cos(carForwardAngle) * cameraDistance;

        camera.position.set(cameraX, cameraHeight, cameraZ);
        camera.lookAt(startPosition.x, startPosition.y + 2, startPosition.z);

        //console.log(`📷 Camera positioned at:`, camera.position, `looking at:`, startPosition);
    }

    if (audioManager) {
        audioManager.stopAll();
        audioManager.startEngine();
    }

    //console.log(`✅ Track loaded - New geometries: ${renderer ? renderer.info.memory.geometries : 'N/A'}`);
    //console.log(`📊 Track meshes: ${trackData.sceneMeshes ? trackData.sceneMeshes.length : 0}`);
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