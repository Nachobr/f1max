// CameraManager.js - Fixed version
import * as THREE from 'three';

export class CameraManager {
    constructor(camera, player) {
        this.camera = camera;
        this.player = player;
        this.cockpitCameraActive = false;

        // Pre-allocated vectors for zero memory allocation
        this.cameraPos = new THREE.Vector3();
        this.lookAhead = new THREE.Vector3();
        this.cameraPosition = new THREE.Vector3();
        this.lookAtTarget = new THREE.Vector3();

        // Camera settings - USING GITHUB VALUES
        this.cockpitOffset = new THREE.Vector3(0, 1.2, 0.15);  // FIXED: Changed z from -0.15 to 0.15
        this.externalOffset = new THREE.Vector3(-10, 5, -10); // GitHub values

        //console.log('📷 CameraManager initialized with FIXED logic');
    }

    toggleCamera() {
        this.cockpitCameraActive = !this.cockpitCameraActive;
        //console.log(`📷 Camera toggled to: ${this.cockpitCameraActive ? 'COCKPIT' : 'EXTERNAL'}`);

        // Update HUD text if the global function exists
        if (window.updateCameraHUDText) {
            window.updateCameraHUDText();
        }

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
        // FIXED cockpit logic - position INSIDE the car
        const cockpitX = playerX - sinY * this.cockpitOffset.z;  // FIXED: Changed + to -
        const cockpitY = playerY + this.cockpitOffset.y;
        const cockpitZ = playerZ - cosY * this.cockpitOffset.z;  // FIXED: Changed + to -

        this.camera.position.set(cockpitX, cockpitY, cockpitZ);

        // Look ahead in car's direction
        const lookAtX = playerX + sinY * 50;
        const lookAtZ = playerZ + cosY * 50;
        this.camera.lookAt(lookAtX, cockpitY - 0.3, lookAtZ);
    }

    updateExternalCamera(playerX, playerY, playerZ, sinY, cosY) {
        // GitHub external camera logic - THIS IS CORRECT
        const forwardX = sinY * this.externalOffset.x;
        const forwardZ = cosY * this.externalOffset.z;

        this.camera.position.set(
            playerX + forwardX,
            playerY + this.externalOffset.y,
            playerZ + forwardZ
        );

        // Look at the car
        this.camera.lookAt(playerX, playerY + 1, playerZ);
    }

    // Method to get current camera mode
    getCameraMode() {
        return this.cockpitCameraActive ? 'cockpit' : 'external';
    }

    // Optional: Update camera settings
    updateSettings(cockpitSettings = null, externalSettings = null) {
        if (cockpitSettings) {
            this.cockpitOffset.set(
                cockpitSettings.x || 0,
                cockpitSettings.y || 1.2,
                cockpitSettings.z || 0.15  // FIXED: Changed from -0.15 to 0.15
            );
        }

        if (externalSettings) {
            this.externalOffset.set(
                externalSettings.x || -10,
                externalSettings.y || 5,
                externalSettings.z || -10
            );
        }
    }
}