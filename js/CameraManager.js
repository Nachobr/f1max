// --- START OF FILE js/CameraManager.js ---

import * as THREE from 'three';

export class CameraManager {
    constructor(camera, player) {
        this.camera = camera;
        this.player = player;
        this.cockpitCameraActive = false;

        // Pre-allocated vectors for zero memory allocation
        this.cameraPos = new THREE.Vector3();
        this.lookAhead = new THREE.Vector3();
        this.cameraPosition = new THREE.Vector3(); // ADD THIS
        this.lookAtTarget = new THREE.Vector3();   // ADD THIS

        // Camera settings
        this.cockpitOffset = new THREE.Vector3(0, 1.2, -0.15); // (side, height, forward/back)
        this.externalOffset = new THREE.Vector3(-10, 5, -10);
    }

    setCockpitCamera(active) {
        this.cockpitCameraActive = active;
    }

    toggleCamera() {
        this.cockpitCameraActive = !this.cockpitCameraActive;
        return this.cockpitCameraActive;
    }

    update() {
        if (!this.player || !this.camera) return;

        const playerX = this.player.position.x;
        const playerY = this.player.position.y;
        const playerZ = this.player.position.z;
        const sinY = Math.sin(this.player.rotation.y);
        const cosY = Math.cos(this.player.rotation.y);

        if (this.cockpitCameraActive) {
            this.updateCockpitCamera();
        } else {
            this.updateExternalCamera(playerX, playerY, playerZ, sinY, cosY);
        }
    }

    updateCockpitCamera() {
        // Calculate the desired camera position in the car's local space
        const desiredPosition = this.cockpitOffset.clone().applyQuaternion(this.player.quaternion);

        // Add the car's world position to get the final camera position
        this.cameraPosition.copy(this.player.position).add(desiredPosition);
        this.camera.position.copy(this.cameraPosition);

        // Calculate the look-at target
        this.lookAtTarget.set(0, 0, 100).applyQuaternion(this.player.quaternion);
        this.lookAtTarget.add(this.player.position);

        this.camera.lookAt(this.lookAtTarget);
    }

    updateExternalCamera(playerX, playerY, playerZ, sinY, cosY) {
        // External camera - pre-calculate multiplications  
        const forwardX = sinY * this.externalOffset.x;
        const forwardZ = cosY * this.externalOffset.z;

        this.camera.position.set(
            playerX + forwardX,
            playerY + this.externalOffset.y,
            playerZ + forwardZ
        );
        this.camera.lookAt(playerX, playerY, playerZ);
    }

    // Method to update camera settings if needed
    updateSettings(cockpitSettings = null, externalSettings = null) {
        if (cockpitSettings) {
            this.cockpitOffset.set(
                cockpitSettings.offsetX || -3.0,
                cockpitSettings.offsetY || 1.3,
                cockpitSettings.offsetZ || 0.2
            );
        }

        if (externalSettings) {
            this.externalOffset.set(
                externalSettings.offsetX || -10,
                externalSettings.offsetY || 5,
                externalSettings.offsetZ || -10
            );
        }
    }
}