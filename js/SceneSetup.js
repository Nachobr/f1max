// --- START OF FILE SceneSetup.js (Corrected for Lighting Balance) ---

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { CONFIG } from './Config.js';

// --- CORE THREE.JS COMPONENTS ---
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 6, 12);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.toneMapping = THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure = 0.5;
document.body.appendChild(renderer.domElement);


// --- PROCEDURAL SKY ---
const sky = new Sky();
sky.scale.setScalar(2000);
scene.add(sky);
const sun = new THREE.Vector3();

const effectController = {
    turbidity: 10,
    rayleigh: 3,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.7,
    elevation: 35,
    azimuth: 180,
    exposure: renderer.toneMappingExposure // This will now use the new 0.5 value
};

function updateSkyAndLighting() {
    const uniforms = sky.material.uniforms;
    uniforms['turbidity'].value = effectController.turbidity;
    uniforms['rayleigh'].value = effectController.rayleigh;
    uniforms['mieCoefficient'].value = effectController.mieCoefficient;
    uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

    const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
    const theta = THREE.MathUtils.degToRad(effectController.azimuth);
    sun.setFromSphericalCoords(1, phi, theta);

    uniforms['sunPosition'].value.copy(sun);
    dirLight.position.copy(sun).multiplyScalar(100);
    renderer.toneMappingExposure = effectController.exposure;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(sky).texture;
    pmremGenerator.dispose();
}


// --- LIGHTING ---

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);


const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024; // 1024 is often fine and faster
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.top = 200;
dirLight.shadow.camera.bottom = -200;
dirLight.shadow.camera.left = -200;
dirLight.shadow.camera.right = 200;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
scene.add(dirLight);


// --- INITIAL SKY AND LIGHTING SETUP ---
updateSkyAndLighting();


// --- GROUND ---
const groundGeometry = new THREE.PlaneGeometry(4000, 4000);
const groundMaterial = new THREE.MeshLambertMaterial({ color: CONFIG.GROUND_COLOR });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);


// --- RESIZE HANDLER ---
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

