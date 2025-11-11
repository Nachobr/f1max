import * as THREE from "three";
import { getTrackProperties } from "./Utils.js";
import { CONFIG } from "./Config.js";

export const carState = {
    position: new THREE.Vector3(0, 0, 0),
    speed: 0,
    rotationAngle: 0,
    velocityAngle: 0,
    currentT: 0,
    isWrongWay: false,

    maxSpeed: 2.0,
    acceleration: 0.025,
    braking: 0.95,
    reverseSpeed: 0.02,
    friction: 0.985,
    handling: 0.022,
    grip: 0.95,
    
    // NEW: Kerb interaction state
    isOnKerb: false,
    kerbEffectTimer: 0,
    originalHandling: 0.04,
};

// Gyro-specific physics tuning
const gyroPhysics = {
    handling: 1.3,        // More responsive with gyro
    maxSteering: 1.2,     // Scale factor for gyro input
    deadZone: 0.05,       // Ignore small gyro movements
    smoothFactor: 0.1     // Smooth gyro inputs (future use)
};

// PRE-ALLOCATE ALL VECTORS (CRITICAL FIX)
const velocityVector = new THREE.Vector3();
const tangentVector = new THREE.Vector3();
const newPosition = new THREE.Vector3();
const carForward = new THREE.Vector3();
const clampedPosition = new THREE.Vector3();

// NEW: Kerb detection function
function checkKerbCollision(position, roadHalfWidth) {
    const kerbWidth = 1.5; // Should match TrackBuilder.js KERB_WIDTH
    const kerbStart = roadHalfWidth;
    const kerbEnd = roadHalfWidth + kerbWidth;
    
    // Check distance from track center to see if we're on kerbs
    const distanceFromCenter = Math.abs(position.lateralDistance || 0);
    
    return distanceFromCenter >= kerbStart && distanceFromCenter <= kerbEnd;
}

// NEW: Calculate turning intensity
function getTurningIntensity(turnDirection, speed) {
    if (speed < 0.1) return 0;
    
    const turningForce = Math.abs(turnDirection) * speed;
    return Math.min(1, turningForce / 2.0); // Normalize to 0-1 range
}

