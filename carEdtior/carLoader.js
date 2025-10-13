import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export async function createF1CarFromConfig(config = null) {
    const car = new THREE.Group();

    // Default configuration
    const defaultConfig = {
        colors: {
            body: '#1e22aa',
            accent: '#fff500',
            red: '#ff0000'
        },
        dimensions: {
            bodyLength: 3.5,
            bodyWidth: 1.2,
            wingWidth: 2.8,
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
            branding: true
        }
    };

    const cfg = config ? { ...defaultConfig, ...config } : defaultConfig;

    // Load the GLB model
    const glbModel = await loadF1CarModel();
    car.add(glbModel);

    // Apply configurations to the loaded model if needed (e.g., color changes)
    // This part would depend on how the GLB model is structured and what parts are colorable.
    // For now, we'll just add the model.

    return car;
}

async function loadF1CarModel() {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
        loader.load(
            './carEdtior/model/F1.glb',
            (gltf) => {
                // Adjust position and scale if necessary
                gltf.scene.scale.set(5, 5, 5); // Adjust as needed
                gltf.scene.position.set(0, 1, 0); // Adjust as needed
                resolve(gltf.scene);
            },
            undefined, // onProgress callback
            (error) => {
                console.error('An error occurred while loading the GLB model:', error);
                reject(error);
            }
        );
    });
}