import * as THREE from 'three';
import { gameState } from './State.js';
import { CONFIG } from './Config.js';

export class AudioManager {
    constructor(camera, playerMesh) {
        this.camera = camera;
        this.playerMesh = playerMesh;
        this.listener = null;
        this.sounds = {
            idle: null,
            accel: null,
            brake: null,
            finish: null,
        };
        this.currentVolume = CONFIG.DEFAULT_VOLUME;
        this.isMuted = false; // New property to track mute state
    }

    async init() {
        if (gameState.audioInitialized) return;

        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        this.listener.setMasterVolume(this.currentVolume);

        const audioLoader = new THREE.AudioLoader();
        const loadSound = (path, loop = false, positional = true) => {
            return new Promise((resolve, reject) => {
                const sound = positional ? new THREE.PositionalAudio(this.listener) : new THREE.Audio(this.listener);
                if (positional) this.playerMesh.add(sound);

                audioLoader.load(path,
                    (buffer) => {
                        sound.setBuffer(buffer);
                        sound.setLoop(loop);
                        resolve(sound);
                    },
                    undefined,
                    (error) => {
                        console.error(`Failed to load sound: ${path}`, error);
                        reject(error);
                    }
                );
            });
        };

        // Load all sounds in parallel
        const [idle, accel, brake, finish] = await Promise.all([
            loadSound('/sounds/f1_accel.mp3', true),
            loadSound('/sounds/F1EngineAcceleration.mp3', true),
            loadSound('/sounds/f1_brake.mp3', true),
            loadSound('/sounds/carpassing.mp3', false, false), // Global sound
        ]);
        
        this.sounds.idle = idle;
        this.sounds.accel = accel;
        this.sounds.brake = brake;
        this.sounds.finish = finish;

        // Set initial volumes
        this.sounds.idle.setVolume(0.3);
        this.sounds.accel.setVolume(0.0);
        this.sounds.brake.setVolume(0.8);
        this.sounds.finish.setVolume(1.0);

        gameState.audioInitialized = true;
        console.log("Audio system initialized.");
    }

    startEngine() {
        if (!gameState.audioInitialized) return;
        if (this.sounds.idle && !this.sounds.idle.isPlaying) this.sounds.idle.play();
        if (this.sounds.accel && !this.sounds.accel.isPlaying) this.sounds.accel.play();
    }

    stopAll() {
        if (!gameState.audioInitialized) return;
        Object.values(this.sounds).forEach(sound => sound?.stop());
    }
    
    playFinishSound() {
        this.stopAll();
        this.sounds.finish?.play();
    }

    update(speed) {
        if (!gameState.audioInitialized || !this.sounds.idle || !this.sounds.accel) return;

        const { keys } = gameState;
        const maxSpeed = CONFIG.MAX_SPEED;
        const pitch = 0.6 + THREE.MathUtils.clamp(Math.abs(speed) / maxSpeed, 0, 1) * 1.2;

        this.sounds.idle.setPlaybackRate(pitch);
        this.sounds.accel.setPlaybackRate(pitch);
        
        // Engine sound logic
        if (keys['w'] && speed >= 0.1) {
            this.sounds.idle.setVolume(0.1);
            this.sounds.accel.setVolume(0.7);
            if (this.sounds.brake?.isPlaying) this.sounds.brake.stop();
        } else if (Math.abs(speed) < 0.1) { // Idle
            this.sounds.idle.setVolume(keys['w'] ? 0.3 : 0.5);
            this.sounds.accel.setVolume(keys['w'] ? 0.2 : 0.0);
            if (this.sounds.brake?.isPlaying) this.sounds.brake.stop();
        } else { // Coasting
            this.sounds.idle.setVolume(0.3);
            this.sounds.accel.setVolume(0.0);
        }

        // Brake sound
        if (keys['s'] && speed > 0.1 && this.sounds.brake && !this.sounds.brake.isPlaying) {
            this.sounds.brake.play();
        }
    }
    toggleMute() {
        if (!gameState.audioInitialized) return;
        this.isMuted = !this.isMuted;
        this.listener.setMasterVolume(this.isMuted ? 0 : this.currentVolume);
        // Optionally update UI button text
        const muteButton = document.getElementById('mute-button');
        if (muteButton) {
            muteButton.textContent = this.isMuted ? 'Unmute Audio' : 'Mute Audio';
        }
    }
}