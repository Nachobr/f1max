import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export function loadCarModel(config = {}) {
    return new Promise((resolve, reject) => {
        loader.load('./carEditor/model/rb212025n.glb', (gltf) => {
            const carModel = gltf.scene || gltf.scenes[0];
            if (!carModel) {
                return reject("No scene found in the GLB file.");
            }

            // Apply scale and transformations
            carModel.scale.set(150, 150, 150);
            carModel.position.y = 1.4;
            carModel.rotation.y = Math.PI;
            carModel.updateMatrixWorld(true);

            // Wheel identification
            const animatableParts = {
                wheels: {
                    frontLeftMeshes: [],
                    frontRightMeshes: []
                },
                wheelPivots: {
                    frontLeft: carModel.getObjectByName('Object_445'),
                    frontRight: carModel.getObjectByName('Object_446')
                }
            };



            // Function to find and keep both rim and tire
            const keepRimAndTire = (pivot, side) => {
                if (!pivot) return;

                const allWheels = [];
                pivot.traverse(child => {
                    if (child.isMesh && child.name && child.name.includes('wheel_front_')) {
                        allWheels.push({
                            mesh: child,
                            name: child.name,
                            vertices: child.geometry?.attributes?.position?.count || 0,
                            material: child.material?.name || 'unknown'
                        });
                    }
                });



                // Find the RIM (highest vertex count with "wheels" material)
                const rim = allWheels.find(w => w.material === 'wheels' && w.vertices > 6000);
                // Find the TIRE (high vertex count with "wheel_sk" material)  
                const tire = allWheels.find(w => w.material === 'wheel_sk' && w.vertices > 5000);



                // Keep both rim and tire
                if (rim) {

                    if (side === 'Front Left') {
                        animatableParts.wheels.frontLeftMeshes.push(rim.mesh);
                    } else {
                        animatableParts.wheels.frontRightMeshes.push(rim.mesh);
                    }
                }

                if (tire) {

                    if (side === 'Front Left') {
                        animatableParts.wheels.frontLeftMeshes.push(tire.mesh);
                    } else {
                        animatableParts.wheels.frontRightMeshes.push(tire.mesh);
                    }
                }

                // Remove all other wheels (low-detail duplicates and extras)
                allWheels.forEach(wheel => {
                    if (wheel !== rim && wheel !== tire) {

                        if (wheel.mesh.parent) {
                            wheel.mesh.parent.remove(wheel.mesh);
                        }
                    }
                });
            };

            keepRimAndTire(animatableParts.wheelPivots.frontLeft, 'Front Left');
            keepRimAndTire(animatableParts.wheelPivots.frontRight, 'Front Right');

            

            resolve({ model: carModel, parts: animatableParts });
        }, undefined, reject);
    });
}