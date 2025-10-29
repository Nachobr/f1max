// GyroControls.js - Extract steering without camera control
export class GyroControls {
    constructor() {
        this.enabled = false;
        this.steeringValue = 0;
        this.sensitivity = 1.0;
        this.calibrationOffset = 0;
        this.maxSteeringAngle = 45;
        this.hasGyro = false;
        this.requiresHTTPS = false;
        this.testEventReceived = false;

        // Store the bound handler for proper cleanup
        this.boundHandler = this.handleOrientation.bind(this);

        this.checkGyroSupport();
        console.log('🎮 GyroControls initialized', {
            hasGyro: this.hasGyro,
            requiresHTTPS: this.requiresHTTPS,
            protocol: window.location.protocol
        });
    }

    // ADD THIS METHOD
    checkGyroSupport() {
        this.hasGyro = 'DeviceOrientationEvent' in window;
        
        // Check if we need HTTPS (most browsers require it for gyro)
        this.requiresHTTPS = window.location.protocol !== 'https:' && 
                            !window.location.hostname.includes('localhost') &&
                            !window.location.hostname.includes('127.0.0.1');
        
        // Test if we can actually get gyro data
        if (this.hasGyro) {
            const testHandler = (event) => {
                this.testEventReceived = event.alpha !== null || event.beta !== null || event.gamma !== null;
                window.removeEventListener('deviceorientation', testHandler);
            };
            window.addEventListener('deviceorientation', testHandler, { once: true });
            
            setTimeout(() => {
                window.removeEventListener('deviceorientation', testHandler);
            }, 1000);
        }
    }

    handleOrientation(event) {
        if (!this.enabled) return;

        // Use gamma (left-right tilt) for steering
        // gamma: left-to-right tilt in degrees, where right is positive
        let tilt = event.gamma || 0;

        // Apply calibration and sensitivity
        let calibratedTilt = (tilt - this.calibrationOffset) * this.sensitivity;

        // Convert to steering value (-1 to 1)
        this.steeringValue = Math.max(-1, Math.min(1, calibratedTilt / this.maxSteeringAngle));

        // Dead zone to prevent tiny movements
        if (Math.abs(this.steeringValue) < 0.1) {
            this.steeringValue = 0;
        }

        console.log('🎮 Tilt:', tilt, 'Steering:', this.steeringValue);
        
        // Optional: Show debug info in HUD (remove in production)
        const hudElement = document.getElementById('hud-speed');
        if (hudElement && this.enabled) {
            hudElement.textContent = `Gyro: ${this.steeringValue.toFixed(2)} | Tilt: ${tilt.toFixed(1)}°`;
        }
    }

    async enable() {

        //alert('Gyro enable called\nProtocol: ' + window.location.protocol);
        
        if (!this.isMobileDevice()) {
            console.warn('📱 Gyro controls only available on mobile devices');
            this.showNotification('Gyro only works on mobile devices');
            return false;
        }

        if (!this.hasGyro) {
            console.warn('📱 Device does not support gyroscope');
            this.showNotification('Your device does not support gyroscope');
            return false;
        }

        // ADD THIS HTTPS CHECK
        if (this.requiresHTTPS) {
            console.warn('📱 Gyro requires HTTPS or localhost');
            this.showNotification('Gyro requires HTTPS. Use a local server or HTTPS.');
            return false;
        }

        if (!this.testEventReceived) {
            console.warn('📱 No gyro events received - may not be supported');
            this.showNotification('Gyro not available. Try Chrome browser.');
            return false;
        }

        try {
            // iOS 13+ permission handling
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                console.log('📱 Requesting iOS gyro permission...');
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission !== 'granted') {
                    console.warn('❌ Gyroscope permission denied');
                    this.showNotification('Gyro permission denied');
                    return false;
                }
            }

            this.enabled = true;
            this.calibrate();
            window.addEventListener('deviceorientation', this.boundHandler);
            console.log('🎮 Gyro controls enabled successfully');
            this.showNotification('Tilt Steering Enabled - Tilt device to steer');
            return true;

        } catch (error) {
            console.error('❌ Error enabling gyro controls:', error);
            this.showNotification('Gyro error: ' + error.message);
            return false;
        }
    }

    disable() {
        this.enabled = false;
        this.steeringValue = 0;
        window.removeEventListener('deviceorientation', this.boundHandler);
        console.log('🎮 Gyro controls disabled');
        this.showNotification('Touch Steering Enabled');
    }

    getSteering() {
        return this.steeringValue;
    }

    calibrate() {
        // Simple calibration - reset to current position
        // In a real app, you'd capture the current tilt when called
        this.calibrationOffset = 0;
        console.log('🎮 Gyro controls calibrated');
        this.showNotification('Gyro Calibrated');
    }

    setSensitivity(sensitivity) {
        this.sensitivity = Math.max(0.1, Math.min(3.0, sensitivity));
    }

    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0;
    }

    // ADD THIS HELPER METHOD
    showNotification(message) {
        // Use the existing notification system from main.js
        if (window.showControlNotification) {
            window.showControlNotification(message);
        } else {
            // Fallback notification
            console.log('📢 ' + message);
        }
    }

    dispose() {
        this.disable();
    }
}