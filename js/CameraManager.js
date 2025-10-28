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
        
        // Camera settings
        this.cockpitOffset = new THREE.Vector3(-3.0, 1.3, 0.2);
        this.cockpitLookAt = new THREE.Vector3(10, 0, 10);
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
            this.updateCockpitCamera(playerX, playerY, playerZ, sinY, cosY);
        } else {
            this.updateExternalCamera(playerX, playerY, playerZ, sinY, cosY);
        }
    }

    updateCockpitCamera(playerX, playerY, playerZ, sinY, cosY) {
        // Cockpit camera - pre-calculate multiplications
        const forwardX = sinY * this.cockpitOffset.x;
        const forwardZ = cosY * this.cockpitOffset.z;
        const lookX = sinY * this.cockpitLookAt.x;
        const lookZ = cosY * this.cockpitLookAt.y;

        this.camera.position.set(
            playerX + forwardX,
            playerY + this.cockpitOffset.y,
            playerZ + forwardZ
        );
        this.camera.lookAt(
            playerX + lookX,
            playerY,
            playerZ + lookZ
        );
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
            this.cockpitLookAt.set(
                cockpitSettings.lookX || 10,
                cockpitSettings.lookY || 0,
                cockpitSettings.lookZ || 10
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