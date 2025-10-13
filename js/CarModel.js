import * as THREE from "three";
import { createF1CarFromConfig } from "../carEdtior/carLoader.js";

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

    // Default configuration matching editor defaults
    const defaultConfig = {
        colors: {
            body: '#1e22aa',
            accent: '#fff500', 
            red: '#ff0000'
        },
        dimensions: {
            bodyLength: 3.5,
            bodyWidth: 1.2,
            bodyHeight: 0.8,
            wingWidth: 2.8,
            frontWingWidth: 2.8,
            bodyRoundness: 0.5,
            sidepodRadius: 0.2,
            sidepodLength: 0.8,
            sidepodXOffset: 0.6,
            sidepodZScale: 1.0,
            sidepodZOffset: 0.2
        },
        features: {
            halo: true,
            sidepods: true,
            wingElements: true,
            branding: true,
            wheels: true
        },
        material: {
            shininess: 80,
            type: 'phong'
        }
    };
    
    cfg = cfg ? { ...defaultConfig, ...cfg } : defaultConfig;
    
    return await createF1CarFromConfig(cfg);
}