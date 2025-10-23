// --- START OF FILE carEdtior/carLoader.js ---

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// We need this utility to merge the geometries together.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const loader = new GLTFLoader();

/**
 * Loads the F1 car model, preserving its original materials but drastically
 * optimizing it by merging all meshes that share the same material.
 * This is the most effective way to reduce draw calls and eliminate the first-frame stutter.
 * @param {object} config - The car's appearance configuration (currently unused).
 * @returns {Promise<THREE.Group>} A promise that resolves with the optimized car model.
 */
export function loadCarModel(config) {
    return new Promise((resolve, reject) => {
        loader.load('./carEdtior/model/F1McLaren1024.glb', (gltf) => {
            const carModel = gltf.scene;
            const finalCarGroup = new THREE.Group();

            // --- The "Merge by Material" Strategy ---

            // 1. A map to store geometries, keyed by their material.
            const geometriesByMaterial = new Map();
            const wheels = [];

            // Ensure all world matrices are calculated before we begin.
            carModel.updateMatrixWorld(true);

            carModel.traverse((child) => {
                if (!child.isMesh) return;

                // 2. Separate the wheels so they can be animated/rotated later.
                if (child.name.startsWith('wheel_')) {
                    wheels.push(child);
                    return; // Skip merging for wheels.
                }

                // 3. For every other mesh, get its material.
                const material = child.material;
                if (!material) return; // Skip if a mesh has no material.

                // If we haven't seen this material before, create an array for it in our map.
                if (!geometriesByMaterial.has(material)) {
                    geometriesByMaterial.set(material, []);
                }

                // 4. "Bake" the mesh's position, rotation, and scale into a cloned geometry.
                const transformedGeometry = child.geometry.clone().applyMatrix4(child.matrixWorld);

                // 5. Add this baked geometry to the array for its material.
                geometriesByMaterial.get(material).push(transformedGeometry);
            });

            // 6. Now, create one merged mesh for each material.
            for (const [material, geometries] of geometriesByMaterial.entries()) {
                if (geometries.length > 0) {
                    // Merge all geometries that share this material.
                    const mergedGeometry = mergeGeometries(geometries);
                    
                    // Create a single new mesh from the merged geometry and the original material.
                    const mergedMesh = new THREE.Mesh(mergedGeometry, material);
                    
                    mergedMesh.castShadow = true;
                    mergedMesh.receiveShadow = true;
                    finalCarGroup.add(mergedMesh);
                }
            }
            
            // 7. Add the un-merged wheels back to the final group.
            wheels.forEach(wheel => {
                finalCarGroup.add(wheel);
                wheel.castShadow = true;
                wheel.receiveShadow = true; // Wheels can receive shadows from the car body
            });

            // 8. Apply final transformations to the entire optimized car group.
            finalCarGroup.scale.set(5, 5, 5);
            // Use your tuned Y-position value.
            finalCarGroup.position.y = 1.4;
            finalCarGroup.rotation.y = Math.PI;

            console.log(`Optimization Complete: Car reduced to ${finalCarGroup.children.length} objects.`);
            resolve(finalCarGroup);

        }, undefined, (error) => {
            console.error("Error loading car model:", error);
            reject(error);
        });
    });
}