// GyroControls.js - Use gamma tilt for both portrait and landscape
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
        this.calibrationRequested = false;
        this.tiltMode = 'gamma';


        // Store the bound handler for proper cleanup
        this.boundHandler = this.handleOrientation.bind(this);

        // Check screen orientation
        this.checkOrientation();
        window.addEventListener('resize', () => this.checkOrientation());
        screen.orientation?.addEventListener('change', () => this.checkOrientation());

        this.checkGyroSupport();
        //console.log('🎮 GyroControls initialized', {
        //    hasGyro: this.hasGyro,
        //    requiresHTTPS: this.requiresHTTPS,
        //    protocol: window.location.protocol,
        //    orientation: this.isLandscape ? 'landscape' : 'portrait'
        //});
    }

    checkOrientation() {
        const wasLandscape = this.isLandscape;
        this.isLandscape = window.innerWidth > window.innerHeight;

        //console.log('🎮 Screen orientation:', this.isLandscape ? 'landscape' : 'portrait');

        // Don't auto-calibrate - let user manually calibrate when they want
        if (wasLandscape !== this.isLandscape && this.enabled) {
            //console.log('🎮 Orientation changed - please recalibrate if needed');
            this.showNotification('Orientation changed - recalibrate if needed');
        }
    }

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



    async enable() {
        if (!this.isMobileDevice()) {
            //console.warn('📱 Gyro controls only available on mobile devices');
            this.showNotification('Gyro only works on mobile devices');
            return false;
        }

        if (!this.hasGyro) {
            //console.warn('📱 Device does not support gyroscope');
            this.showNotification('Your device does not support gyroscope');
            return false;
        }

        if (this.requiresHTTPS) {
            //console.warn('📱 Gyro requires HTTPS or localhost');
            this.showNotification('Gyro requires HTTPS. Use a local server or HTTPS.');
            return false;
        }

        if (!this.testEventReceived) {
            //console.warn('📱 No gyro events received - may not be supported');
            this.showNotification('Gyro not available. Try Chrome browser.');
            return false;
        }

        try {
            // iOS 13+ permission handling
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                //console.log('📱 Requesting iOS gyro permission...');
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission !== 'granted') {
                    //console.warn('❌ Gyroscope permission denied');
                    this.showNotification('Gyro permission denied');
                    return false;
                }
            }

            this.enabled = true;
            // Don't auto-calibrate - let user decide when to calibrate
            window.addEventListener('deviceorientation', this.boundHandler);
            //console.log('🎮 Gyro controls enabled successfully');
            this.showNotification('Tilt Steering Enabled - Tilt device left/right to steer');
            return true;

        } catch (error) {
            //console.error('❌ Error enabling gyro controls:', error);
            this.showNotification('Gyro error: ' + error.message);
            return false;
        }
    }

    disable() {
        this.enabled = false;
        this.steeringValue = 0;
        window.removeEventListener('deviceorientation', this.boundHandler);
        //console.log('🎮 Gyro controls disabled');
        this.showNotification('Touch Steering Enabled');
    }

    getSteering() {
        return this.steeringValue;
    }

    calibrate() {
        if (!this.enabled) return;

        // Simple one-click calibration - set current gamma as neutral
        // The next orientation event will capture the current position
        this.calibrationRequested = true;
        //console.log('🎮 Calibration requested - next tilt position will be set as neutral');
        this.showNotification('Calibrating... Tilt to desired neutral position');
    }

    handleOrientation(event) {
        if (!this.enabled) return;

        // Store the latest event for calibration if needed
        window.gyroEvent = event;

        // CHOOSE TILT AXIS BASED ON MODE
        let tilt = 0;
        if (this.tiltMode === 'beta') {
            // Use beta (front-back tilt) - good for landscape racing wheel style
            tilt = event.beta || 0;
            // Adjust for natural holding position in landscape
            if (this.isLandscape) {
                tilt = (tilt - 45); // Center around 45 degrees (natural landscape hold)
            }
        } else {
            // Use gamma (left-right tilt) - good for portrait steering wheel style
            tilt = event.gamma || 0;
        }

        // If calibration was requested, set current position as neutral
        if (this.calibrationRequested) {
            this.calibrationOffset = tilt;
            this.calibrationRequested = false;
            //console.log('🎮 Neutral position set to:', this.calibrationOffset.toFixed(1));
            this.showNotification('Neutral position set!');
        }

        // Apply calibration and sensitivity
        let calibratedTilt = (tilt - this.calibrationOffset) * this.sensitivity;

        // Convert to steering value (-1 to 1)
        this.steeringValue = Math.max(-1, Math.min(1, calibratedTilt / this.maxSteeringAngle));

        // Dead zone to prevent tiny movements
        if (Math.abs(this.steeringValue) < 0.1) {
            this.steeringValue = 0;
        }

        //console.log('🎮 Gyro - Gamma:', event.gamma?.toFixed(1),
        //    'Calibrated Tilt:', calibratedTilt.toFixed(1),
        //    'Steering:', this.steeringValue.toFixed(3),
        //    'Mode:', this.isLandscape ? 'landscape' : 'portrait');
    }
    toggleTiltMode() {
        if (this.tiltMode === 'gamma') {
            this.tiltMode = 'beta';
            this.showNotification('Tilt Mode: Front-Back (Racing Wheel)');
        } else {
            this.tiltMode = 'gamma';
            this.showNotification('Tilt Mode: Left-Right (Steering Wheel)');
        }

        // Reset calibration when switching modes
        this.calibrationOffset = 0;
        //console.log('🎮 Tilt mode changed to:', this.tiltMode);
    }



    setSensitivity(sensitivity) {
        this.sensitivity = Math.max(0.1, Math.min(3.0, sensitivity));
    }

    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0;
    }

    showNotification(message) {
        if (window.showControlNotification) {
            window.showControlNotification(message);
        } else {
            //console.log('📢 ' + message);
        }
    }

    dispose() {
        this.disable();
    }
}