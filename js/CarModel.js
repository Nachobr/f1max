import * as THREE from "three";
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Creates and returns a modern F1 car mesh group using configuration from the editor.
 * @param {Object} config - Car configuration object (optional, uses localStorage or defaults).
 * @returns {THREE.Group} The F1 car mesh.
 */
export function createF1Car(config = null) {
    const car = new THREE.Group();
    
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
    
    // Convert hex colors to numbers
    const bodyColor = parseInt(cfg.colors.body.replace('#', ''), 16);
    const accentColor = parseInt(cfg.colors.accent.replace('#', ''), 16);
    const redColor = parseInt(cfg.colors.red.replace('#', ''), 16);
    
    // Create materials based on config
    let bodyMaterial, accentMaterial, redMaterial, darkMaterial;
    
    switch(cfg.material.type) {
        case 'standard':
            bodyMaterial = new THREE.MeshStandardMaterial({ 
                color: bodyColor, 
                roughness: 1 - (cfg.material.shininess / 100)
            });
            accentMaterial = new THREE.MeshStandardMaterial({ 
                color: accentColor, 
                roughness: 1 - (cfg.material.shininess / 100)
            });
            redMaterial = new THREE.MeshStandardMaterial({ 
                color: redColor, 
                roughness: 1 - (cfg.material.shininess / 100)
            });
            darkMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x0A0A0A, 
                roughness: 0.8
            });
            break;
        case 'basic':
            bodyMaterial = new THREE.MeshBasicMaterial({ color: bodyColor });
            accentMaterial = new THREE.MeshBasicMaterial({ color: accentColor });
            redMaterial = new THREE.MeshBasicMaterial({ color: redColor });
            darkMaterial = new THREE.MeshBasicMaterial({ color: 0x0A0A0A });
            break;
        default: // 'phong'
            bodyMaterial = new THREE.MeshPhongMaterial({ 
                color: bodyColor, 
                shininess: cfg.material.shininess
            });
            accentMaterial = new THREE.MeshPhongMaterial({ 
                color: accentColor, 
                shininess: cfg.material.shininess
            });
            redMaterial = new THREE.MeshPhongMaterial({ 
                color: redColor, 
                shininess: cfg.material.shininess
            });
            darkMaterial = new THREE.MeshPhongMaterial({ 
                color: 0x0A0A0A, 
                shininess: 20 
            });
    }

    // Rotate car to face correct direction
    car.rotation.y = Math.PI;

    // === MAIN BODY ===
    const bodyGeometry = new RoundedBoxGeometry(
        cfg.dimensions.bodyWidth,
        cfg.dimensions.bodyHeight, 
        cfg.dimensions.bodyLength,
        cfg.dimensions.bodyRoundness,
        Math.round(8 * cfg.dimensions.bodyRoundness)
    );
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = cfg.dimensions.bodyHeight / 2;
    body.castShadow = true;
    car.add(body);

    // Nose - scaled with body dimensions
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), bodyMaterial);
    nose.scale.set(cfg.dimensions.bodyWidth / 1.2, cfg.dimensions.bodyHeight / 0.8, 0.8);
    nose.position.set(0, cfg.dimensions.bodyHeight / 2, cfg.dimensions.bodyLength / 2 - 0.2);
    car.add(nose);

    // === WINGS ===
    
    // Front Wing
    const frontWing = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.dimensions.frontWingWidth, 0.05, 0.4), 
        bodyMaterial
    );
    frontWing.position.set(0, 0.15, 1.8);
    car.add(frontWing);

    // Front Wing Endplates
    const fwEndplateLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.4), accentMaterial);
    fwEndplateLeft.position.set(-cfg.dimensions.frontWingWidth / 2 + 0.04, 0.25, 1.8);
    car.add(fwEndplateLeft);
    
    const fwEndplateRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.4), accentMaterial);
    fwEndplateRight.position.set(cfg.dimensions.frontWingWidth / 2 - 0.04, 0.25, 1.8);
    car.add(fwEndplateRight);

    // Rear Wing
    const rearWingWidth = cfg.dimensions.wingWidth * 0.6;
    const rearWing = new THREE.Mesh(
        new THREE.BoxGeometry(rearWingWidth, 0.08, 0.3), 
        bodyMaterial
    );
    rearWing.position.set(0, 0.9, -1.6);
    car.add(rearWing);

    // Rear Wing Endplates
    const rwEndplateLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.3), accentMaterial);
    rwEndplateLeft.position.set(-rearWingWidth / 2 + 0.04, 0.7, -1.6);
    car.add(rwEndplateLeft);
    
    const rwEndplateRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.3), accentMaterial);
    rwEndplateRight.position.set(rearWingWidth / 2 - 0.04, 0.7, -1.6);
    car.add(rwEndplateRight);

    // === CONDITIONAL FEATURES ===
    
    if (cfg.features.halo) {
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 8, 16), darkMaterial);
        halo.rotation.x = Math.PI / 2;
        halo.position.set(0, 0.85, 0.3);
        car.add(halo);
    }

    if (cfg.features.sidepods) {
        const sidePodGeometry = new THREE.CapsuleGeometry(
            cfg.dimensions.sidepodRadius, 
            cfg.dimensions.sidepodLength, 
            6, 8
        );

        const sidePodLeft = new THREE.Mesh(sidePodGeometry, redMaterial);
        sidePodLeft.rotation.z = Math.PI / 2;
        sidePodLeft.position.set(-cfg.dimensions.sidepodXOffset, 0.25, cfg.dimensions.sidepodZOffset);
        sidePodLeft.scale.z = cfg.dimensions.sidepodZScale;
        car.add(sidePodLeft);
        
        const sidePodRight = new THREE.Mesh(sidePodGeometry, redMaterial);
        sidePodRight.rotation.z = Math.PI / 2;
        sidePodRight.position.set(cfg.dimensions.sidepodXOffset, 0.25, cfg.dimensions.sidepodZOffset);
        sidePodRight.scale.z = cfg.dimensions.sidepodZScale;
        car.add(sidePodRight);
    }

    if (cfg.features.branding) {
        const branding = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.3), accentMaterial);
        branding.position.set(0, 0.7, -0.8);
        car.add(branding);
    }

    if (cfg.features.wingElements) {
        // Additional wing elements
        const fwElement1 = new THREE.Mesh(
            new THREE.BoxGeometry(cfg.dimensions.frontWingWidth * 0.9, 0.02, 0.15), 
            darkMaterial
        );
        fwElement1.position.set(0, 0.12, 1.7);
        car.add(fwElement1);

        const beamWing = new THREE.Mesh(
            new THREE.BoxGeometry(rearWingWidth * 0.8, 0.05, 0.15), 
            darkMaterial
        );
        beamWing.position.set(0, 0.6, -1.5);
        car.add(beamWing);
    }

    if (cfg.features.wheels) {
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 30 });
        const tireMaterial = new THREE.MeshPhongMaterial({ color: 0x0a0a0a, shininess: 10 });

        const wheelRadius = 0.35;
        const wheelWidth = 0.2;
        const wheelOffset = 0.8;

        // Front wheels
        const frontLeftWheel = createWheel(wheelRadius, wheelWidth, wheelMaterial, tireMaterial);
        frontLeftWheel.position.set(-wheelOffset, wheelRadius, 1.2);
        car.add(frontLeftWheel);

        const frontRightWheel = createWheel(wheelRadius, wheelWidth, wheelMaterial, tireMaterial);
        frontRightWheel.position.set(wheelOffset, wheelRadius, 1.2);
        car.add(frontRightWheel);

        // Rear wheels
        const rearLeftWheel = createWheel(wheelRadius, wheelWidth, wheelMaterial, tireMaterial);
        rearLeftWheel.position.set(-wheelOffset, wheelRadius, -1.2);
        car.add(rearLeftWheel);

        const rearRightWheel = createWheel(wheelRadius, wheelWidth, wheelMaterial, tireMaterial);
        rearRightWheel.position.set(wheelOffset, wheelRadius, -1.2);
        car.add(rearRightWheel);
    }

    return car;
}

// Helper function to create wheels (same as in editor)
function createWheel(radius, width, wheelMaterial, tireMaterial) {
    const wheelGroup = new THREE.Group();

    // Tire
    const tireGeometry = new THREE.CylinderGeometry(radius, radius, width, 16);
    const tire = new THREE.Mesh(tireGeometry, tireMaterial);
    tire.rotation.z = Math.PI / 2;
    wheelGroup.add(tire);

    // Wheel rim
    const rimGeometry = new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, width + 0.02, 12);
    const rim = new THREE.Mesh(rimGeometry, wheelMaterial);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    // Wheel spokes
    const spokeGeometry = new THREE.BoxGeometry(radius * 0.5, 0.03, 0.03);
    for (let i = 0; i < 6; i++) {
        const spoke = new THREE.Mesh(spokeGeometry, wheelMaterial);
        spoke.rotation.z = (i * Math.PI) / 3;
        wheelGroup.add(spoke);
    }

    return wheelGroup;
}