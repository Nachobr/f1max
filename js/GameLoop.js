import * as THREE from 'three';
import { gameState } from './State.js';
import { CONFIG } from './Config.js';
import { carState, updatePhysics } from './CarPhysics.js';
import { trackData, roadHalfWidth } from './TrackBuilder.js';
import { checkLapCompletion } from './GameStateManager.js';
import { getMemoryStatus } from './MemoryMonitor.js';
import { scene, camera, renderer } from './SceneSetup.js';

export class GameLoop {
    constructor() {
        this.isRunning = false;
        this.animationFrameId = null;
        this.lastPhysicsUpdateTime = 0;
        this.physicsTimeStep = 1000 / 60;
        this.accumulatedPhysicsTime = 0;
        this.frameCounter = 0;
        this.networkTickRate = 1000 / CONFIG.INPUT_SEND_RATE_HZ;
        this.lastNetworkUpdate = 0;

        // Interpolation
        this.prevCarPosition = new THREE.Vector3();
        this.prevCarRotation = new THREE.Euler(0, 0, 0);
        this.currentCarPosition = new THREE.Vector3();
        this.currentCarRotation = new THREE.Euler(0, 0, 0);
        this.CAR_Y_OFFSET = 0.8;

        this.player = null;
        this.inputManager = null;
        this.audioManager = null;
        this.uiManager = null;
        this.networkManager = null;
        this.memoryMonitor = null;
        this.cameraManager = null;
    }

    init({ player, inputManager, audioManager, uiManager, networkManager, memoryMonitor, cameraManager }) {
        this.player = player;
        this.inputManager = inputManager;
        this.audioManager = audioManager;
        this.uiManager = uiManager;
        this.networkManager = networkManager;
        this.memoryMonitor = memoryMonitor;
        this.cameraManager = cameraManager;

        // Initialize interpolation states
        this.prevCarPosition.copy(carState.position);
        this.currentCarPosition.copy(carState.position);
        this.prevCarRotation.set(0, carState.rotationAngle, 0);
        this.currentCarRotation.set(0, carState.rotationAngle, 0);
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.lastPhysicsUpdateTime = performance.now();
        this.animate();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    animate(currentTime = 0) {
        if (!this.isRunning) return;

        this.animationFrameId = requestAnimationFrame((time) => this.animate(time));

        // Safety checks
        if (!this.player || !this.cameraManager) {
            console.warn('Essential components missing, skipping frame');
            return;
        }

        if (gameState.isPaused || !this.isRunning) return;

        this.updateMemoryMonitoring();
        this.updatePhysics(currentTime);
        this.updateVisuals();
        this.updateNetwork();
        this.render();
        renderer.render(scene, camera);

        if (this.frameCounter % (60 * 5) === 0) {
            console.log('HEAP DELTA:', {
                heapMB: performance.memory.usedJSHeapSize / 1048576,
                networkQueueSize: this.networkManager?.outgoingMessageQueue?.length || 0,
                inputHistoryLen: this.inputManager?.inputHistory?.length || 0,
                physicsSnapshots: window.physicsSnapshots?.length || 0
            });
        }
        this.frameCounter++;
        if (this.frameCounter >= 1000) this.frameCounter = 0;
    }

    updateMemoryMonitoring() {
        const beforeGeometries = renderer.info.memory.geometries;

        if (this.memoryMonitor) {
            this.memoryMonitor.update();

            const afterGeometries = renderer.info.memory.geometries;
            if (afterGeometries > beforeGeometries) {
                console.warn('MEMORY MONITOR LEAK:', {
                    created: afterGeometries - beforeGeometries,
                    total: afterGeometries
                });
            }
        }
    }

    updatePhysics(currentTime) {
        const deltaTime = currentTime - this.lastPhysicsUpdateTime;
        this.lastPhysicsUpdateTime = currentTime;
        this.accumulatedPhysicsTime += deltaTime;

        // Fixed physics updates
        while (this.accumulatedPhysicsTime >= this.physicsTimeStep) {
            this.prevCarPosition.copy(this.currentCarPosition);
            this.prevCarRotation.copy(this.currentCarRotation);

            const inputState = this.inputManager.getInputState();
            const gyroSteering = this.inputManager.getGyroSteering();

            const physicsResult = updatePhysics(
                inputState,
                carState,
                trackData.curve,
                trackData.divisions,
                roadHalfWidth,
                gyroSteering
            );

            const { position, rotationAngle, speed, isWrongWay, turnDirection } = physicsResult;

            this.currentCarPosition.copy(position);
            this.currentCarRotation.set(0, rotationAngle, 0);

            this.updateWheelAnimations(speed, turnDirection, gyroSteering);
            this.updateAudio(speed);

            if (this.frameCounter % 3 === 0 && this.uiManager) {
                if (checkLapCompletion(position, speed)) return;
                this.uiManager.updateHUD({ isWrongWay, speed: carState.speed });
            }

            this.accumulatedPhysicsTime -= this.physicsTimeStep;
        }
    }

    updateWheelAnimations(speed, turnDirection, gyroSteering) {
        if (!gameState.playerParts) return;

        const { wheels, wheelPivots } = gameState.playerParts;
        const wheelRadius = 0.33;
        const circumference = 2 * Math.PI * wheelRadius;
        const rotationDelta = (speed / circumference) * (this.physicsTimeStep / 1000);

        // Rotate wheels
        if (wheels.frontLeftMeshes) {
            wheels.frontLeftMeshes.forEach(mesh => mesh.rotation.x -= rotationDelta);
        }
        if (wheels.frontRightMeshes) {
            wheels.frontRightMeshes.forEach(mesh => mesh.rotation.x -= rotationDelta);
        }

        // Steer front wheels
        let steerAngle = 0;
        if (gyroSteering !== null) {
            steerAngle = gyroSteering * 0.4;
        } else if (this.inputManager.isTouchDevice) {
            steerAngle = turnDirection * 0.4;
        } else {
            steerAngle = -turnDirection * 0.4;
        }

        if (wheelPivots && wheelPivots.frontLeft) wheelPivots.frontLeft.rotation.z = steerAngle;
        if (wheelPivots && wheelPivots.frontRight) wheelPivots.frontRight.rotation.z = steerAngle;
    }

    updateAudio(speed) {
        if (this.audioManager) {
            this.audioManager.update(speed);
        }
    }

    updateVisuals() {
        if (!this.player || !this.cameraManager) return;

        const alpha = Math.max(0, Math.min(1, this.accumulatedPhysicsTime / this.physicsTimeStep));

        // Interpolate position and rotation
        this.player.position.copy(this.prevCarPosition).lerp(this.currentCarPosition, alpha);
        this.player.position.y = this.CAR_Y_OFFSET;
        this.player.rotation.y = this.prevCarRotation.y + (this.currentCarRotation.y - this.prevCarRotation.y) * alpha;

        // Update camera
        this.cameraManager.update();
    }

    updateNetwork() {
        if (!gameState.isMultiplayer || !this.networkManager || !this.networkManager.isConnected) return;

        const currentTime = performance.now();

        if (currentTime - this.lastNetworkUpdate > this.networkTickRate) {
            this.networkManager.sendInput(carState);
            this.lastNetworkUpdate = currentTime;
        }

        if (this.frameCounter % 60 === 0) {
            this.networkManager.sendInput(carState);
        }

        this.networkManager.updateRemotePlayers();
    }

    render() {
        // Rendering is handled by the main renderer in SceneSetup.js
        // This method is kept for future extensibility
    }
}