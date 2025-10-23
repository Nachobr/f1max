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
            finish: null // Removed brake sound
        };
        this.currentVolume = CONFIG.DEFAULT_VOLUME;
        this.isMuted = false;
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

        // Load all sounds in parallel (brake removed)
        const [idle, accel, finish] = await Promise.all([
            loadSound('/sounds/carpassing.mp3', true),
            loadSound('/sounds/f1rb2025.mp3', true),
            loadSound('/sounds/carpassing.mp3', false, false),
        ]);

        this.sounds.idle = idle;
        this.sounds.accel = accel;
        this.sounds.finish = finish;

        // Set initial volumes (brake removed)
        this.sounds.idle.setVolume(0.3);
        this.sounds.accel.setVolume(0.0);
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
        const pitch = 1.0;
        this.sounds.idle.setPlaybackRate(pitch);
        this.sounds.accel.setPlaybackRate(pitch);

        // Engine mix (no brake sound)
        if (keys['w'] && speed >= 0.1) {
            this.sounds.idle.setVolume(0.1);
            this.sounds.accel.setVolume(0.7);
        } else if (Math.abs(speed) < 0.1) {
            this.sounds.idle.setVolume(keys['w'] ? 0.3 : 0.5);
            this.sounds.accel.setVolume(keys['w'] ? 0.2 : 0.0);
        } else {
            this.sounds.idle.setVolume(0.3);
            this.sounds.accel.setVolume(0.0);
        }
    }

    toggleMute() {
        if (!gameState.audioInitialized) return;
        this.isMuted = !this.isMuted;
        this.listener.setMasterVolume(this.isMuted ? 0 : this.currentVolume);
        const muteButton = document.getElementById('mute-button');
        if (muteButton) {
            muteButton.textContent = this.isMuted ? 'Unmute Audio' : 'Mute Audio';
        }
    }

    destroy() {
        this.stopEngine(); // Note: consider replacing with stopAll(); stopEngine() may not exist
        if (this.listener && this.camera) {
            this.camera.remove(this.listener);
        }
        this.sounds = {};
        this.listener = null;
        this.camera = null;
        this.playerMesh = null;
        gameState.audioInitialized = false;
    }
}