export function updatePhysics(keys, state, curve, divisions, roadHalfWidth, steerValue = null) {
    let turnDirection = 0;
    let isGyroSteering = false;

    // IMPROVED: Better gyro integration with priority
    if (steerValue !== null && Math.abs(steerValue) > gyroPhysics.deadZone) {
        // Use gyro steering with dead zone and scaling
        turnDirection = -steerValue * gyroPhysics.maxSteering;
        isGyroSteering = true;
    } else {
        // Fallback to keyboard/touch steering
        turnDirection = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
    }

    // NEW: Update kerb effect timer
    if (state.kerbEffectTimer > 0) {
        state.kerbEffectTimer -= 1/60; // Assuming 60 FPS
        if (state.kerbEffectTimer <= 0) {
            // Restore original handling when kerb effect ends
            state.handling = state.originalHandling;
            state.isOnKerb = false;
        }
    }

    // Adjust handling based on input method
    const handlingMultiplier = isGyroSteering ? gyroPhysics.handling : 1.0;

    if (state.speed !== 0) {
        const speedFactor = Math.min(1, Math.abs(state.speed) / 0.5);
        state.rotationAngle += turnDirection * state.handling * handlingMultiplier * speedFactor;
    }

    // Throttle control
    if (keys['w']) { // Throttle
        state.speed += state.acceleration;
    } else if (keys['s']) { // Reverse/Brake
        if (state.speed > -0.5) {
            state.speed -= state.reverseSpeed;
        }
    }

    // Space bar brake
    if (keys[' ']) { // Hard Brake
        if (state.speed !== 0) {
            state.speed *= state.braking;
        }
    }

    // Natural friction when no input
    if (!keys['w'] && !keys['s'] && !keys[' ']) {
        state.speed *= state.friction;
    }

    // Speed limits
    state.speed = Math.max(-state.maxSpeed / 2, Math.min(state.maxSpeed, state.speed));
    if (Math.abs(state.speed) < 0.005) {
        state.speed = 0;
    }

    // Velocity angle smoothing for realistic drifting
    let angleDifference = state.rotationAngle - state.velocityAngle;
    while (angleDifference > Math.PI) angleDifference -= 2 * Math.PI;
    while (angleDifference < -Math.PI) angleDifference += 2 * Math.PI;
    state.velocityAngle += angleDifference * (1 - state.grip);

    // Calculate new position using pre-allocated vectors
    velocityVector.set(Math.sin(state.velocityAngle) * state.speed, 0, Math.cos(state.velocityAngle) * state.speed);
    newPosition.copy(state.position).add(velocityVector);

    // Track following and collision detection
    const newProps = getTrackProperties(newPosition, curve, divisions, state.currentT);
    state.currentT = newProps.closestT;

    // NEW: Store lateral distance for kerb detection
    state.lateralDistance = newProps.lateralDistance;

    // Calculate tangent and check if going wrong way
    curve.getTangentAt(newProps.closestT, tangentVector);
    carForward.set(Math.sin(state.rotationAngle), 0, Math.cos(state.rotationAngle));
    const dot = carForward.dot(tangentVector);

    state.isWrongWay = (dot < -0.5 && state.speed > 0.5);
    if (state.isWrongWay) {
        state.speed *= 0.8; // Slow down when going wrong way
    }

    // NEW: Kerb physics interaction
    const isOnKerb = checkKerbCollision(newProps, roadHalfWidth);
    const wasOnKerb = state.isOnKerb;
    state.isOnKerb = isOnKerb;

    // Apply kerb effects when entering or on kerbs
    if (isOnKerb && state.speed > 0.3) {
        const turningIntensity = getTurningIntensity(turnDirection, state.speed);
        
        // Calculate speed reduction based on turning intensity
        const speedReduction = CONFIG.KERB_SLOWDOWN_STRAIGHT + 
                             (CONFIG.KERB_SLOWDOWN_TURNING - CONFIG.KERB_SLOWDOWN_STRAIGHT) * turningIntensity;
        
        state.speed *= speedReduction;
        
        // Only apply handling reduction when first hitting kerb or turning significantly
        if (!wasOnKerb || turningIntensity > 0.3) {
            state.handling = state.originalHandling * (1 - CONFIG.KERB_HANDLING_REDUCTION * turningIntensity);
            state.kerbEffectTimer = CONFIG.KERB_EFFECT_DURATION;
        }
        
        // Optional: Add slight vibration/instability when on kerbs during turning
        if (turningIntensity > 0.5) {
            const instability = turningIntensity * 0.02;
            state.rotationAngle += (Math.random() - 0.5) * instability;
        }
    }

    // Road boundary collision (off-track)
    if (Math.abs(newProps.lateralDistance) > roadHalfWidth + 1.5) { // Beyond kerbs
        state.speed *= 0.95; // Slow down when hitting boundaries
        const clampedLateral = Math.sign(newProps.lateralDistance) * (roadHalfWidth - 0.1);
        clampedPosition.copy(newProps.closestPoint).addScaledVector(newProps.binormal, clampedLateral);
        state.position.lerp(clampedPosition, 0.1); // Smoothly push back to track
    } else {
        state.position.copy(newPosition);
    }

    return {
        position: state.position,
        rotationAngle: state.rotationAngle,
        speed: state.speed,
        isWrongWay: state.isWrongWay,
        turnDirection: turnDirection,
        isGyroSteering: isGyroSteering,
        isOnKerb: state.isOnKerb // NEW: Useful for audio/visual feedback
    };
}

// Optional: Reset function for car state
export function resetCarPhysics() {
    carState.position.set(0, 0, 0);
    carState.speed = 0;
    carState.rotationAngle = 0;
    carState.velocityAngle = 0;
    carState.currentT = 0;
    carState.isWrongWay = false;
    carState.isOnKerb = false; // NEW
    carState.kerbEffectTimer = 0; // NEW
    carState.handling = carState.originalHandling; // NEW
}

// Optional: Update gyro physics settings
export function updateGyroPhysicsSettings(newSettings) {
    Object.assign(gyroPhysics, newSettings);
}

// NEW: Function to get kerb physics info (for UI/debugging)
export function getKerbPhysicsInfo() {
    return {
        isOnKerb: carState.isOnKerb,
        kerbEffectTimer: carState.kerbEffectTimer,
        currentHandling: carState.handling
    };
}