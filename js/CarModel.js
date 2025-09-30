import * as THREE from "three";

/**
 * Creates and returns an F1 car mesh group.
 * @param {number} color - Hex color for the car.
 * @returns {THREE.Group} The F1 car mesh.
 */
export function createF1Car(color = 0xff0000) {
    const car = new THREE.Group();
    const material = new THREE.MeshPhongMaterial({ color, shininess: 100 });

    // Main Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 3.5), material);
    body.position.y = 0.5; body.castShadow = true; car.add(body);

    // Nose Cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 8), material);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.4, -2.5); nose.castShadow = true; car.add(nose);

    // Visual Front Marker
    const frontLight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffdd00 }));
    frontLight.position.set(0, 0.5, -3.2); car.add(frontLight);

    // Front Wing
    const fw = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.8), material);
    fw.position.set(0, 0.2, -2.5); fw.castShadow = true; car.add(fw);

    // Rear Wing
    const rw = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.1), material);
    rw.position.set(0, 0.8, 1.8); rw.castShadow = true; car.add(rw);

    return car;
}