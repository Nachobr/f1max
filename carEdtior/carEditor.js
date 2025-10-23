import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

class CarModelEditor {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = null;
        this.renderer = null;
        this.car = null;
        this.controls = {};
        this.isMouseDown = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.cameraDistance = 8;
        this.cameraAngleX = Math.PI / 4; // 45 degrees
        this.cameraAngleY = Math.PI / 4; // 45 degrees

        this.init();
        this.setupEventListeners();
        this.createDefaultCar();
        this.animate();
    }

    init() {
        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('previewCanvas'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth - 300, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Setup camera with orbital controls
        this.camera = new THREE.PerspectiveCamera(45, (window.innerWidth - 300) / window.innerHeight, 0.1, 1000);
        this.updateCameraPosition();

        // Setup lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // Add a grid helper
        const gridHelper = new THREE.GridHelper(10, 10);
        this.scene.add(gridHelper);

        // Add axes helper
        const axesHelper = new THREE.AxesHelper(3);
        this.scene.add(axesHelper);

        // Function to create text sprites for axis labels
        const makeTextLabel = (message, parameters) => {
            if (parameters === undefined) parameters = {};
            const fontface = parameters.hasOwnProperty("fontface") ? parameters["fontface"] : "Arial";
            const fontsize = parameters.hasOwnProperty("fontsize") ? parameters["fontsize"] : 70;
            const borderThickness = parameters.hasOwnProperty("borderThickness") ? parameters["borderThickness"] : 4;
            const borderColor = parameters.hasOwnProperty("borderColor") ? parameters["borderColor"] : { r: 0, g: 0, b: 0, a: 1.0 };
            const backgroundColor = parameters.hasOwnProperty("backgroundColor") ? parameters["backgroundColor"] : { r: 255, g: 255, b: 255, a: 0.0 }; // Make background transparent
            const textColor = parameters.hasOwnProperty("textColor") ? parameters["textColor"] : { r: 0, g: 0, b: 0, a: 1.0 };

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = "Bold " + fontsize + "px " + fontface;
            const metrics = context.measureText(message);
            const textWidth = metrics.width;

            const canvasWidth = textWidth + borderThickness * 2;
            const canvasHeight = fontsize * 1.4 + borderThickness * 2;

            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            context.font = "Bold " + fontsize + "px " + fontface;
            context.textBaseline = "middle";
            context.textAlign = "center";

            context.fillStyle = "rgba(" + backgroundColor.r + "," + backgroundColor.g + "," + backgroundColor.b + "," + backgroundColor.a + ")";
            context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + "," + borderColor.b + "," + borderColor.a + ")";
            context.lineWidth = borderThickness;

            context.fillRect(0, 0, canvas.width, canvas.height);
            context.strokeRect(0, 0, canvas.width, canvas.height);

            context.fillStyle = "rgba(" + textColor.r + ", " + textColor.g + ", " + textColor.b + ", 1.0)";
            context.fillText(message, canvas.width / 2, canvas.height / 2);

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;

            const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
            const geometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
            const mesh = new THREE.Mesh(geometry, material);

            // Scale the mesh down to a reasonable size in the Three.js scene
            const scale = 0.01; // Adjust this value as needed
            mesh.scale.set(scale, scale, scale);

            return mesh;
        };

        // Add X, Y, Z labels
        const xSprite = makeTextLabel("X", { fontsize: 12, textColor: { r: 255, g: 0, b: 0, a: 1.0 } });
        xSprite.position.set(3.1, 0, 0); // Position near the end of the X-axis
        this.scene.add(xSprite);

        const ySprite = makeTextLabel("Y", { fontsize: 12, textColor: { r: 0, g: 255, b: 0, a: 1.0 } });
        ySprite.position.set(0, 3.1, 0); // Position near the end of the Y-axis
        this.scene.add(ySprite);

        const zSprite = makeTextLabel("Z", { fontsize: 12, textColor: { r: 0, g: 0, b: 255, a: 1.0 } });
        zSprite.position.set(0, 0, 3.1); // Position near the end of the Z-axis
        this.scene.add(zSprite);
    }

    updateCameraPosition() {
        const x = this.cameraDistance * Math.sin(this.cameraAngleY) * Math.cos(this.cameraAngleX);
        const z = this.cameraDistance * Math.cos(this.cameraAngleY) * Math.cos(this.cameraAngleX);
        const y = this.cameraDistance * Math.sin(this.cameraAngleX);

        this.camera.position.set(x, y, z);
        this.camera.lookAt(0, 0, 0);
    }

    setupEventListeners() {
        const canvas = document.getElementById('previewCanvas');

        // Mouse controls for camera
        canvas.addEventListener('mousedown', (e) => {
            this.isMouseDown = true;
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!this.isMouseDown) return;

            const deltaX = e.clientX - this.previousMousePosition.x;
            const deltaY = e.clientY - this.previousMousePosition.y;

            this.cameraAngleY += deltaX * 0.01;
            this.cameraAngleX += deltaY * 0.01;

            // Clamp vertical angle to prevent flipping
            this.cameraAngleX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.cameraAngleX));

            this.previousMousePosition = { x: e.clientX, y: e.clientY };
            this.updateCameraPosition();
        });

        canvas.addEventListener('mouseup', () => {
            this.isMouseDown = false;
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.cameraDistance += e.deltaY * 0.01;
            this.cameraDistance = Math.max(3, Math.min(20, this.cameraDistance));
            this.updateCameraPosition();
        });

        // Color controls
        document.getElementById('bodyColor').addEventListener('input', (e) => {
            this.updateCarColor('body', e.target.value);
            document.getElementById('bodyPreview').style.background = e.target.value;
        });

        document.getElementById('accentColor').addEventListener('input', (e) => {
            this.updateCarColor('accent', e.target.value);
            document.getElementById('accentPreview').style.background = e.target.value;
        });

        document.getElementById('redColor').addEventListener('input', (e) => {
            this.updateCarColor('red', e.target.value);
            document.getElementById('redPreview').style.background = e.target.value;
        });

        // Size controls
        document.getElementById('bodyLength').addEventListener('input', (e) => {
            document.getElementById('bodyLengthValue').textContent = e.target.value;
            this.updateCarSize('length', parseFloat(e.target.value));
        });

        document.getElementById('bodyWidth').addEventListener('input', (e) => {
            document.getElementById('bodyWidthValue').textContent = e.target.value;
            this.updateCarSize('width', parseFloat(e.target.value));
        });

        document.getElementById('bodyHeight').addEventListener('input', (e) => {
            document.getElementById('bodyHeightValue').textContent = e.target.value;
            this.updateCarSize('height', parseFloat(e.target.value));
        });

        document.getElementById('wingWidth').addEventListener('input', (e) => {
            document.getElementById('wingWidthValue').textContent = e.target.value;
            this.updateCarSize('wingWidth', parseFloat(e.target.value));
        });

        document.getElementById('frontWingWidth').addEventListener('input', (e) => {
            document.getElementById('frontWingWidthValue').textContent = e.target.value;
            this.updateCarSize('frontWingWidth', parseFloat(e.target.value));
        });

        document.getElementById('sidepodRadius').addEventListener('input', (e) => {
            document.getElementById('sidepodRadiusValue').textContent = e.target.value;
            this.updateSidepods('radius', parseFloat(e.target.value));
        });

        document.getElementById('sidepodLength').addEventListener('input', (e) => {
            document.getElementById('sidepodLengthValue').textContent = e.target.value;
            this.updateSidepods('length', parseFloat(e.target.value));
        });

        document.getElementById('sidepodXOffset').addEventListener('input', (e) => {
            document.getElementById('sidepodXOffsetValue').textContent = e.target.value;
            this.updateSidepods('xOffset', parseFloat(e.target.value));
        });

        document.getElementById('sidepodZScale').addEventListener('input', (e) => {
            document.getElementById('sidepodZScaleValue').textContent = e.target.value;
            this.updateSidepods('zScale', parseFloat(e.target.value));
        });

        document.getElementById('sidepodZOffset').addEventListener('input', (e) => {
            document.getElementById('sidepodZOffsetValue').textContent = e.target.value;
            this.updateSidepods('zOffset', parseFloat(e.target.value));
        });

        document.getElementById('bodyRoundness').addEventListener('input', (e) => {
            document.getElementById('bodyRoundnessValue').textContent = e.target.value;
            this.updateBodyRoundness(parseFloat(e.target.value));
        });

        // Feature controls
        document.getElementById('showHalo').addEventListener('change', (e) => {
            this.toggleFeature('halo', e.target.checked);
        });

        document.getElementById('showSidepods').addEventListener('change', (e) => {
            this.toggleFeature('sidepods', e.target.checked);
        });

        document.getElementById('showWingElements').addEventListener('change', (e) => {
            this.toggleFeature('wingElements', e.target.checked);
        });

        document.getElementById('showBranding').addEventListener('change', (e) => {
            this.toggleFeature('branding', e.target.checked);
        });

        document.getElementById('showWheels').addEventListener('change', (e) => {
            this.toggleFeature('wheels', e.target.checked);
        });

        // Material controls
        document.getElementById('shininess').addEventListener('input', (e) => {
            document.getElementById('shininessValue').textContent = e.target.value;
            this.updateMaterial(parseInt(e.target.value));
        });

        document.getElementById('materialType').addEventListener('change', (e) => {
            this.updateMaterialType(e.target.value);
        });

        // Action buttons
        document.getElementById('exportButton').addEventListener('click', () => {
            this.exportCarModel();
        });

        document.getElementById('saveButton').addEventListener('click', () => this.saveToGame());
        document.getElementById('loadCarListButton').addEventListener('click', () => this.updateCarList());
        document.getElementById('loadSelectedCarButton').addEventListener('click', () => this.loadSelectedCar());

        this.updateCarList(); // Populate the dropdown on page load



        document.getElementById('resetButton').addEventListener('click', () => {
            this.resetToDefault();
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = (window.innerWidth - 300) / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth - 300, window.innerHeight);
        });
    }

    async createDefaultCar() {
        // Remove existing car
        if (this.car) {
            this.scene.remove(this.car);
        }

        this.car = new THREE.Group();
        this.scene.add(this.car);

        let config;
        const savedConfig = localStorage.getItem('f1_car_config');
        if (savedConfig) {
            config = JSON.parse(savedConfig);
        } else {
            // Load default configuration from f1redbull.json
            const response = await fetch('./f1redbull.json');
            config = await response.json();
        }

        // Set UI values from config
        document.getElementById('bodyColor').value = config.colors.body;
        document.getElementById('accentColor').value = config.colors.accent;
        document.getElementById('redColor').value = config.colors.red;
        document.getElementById('bodyLength').value = config.dimensions.bodyLength;
        document.getElementById('bodyWidth').value = config.dimensions.bodyWidth;
        document.getElementById('bodyHeight').value = config.dimensions.bodyHeight;
        document.getElementById('wingWidth').value = config.dimensions.wingWidth;
        document.getElementById('frontWingWidth').value = config.dimensions.frontWingWidth;
        document.getElementById('bodyRoundness').value = config.dimensions.bodyRoundness;
        document.getElementById('sidepodRadius').value = config.dimensions.sidepodRadius;
        document.getElementById('sidepodLength').value = config.dimensions.sidepodLength;
        document.getElementById('sidepodXOffset').value = config.dimensions.sidepodXOffset;
        document.getElementById('sidepodZScale').value = config.dimensions.sidepodZScale;
        document.getElementById('sidepodZOffset').value = config.dimensions.sidepodZOffset;

        // Update display values
        document.getElementById('bodyLengthValue').textContent = config.dimensions.bodyLength;
        document.getElementById('bodyWidthValue').textContent = config.dimensions.bodyWidth;
        document.getElementById('bodyHeightValue').textContent = config.dimensions.bodyHeight;
        document.getElementById('wingWidthValue').textContent = config.dimensions.wingWidth;
        document.getElementById('frontWingWidthValue').textContent = config.dimensions.frontWingWidth;
        document.getElementById('bodyRoundnessValue').textContent = config.dimensions.bodyRoundness;
        document.getElementById('sidepodRadiusValue').textContent = config.dimensions.sidepodRadius;
        document.getElementById('sidepodLengthValue').textContent = config.dimensions.sidepodLength;
        document.getElementById('sidepodXOffsetValue').textContent = config.dimensions.sidepodXOffset;
        document.getElementById('sidepodZScaleValue').textContent = config.dimensions.sidepodZScale;
        document.getElementById('sidepodZOffsetValue').textContent = config.dimensions.sidepodZOffset;

        // Update color previews
        document.getElementById('bodyPreview').style.background = config.colors.body;
        document.getElementById('accentPreview').style.background = config.colors.accent;
        document.getElementById('redPreview').style.background = config.colors.red;

        // Create car components using config values
        this.createCarBody(config.colors.body, parseFloat(config.dimensions.bodyLength), parseFloat(config.dimensions.bodyWidth), parseFloat(config.dimensions.bodyHeight), parseFloat(config.dimensions.bodyRoundness));
        this.createWings(config.colors.body, config.colors.accent, parseFloat(config.dimensions.wingWidth), parseFloat(config.dimensions.frontWingWidth));
        this.createWheels(config.colors.body);
        this.createDetails(config.colors.accent, config.colors.red);

        // Store references to components for later updates
        this.storeComponentReferences();

        // Set feature checkboxes
        document.getElementById('showHalo').checked = config.features.halo;
        document.getElementById('showSidepods').checked = config.features.sidepods;
        document.getElementById('showWingElements').checked = config.features.wingElements;
        document.getElementById('showBranding').checked = config.features.branding;
        document.getElementById('showWheels').checked = config.features.wheels;

        // Apply initial feature states
        this.toggleFeature('halo', config.features.halo);
        this.toggleFeature('sidepods', config.features.sidepods);
        this.toggleFeature('wingElements', config.features.wingElements);
        this.toggleFeature('branding', config.features.branding);
        this.toggleFeature('wheels', config.features.wheels);

        // Set material properties
        document.getElementById('shininess').value = config.material.shininess;
        document.getElementById('shininessValue').textContent = config.material.shininess;
        this.updateMaterial(parseInt(config.material.shininess));
        document.getElementById('materialType').value = config.material.type;
        this.updateMaterialType(config.material.type);
    }

    createCarBody(bodyColor, length, width, height, roundness) {
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: bodyColor, shininess: 80 });

        // Create rounded box geometry
        const bodyGeometry = new RoundedBoxGeometry(width, height, length, roundness, Math.round(8 * roundness));
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        // body.rotation.x = Math.PI / 2; // No longer needed for RoundedBoxGeometry
        body.position.y = height / 2;
        // body.scale.y = height / width; // No longer needed as height is directly set
        body.castShadow = true;
        this.car.add(body);
        this.controls.body = body;

        // Nose - scaled with width and height
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), bodyMaterial);
        nose.scale.set(width / 2, height / 1.5, 0.8); // Scale based on width and height
        nose.position.set(0, height / 2, length / 2 - 0.2);
        this.car.add(nose);
        this.controls.nose = nose;

        // Store dimensions for updates
        this.currentBodyLength = length;
        this.currentBodyWidth = width;
        this.currentBodyHeight = height;
        this.currentRoundness = roundness;
    }

    createWheels(bodyColor) {
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 30 });
        const tireMaterial = new THREE.MeshPhongMaterial({ color: 0x0a0a0a, shininess: 10 });

        const wheelRadius = 0.35;
        const wheelWidth = 0.2;
        const wheelOffset = 0.8;

        // Front wheels
        const frontLeftWheel = this.createWheel(wheelRadius, wheelWidth, wheelMaterial, tireMaterial);
        frontLeftWheel.position.set(-wheelOffset, wheelRadius, 1.2);
        this.car.add(frontLeftWheel);
        this.controls.frontLeftWheel = frontLeftWheel;

        const frontRightWheel = this.createWheel(wheelRadius, wheelWidth, wheelMaterial, tireMaterial);
        frontRightWheel.position.set(wheelOffset, wheelRadius, 1.2);
        this.car.add(frontRightWheel);
        this.controls.frontRightWheel = frontRightWheel;

        // Rear wheels
        const rearLeftWheel = this.createWheel(wheelRadius, wheelWidth, wheelMaterial, tireMaterial);
        rearLeftWheel.position.set(-wheelOffset, wheelRadius, -1.2);
        this.car.add(rearLeftWheel);
        this.controls.rearLeftWheel = rearLeftWheel;

        const rearRightWheel = this.createWheel(wheelRadius, wheelWidth, wheelMaterial, tireMaterial);
        rearRightWheel.position.set(wheelOffset, wheelRadius, -1.2);
        this.car.add(rearRightWheel);
        this.controls.rearRightWheel = rearRightWheel;
    }

    createWheel(radius, width, wheelMaterial, tireMaterial) {
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

    createWings(bodyColor, accentColor, wingWidth, frontWingWidth) {
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: bodyColor, shininess: 80 });
        const accentMaterial = new THREE.MeshPhongMaterial({ color: accentColor, shininess: 80 });

        // Front wing
        // NEW
        const frontWing = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.4), bodyMaterial);
        frontWing.position.set(0, 0.15, 1.8);
        this.car.add(frontWing);
        this.controls.frontWing = frontWing;

        // Front wing endplates
        const fwEndplateLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.4), accentMaterial);
        fwEndplateLeft.position.set(-frontWingWidth / 2 + 0.04, 0.25, 1.8);
        this.car.add(fwEndplateLeft);
        this.controls.fwEndplateLeft = fwEndplateLeft;

        const fwEndplateRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.4), accentMaterial);
        fwEndplateRight.position.set(frontWingWidth / 2 - 0.04, 0.25, 1.8);
        this.car.add(fwEndplateRight);
        this.controls.fwEndplateRight = fwEndplateRight;

        // Rear wing
        // NEW
        const rearWing = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.3), bodyMaterial);
        rearWing.position.set(0, 0.9, -1.6);
        this.car.add(rearWing);
        this.controls.rearWing = rearWing;

        // Rear wing endplates
        const rwEndplateLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.3), accentMaterial);
        rwEndplateLeft.position.set(-wingWidth * 0.3 + 0.04, 0.7, -1.6);
        this.car.add(rwEndplateLeft);
        this.controls.rwEndplateLeft = rwEndplateLeft;

        const rwEndplateRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.3), accentMaterial);
        rwEndplateRight.position.set(wingWidth * 0.3 - 0.04, 0.7, -1.6);
        this.car.add(rwEndplateRight);
        this.controls.rwEndplateRight = rwEndplateRight;
    }

    createDetails(accentColor, redColor) {
        const accentMaterial = new THREE.MeshPhongMaterial({ color: accentColor, shininess: 80 });
        const redMaterial = new THREE.MeshPhongMaterial({ color: redColor, shininess: 80 });
        const darkMaterial = new THREE.MeshPhongMaterial({ color: 0x0a0a0a, shininess: 20 });

        // Halo
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 8, 16), darkMaterial);
        halo.rotation.x = Math.PI / 2;
        halo.position.set(0, 0.85, 0.3);
        this.car.add(halo);
        this.controls.halo = halo;

        // Sidepods
        const sidepodRadius = parseFloat(document.getElementById('sidepodRadius').value);
        const sidepodLength = parseFloat(document.getElementById('sidepodLength').value);
        const sidepodXOffset = parseFloat(document.getElementById('sidepodXOffset').value);

        const sidePodGeometry = new THREE.CapsuleGeometry(sidepodRadius, sidepodLength, 6, 8);
        const sidePodLeft = new THREE.Mesh(sidePodGeometry, redMaterial);
        sidePodLeft.rotation.z = Math.PI / 2;
        sidePodLeft.position.set(-sidepodXOffset, 0.25, 0.2);
        this.car.add(sidePodLeft);
        this.controls.sidePodLeft = sidePodLeft;

        const sidePodRight = new THREE.Mesh(sidePodGeometry, redMaterial);
        sidePodRight.rotation.z = Math.PI / 2;
        sidePodRight.position.set(sidepodXOffset, 0.25, 0.2);
        this.car.add(sidePodRight);
        this.controls.sidePodRight = sidePodRight;

        // Initialize sidepods with current slider values
        this.updateSidepods('radius', sidepodRadius);
        this.updateSidepods('length', sidepodLength);
        this.updateSidepods('xOffset', sidepodXOffset);
        this.updateSidepods('zScale', parseFloat(document.getElementById('sidepodZScale').value));
        this.updateSidepods('zOffset', parseFloat(document.getElementById('sidepodZOffset').value));

        // Branding
        const branding = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.3), accentMaterial);
        branding.position.set(0, 0.7, -0.8);
        this.car.add(branding);
        this.controls.branding = branding;
    }

    storeComponentReferences() {
        // Store materials for easy updates
        this.materials = {
            body: this.controls.body.material,
            accent: this.controls.fwEndplateLeft.material,
            red: this.controls.sidePodLeft.material
        };
    }

    updateCarColor(type, color) {
        const hexColor = parseInt(color.replace('#', ''), 16);

        switch (type) {
            case 'body':
                this.materials.body.color.setHex(hexColor);
                break;
            case 'accent':
                this.materials.accent.color.setHex(hexColor);
                break;
            case 'red':
                this.materials.red.color.setHex(hexColor);
                break;
        }
    }

    updateCarSize(dimension, value) {
        const bodyLength = parseFloat(document.getElementById('bodyLength').value);
        const bodyWidth = parseFloat(document.getElementById('bodyWidth').value);
        const bodyHeight = parseFloat(document.getElementById('bodyHeight').value);
        const roundness = parseFloat(document.getElementById('bodyRoundness').value);

        switch (dimension) {
            case 'length':
                this.currentBodyLength = value;
                this.updateBodyGeometry();
                // Update nose position to follow length
                this.controls.nose.position.z = value / 2 - 0.2;
                break;
            case 'width':
                this.currentBodyWidth = value;
                this.updateBodyGeometry();
                break;

            case 'height':
                this.currentBodyHeight = value;
                this.updateBodyGeometry();
                break;

            case 'wingWidth':
                const rearWingWidth = value * 0.6;
                this.controls.rearWing.scale.x = rearWingWidth;
                this.controls.rwEndplateLeft.position.x = -rearWingWidth / 2 + 0.04;
                this.controls.rwEndplateRight.position.x = rearWingWidth / 2 - 0.04;
                break;

            case 'frontWingWidth':
                // NEW
                this.controls.frontWing.scale.x = value;
                this.controls.fwEndplateLeft.position.x = -value / 2 + 0.04;
                this.controls.fwEndplateRight.position.x = value / 2 - 0.04;
                break;
        }
    }

    updateBodyGeometry() {
        const roundness = parseFloat(document.getElementById('bodyRoundness').value);
        const radiusSegments = Math.max(4, Math.round(8 * roundness));
        //const radialSegments = Math.max(4, Math.round(16 * roundness));

        // Update capsule geometry with proper width (radius) and length
        this.controls.body.geometry = new RoundedBoxGeometry(
            this.currentBodyWidth,  // Width along X-axis
            this.currentBodyHeight, // Height along Y-axis
            this.currentBodyLength, // Depth along Z-axis
            this.currentRoundness,  // Radius for rounded edges
            radiusSegments          // Segments for the rounded edges
        );
        // this.controls.body.rotation.x = Math.PI / 2; // No longer needed for RoundedBoxGeometry
        this.controls.body.position.y = this.currentBodyHeight / 2;

        // Update nose scale based on width and height
        this.controls.nose.scale.set(this.currentBodyWidth / 1.2, this.currentBodyHeight / 0.8, 1.5);
        this.controls.nose.position.y = this.currentBodyHeight / 2;
        this.controls.nose.position.z = this.currentBodyLength / 2 - 0.2;
    }

    updateBodyRoundness(roundness) {
        this.currentRoundness = roundness;
        this.updateBodyGeometry();
    }

    updateSidepods(property, value) {
        const sidePodLeft = this.controls.sidePodLeft;
        const sidePodRight = this.controls.sidePodRight;

        let currentRadius = sidePodLeft.geometry.parameters.radius;
        let currentLength = sidePodLeft.geometry.parameters.height;
        let currentXOffset = Math.abs(sidePodLeft.position.x);
        let currentZScale = sidePodLeft.scale.z;
        let currentZOffset = sidePodLeft.position.z;

        switch (property) {
            case 'radius':
                currentRadius = value;
                break;
            case 'length':
                currentLength = value;
                break;
            case 'xOffset':
                currentXOffset = value;
                break;
            case 'zScale':
                currentZScale = value;
                break;
            case 'zOffset':
                currentZOffset = value;
                break;
        }

        // Update geometry
        sidePodLeft.geometry.dispose();
        sidePodRight.geometry.dispose();
        const newSidePodGeometry = new THREE.CapsuleGeometry(currentRadius, currentLength, 6, 8);
        sidePodLeft.geometry = newSidePodGeometry;
        sidePodRight.geometry = newSidePodGeometry;

        // Update position and scale
        sidePodLeft.position.x = -currentXOffset;
        sidePodRight.position.x = currentXOffset;
        sidePodLeft.scale.z = currentZScale;
        sidePodRight.scale.z = currentZScale;
        sidePodLeft.position.z = currentZOffset;
        sidePodRight.position.z = currentZOffset;
    }

    toggleFeature(feature, visible) {
        switch (feature) {
            case 'halo':
                this.controls.halo.visible = visible;
                break;
            case 'sidepods':
                this.controls.sidePodLeft.visible = visible;
                this.controls.sidePodRight.visible = visible;
                break;
            case 'wingElements':
                // You can add more wing elements here
                break;
            case 'branding':
                this.controls.branding.visible = visible;
                break;
            case 'wheels':
                this.controls.frontLeftWheel.visible = visible;
                this.controls.frontRightWheel.visible = visible;
                this.controls.rearLeftWheel.visible = visible;
                this.controls.rearRightWheel.visible = visible;
                break;
        }
    }

    updateMaterial(shininess) {
        Object.values(this.materials).forEach(material => {
            if (material.shininess !== undefined) {
                material.shininess = shininess;
                material.needsUpdate = true;
            }
        });
    }

    updateMaterialType(type) {
        Object.keys(this.materials).forEach(key => {
            const oldMaterial = this.materials[key];
            let newMaterial;

            switch (type) {
                case 'phong':
                    newMaterial = new THREE.MeshPhongMaterial({
                        color: oldMaterial.color,
                        shininess: oldMaterial.shininess || 80
                    });
                    break;
                case 'standard':
                    newMaterial = new THREE.MeshStandardMaterial({
                        color: oldMaterial.color,
                        roughness: 1 - (oldMaterial.shininess / 100)
                    });
                    break;
                case 'basic':
                    newMaterial = new THREE.MeshBasicMaterial({
                        color: oldMaterial.color
                    });
                    break;
            }

            this.materials[key] = newMaterial;
        });

        // Update all meshes with new materials
        Object.values(this.controls).forEach(mesh => {
            if (mesh.material && mesh.material.color) {
                const color = mesh.material.color.getHex();
                if (this.materials.body.color.getHex() === color) {
                    mesh.material = this.materials.body;
                } else if (this.materials.accent.color.getHex() === color) {
                    mesh.material = this.materials.accent;
                } else if (this.materials.red.color.getHex() === color) {
                    mesh.material = this.materials.red;
                }
            }
        });
    }

    saveToGame() {
        const carNameInput = document.getElementById('saveCarInput'); // Assuming an input field with id 'saveCarInput' exists in the HTML
        const carName = carNameInput ? carNameInput.value.trim() : '';

        if (!carName) {
            this.showStatus('Please enter a name for the car.');
            return;
        }

        const config = {
            colors: {
                body: document.getElementById('bodyColor').value,
                accent: document.getElementById('accentColor').value,
                red: document.getElementById('redColor').value
            },
            dimensions: {
                bodyLength: parseFloat(document.getElementById('bodyLength').value),
                bodyWidth: parseFloat(document.getElementById('bodyWidth').value),
                bodyHeight: parseFloat(document.getElementById('bodyHeight').value),
                wingWidth: parseFloat(document.getElementById('wingWidth').value),
                frontWingWidth: parseFloat(document.getElementById('frontWingWidth').value),
                bodyRoundness: parseFloat(document.getElementById('bodyRoundness').value),
                sidepodRadius: parseFloat(document.getElementById('sidepodRadius').value),
                sidepodLength: parseFloat(document.getElementById('sidepodLength').value),
                sidepodXOffset: parseFloat(document.getElementById('sidepodXOffset').value),
                sidepodZOffset: parseFloat(document.getElementById('sidepodZOffset').value),
                sidepodZScale: parseFloat(document.getElementById('sidepodZScale').value)
            },
            features: {
                halo: document.getElementById('showHalo').checked,
                sidepods: document.getElementById('showSidepods').checked,
                wingElements: document.getElementById('showWingElements').checked,
                branding: document.getElementById('showBranding').checked,
                wheels: document.getElementById('showWheels').checked
            },
            material: {
                shininess: parseInt(document.getElementById('shininess').value),
                type: document.getElementById('materialType').value
            }
        };

        let savedCarConfigs = JSON.parse(localStorage.getItem('savedCarConfigs')) || {};
        savedCarConfigs[carName] = config;
        localStorage.setItem('savedCarConfigs', JSON.stringify(savedCarConfigs));
        localStorage.setItem('f1_car_config', JSON.stringify(config)); // Also save as the active config

        this.showStatus(`Car '${carName}' saved and set as active!`);
    }

    updateCarModel() {
        // Refresh 3D model with current configuration
        this.createDefaultCar();
        // Assuming updateControlsFromConfig exists and takes the current config
        // If not, you might need to re-implement setting UI values and car components
        const savedConfig = localStorage.getItem('f1_car_config');
        if (savedConfig) {
            this.updateControlsFromConfig(JSON.parse(savedConfig));
        }
    }

    updateCarList() {
        const select = document.getElementById('loadCarSelect');
        select.innerHTML = '';
        const savedConfigs = JSON.parse(localStorage.getItem('savedCarConfigs')) || {};
        Object.keys(savedConfigs).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    }

    loadSelectedCar() {
        const select = document.getElementById('loadCarSelect');
        const selectedCarName = select.value;
        const savedConfigs = JSON.parse(localStorage.getItem('savedCarConfigs')) || {};
        const config = savedConfigs[selectedCarName];

        if (config) {
            localStorage.setItem('f1_car_config', JSON.stringify(config));
            this.updateCarModel();
            this.showStatus(`Loaded car: ${selectedCarName}`);
        } else {
            this.showStatus(`Error: Car '${selectedCarName}' not found.`);
        }
    }

    exportCarModel() {
        const config = {
            colors: {
                body: document.getElementById('bodyColor').value,
                accent: document.getElementById('accentColor').value,
                red: document.getElementById('redColor').value
            },
            dimensions: {
                bodyLength: document.getElementById('bodyLength').value,
                bodyWidth: document.getElementById('bodyWidth').value,
                bodyHeight: document.getElementById('bodyHeight').value,
                wingWidth: document.getElementById('wingWidth').value,
                frontWingWidth: document.getElementById('frontWingWidth').value,
                bodyRoundness: document.getElementById('bodyRoundness').value,
                sidepodRadius: document.getElementById('sidepodRadius').value,
                sidepodLength: document.getElementById('sidepodLength').value,
                sidepodXOffset: document.getElementById('sidepodXOffset').value,
                sidepodZScale: document.getElementById('sidepodZScale').value,
                sidepodZOffset: document.getElementById('sidepodZOffset').value
            },
            features: {
                halo: document.getElementById('showHalo').checked,
                sidepods: document.getElementById('showSidepods').checked,
                wingElements: document.getElementById('showWingElements').checked,
                branding: document.getElementById('showBranding').checked,
                wheels: document.getElementById('showWheels').checked
            },
            material: {
                shininess: document.getElementById('shininess').value,
                type: document.getElementById('materialType').value
            }
        };

        const configString = JSON.stringify(config, null, 2);
        const blob = new Blob([configString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'f1_car_config.json';
        a.click();

        URL.revokeObjectURL(url);

        this.showStatus('Car configuration exported successfully!');
    }

    resetToDefault() {
        // Reset all controls to default values
        document.getElementById('bodyColor').value = '#1e22aa';
        document.getElementById('accentColor').value = '#fff500';
        document.getElementById('redColor').value = '#ff0000';

        document.getElementById('bodyLength').value = 3.5;
        document.getElementById('bodyLengthValue').textContent = '3.5';

        document.getElementById('bodyWidth').value = 1.2;
        document.getElementById('bodyWidthValue').textContent = '1.2';

        document.getElementById('bodyHeight').value = 0.8;
        document.getElementById('bodyHeightValue').textContent = '0.8';

        document.getElementById('wingWidth').value = 2.8;
        document.getElementById('wingWidthValue').textContent = '2.8';

        document.getElementById('frontWingWidth').value = 2.8;
        document.getElementById('frontWingWidthValue').textContent = '2.8';

        document.getElementById('bodyRoundness').value = 0.5;
        document.getElementById('bodyRoundnessValue').textContent = '0.5';

        document.getElementById('showHalo').checked = true;
        document.getElementById('showSidepods').checked = true;
        document.getElementById('showWingElements').checked = true;
        document.getElementById('showBranding').checked = true;
        document.getElementById('showWheels').checked = true;

        document.getElementById('shininess').value = 80;
        document.getElementById('shininessValue').textContent = '80';

        document.getElementById('materialType').value = 'phong';

        // Update color previews
        document.getElementById('bodyPreview').style.background = '#1e22aa';
        document.getElementById('accentPreview').style.background = '#fff500';
        document.getElementById('redPreview').style.background = '#ff0000';

        // Recreate car with default settings
        this.createDefaultCar();

        this.showStatus('Reset to default configuration!');
    }

    updateCarModel() {
        // Refresh 3D model with current configuration
        this.createDefaultCar();
    }

    showStatus(message) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.style.display = 'block';

        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // No auto-rotation - camera is now controlled by mouse
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the editor when the page loads
new CarModelEditor();