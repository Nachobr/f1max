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
            finish: null
        };
        this.currentVolume = CONFIG.DEFAULT_VOLUME;
        this.isMuted = false;
        
        // Expose to global scope for HTML buttons
        window.audioManager = this;
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
        const [idle, accel, finish] = await Promise.all([
            loadSound('/sounds/carpassing.mp3', true),
            loadSound('/sounds/f1rb2025.mp3', true),
            loadSound('/sounds/carpassing.mp3', false, false),
        ]);

        this.sounds.idle = idle;
        this.sounds.accel = accel;
        this.sounds.finish = finish;

        // Set initial volumes
        this.sounds.idle.setVolume(0.3);
        this.sounds.accel.setVolume(0.0);
        this.sounds.finish.setVolume(1.0);

        gameState.audioInitialized = true;
        //console.log("🔊 Audio system initialized.");
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

        // Engine mix
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

    // ADD THIS METHOD - FIX FOR MUTE BUTTON
    toggleMute() {
        if (!gameState.audioInitialized || !this.listener) {
            console.warn('🔊 Audio not initialized, cannot toggle mute');
            return;
        }
        
        this.isMuted = !this.isMuted;
        this.listener.setMasterVolume(this.isMuted ? 0 : this.currentVolume);
        
        // Update mute button text
        const muteButton = document.getElementById('mute-button');
        if (muteButton) {
            muteButton.textContent = this.isMuted ? 'Unmute Audio' : 'Mute Audio';
        }
        
       // console.log(`🔊 Audio ${this.isMuted ? 'muted' : 'unmuted'}`);
        return this.isMuted;
    }

    // ADD THIS METHOD - For pause functionality
    pauseAll() {
        if (!gameState.audioInitialized) return;
        Object.values(this.sounds).forEach(sound => {
            if (sound && sound.isPlaying) {
                sound.pause();
            }
        });
    }

    // ADD THIS METHOD - For resume functionality
    resumeAll() {
        if (!gameState.audioInitialized) return;
        Object.values(this.sounds).forEach(sound => {
            if (sound && !sound.isPlaying) {
                sound.play();
            }
        });
    }

    destroy() {
        this.stopAll();
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