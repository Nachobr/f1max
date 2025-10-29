import * as THREE from "three";
import { getTrackProperties } from "./Utils.js";

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
    handling: 0.04,
    grip: 0.95,
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

export function updatePhysics(keys, state, curve, divisions, roadHalfWidth, steerValue = null) {
    let turnDirection = 0;
    let isGyroSteering = false;

    // IMPROVED: Better gyro integration with priority
    if (steerValue !== null && Math.abs(steerValue) > gyroPhysics.deadZone) {
        // Use gyro steering with dead zone and scaling
        turnDirection = -steerValue * gyroPhysics.maxSteering;
        isGyroSteering = true;
        //console.log('🎮 Physics using GYRO steering:', steerValue.toFixed(3), '-> turnDirection:', turnDirection.toFixed(3));
    } else {
        // Fallback to keyboard/touch steering
        turnDirection = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
        if (turnDirection !== 0 && !isGyroSteering) {
            //console.log('🎮 Physics using KEYBOARD steering:', turnDirection);
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

    // Calculate tangent and check if going wrong way
    curve.getTangentAt(newProps.closestT, tangentVector);
    carForward.set(Math.sin(state.rotationAngle), 0, Math.cos(state.rotationAngle));
    const dot = carForward.dot(tangentVector);

    state.isWrongWay = (dot < -0.5 && state.speed > 0.5);
    if (state.isWrongWay) {
        state.speed *= 0.8; // Slow down when going wrong way
    }

    // Road boundary collision
    if (Math.abs(newProps.lateralDistance) > roadHalfWidth) {
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
        isGyroSteering: isGyroSteering // Useful for debugging
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
}

// Optional: Update gyro physics settings
export function updateGyroPhysicsSettings(newSettings) {
    Object.assign(gyroPhysics, newSettings);
    //console.log('🎮 Updated gyro physics settings:', gyroPhysics);
}