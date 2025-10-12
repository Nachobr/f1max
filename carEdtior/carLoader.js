import * as THREE from "three";

export function createF1CarFromConfig(config = null) {
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
    
    // Convert hex colors to numbers
    const bodyColor = parseInt(cfg.colors.body.replace('#', ''), 16);
    const accentColor = parseInt(cfg.colors.accent.replace('#', ''), 16);
    const redColor = parseInt(cfg.colors.red.replace('#', ''), 16);
    
    // ✅ IMPLEMENTATION: Create car using the configuration
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: bodyColor, shininess: 90 });
    const accentMaterial = new THREE.MeshPhongMaterial({ color: accentColor, shininess: 80 });
    const redMaterial = new THREE.MeshPhongMaterial({ color: redColor, shininess: 80 });
    const darkMaterial = new THREE.MeshPhongMaterial({ color: 0x0A0A0A, shininess: 20 });

    // Rotate car to face correct direction
    car.rotation.y = Math.PI;

    // Main Body using config dimensions
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.dimensions.bodyWidth, 0.5, cfg.dimensions.bodyLength), 
        bodyMaterial
    );
    body.position.y = 0.5;
    body.castShadow = true;
    car.add(body);

    // Nose Cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 6), bodyMaterial);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.4, cfg.dimensions.bodyLength/2 - 0.3);
    car.add(nose);

    // Front Wing using config wing width
    const frontWing = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.dimensions.wingWidth, 0.05, 0.4), 
        bodyMaterial
    );
    frontWing.position.set(0, 0.15, 1.8);
    car.add(frontWing);

    // Front Wing Endplates
    const fwEndplateLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.4), accentMaterial);
    fwEndplateLeft.position.set(-cfg.dimensions.wingWidth/2 + 0.04, 0.25, 1.8);
    car.add(fwEndplateLeft);
    
    const fwEndplateRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.4), accentMaterial);
    fwEndplateRight.position.set(cfg.dimensions.wingWidth/2 - 0.04, 0.25, 1.8);
    car.add(fwEndplateRight);

    // Rear Wing (proportional to front wing)
    const rearWingWidth = cfg.dimensions.wingWidth * 0.6;
    const rearWing = new THREE.Mesh(
        new THREE.BoxGeometry(rearWingWidth, 0.08, 0.3), 
        bodyMaterial
    );
    rearWing.position.set(0, 0.9, -1.6);
    car.add(rearWing);

    // Rear Wing Endplates
    const rwEndplateLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.3), accentMaterial);
    rwEndplateLeft.position.set(-rearWingWidth/2 + 0.04, 0.7, -1.6);
    car.add(rwEndplateLeft);
    
    const rwEndplateRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.3), accentMaterial);
    rwEndplateRight.position.set(rearWingWidth/2 - 0.04, 0.7, -1.6);
    car.add(rwEndplateRight);

    // Conditional features based on config
    if (cfg.features.halo) {
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 8, 16), darkMaterial);
        halo.rotation.x = Math.PI / 2;
        halo.position.set(0, 0.85, 0.3);
        car.add(halo);
    }

    if (cfg.features.sidepods) {
        const sidepodRadius = cfg.dimensions.sidepodRadius;
        const sidepodLength = cfg.dimensions.sidepodLength;
        const sidepodXOffset = cfg.dimensions.sidepodXOffset;
        const sidepodZScale = cfg.dimensions.sidepodZScale;
        const sidepodZOffset = cfg.dimensions.sidepodZOffset;

        const sidePodGeometry = new THREE.CapsuleGeometry(sidepodRadius, sidepodLength, 6, 8);

        const sidePodLeft = new THREE.Mesh(sidePodGeometry, redMaterial);
        sidePodLeft.position.set(-sidepodXOffset, 0.25, sidepodZOffset);
        sidePodLeft.scale.z = sidepodZScale;
        car.add(sidePodLeft);
        
        const sidePodRight = new THREE.Mesh(sidePodGeometry, redMaterial);
        sidePodRight.position.set(sidepodXOffset, 0.25, sidepodZOffset);
        sidePodRight.scale.z = sidepodZScale;
        car.add(sidePodRight);
    }

    if (cfg.features.branding) {
        const branding = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.3), accentMaterial);
        branding.position.set(0, 0.7, -0.8);
        car.add(branding);
    }

    if (cfg.features.wingElements) {
        // Additional wing elements
        const fwElement1 = new THREE.Mesh(new THREE.BoxGeometry(cfg.dimensions.wingWidth * 0.9, 0.02, 0.15), darkMaterial);
        fwElement1.position.set(0, 0.12, 1.7);
        car.add(fwElement1);

        const beamWing = new THREE.Mesh(new THREE.BoxGeometry(rearWingWidth * 0.8, 0.05, 0.15), darkMaterial);
        beamWing.position.set(0, 0.6, -1.5);
        car.add(beamWing);
    }

    return car;
}

// Helper function to load car config from JSON file
export async function loadCarConfig(url) {
    try {
        const response = await fetch(url);
        const config = await response.json();
        return createF1CarFromConfig(config);
    } catch (error) {
        console.error('Failed to load car config:', error);
        return createF1CarFromConfig(); // Return default car
    }
}