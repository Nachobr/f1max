// --- START OF FILE js/CarModel.js ---

import * as THREE from "three";
// The function in carLoader is now called `loadCarModel`
import { loadCarModel } from "../carEditor/carLoader.js";

/**
 * Creates and returns a modern F1 car mesh group using configuration from the editor.
 * @param {Object} config - Car configuration object (optional, uses localStorage or defaults).
 * @returns {THREE.Group} The F1 car mesh.
 */
export async function createF1Car(config = null) {
    // Load config from localStorage if not provided
    let cfg = config;
    if (!cfg) {
        try {
            const savedConfig = localStorage.getItem('f1_car_config');
            if (savedConfig) {
                cfg = JSON.parse(savedConfig);
            }
        } catch (error) {
            console.warn('Failed to load saved car config, using defaults:', error);
        }
    }

    // ✅ FIX: Updated default config structure to match the new carLoader.js
    const defaultConfig = {
        body: {
            color: '#1e22aa', // Red Bull blue
            roughness: 0.4,
            metalness: 0.2,
        }
    };
    
    // Merge the loaded config over the default one
    cfg = cfg ? { ...defaultConfig, ...cfg } : defaultConfig;
    
    return await loadCarModel(cfg);
}