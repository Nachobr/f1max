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
    braking: 0.95,      // ✅ FIX: Strong multiplicative brake factor
    reverseSpeed: 0.02, // ✅ NEW: Slow acceleration for reverse
    friction: 0.985,     // ✅ FIX: Multiplicative friction factor
    handling: 0.04,
    grip: 0.95,
};

const velocityVector = new THREE.Vector3();
const tangentVector = new THREE.Vector3();

/**
 * Updates car physics, now accepting an optional analog steerValue.
 */
export function updatePhysics(keys, state, curve, divisions, roadHalfWidth, steerValue = null) {
    // --- 1. HANDLE STEERING (ANALOG & DIGITAL) ---
    let turnDirection = 0;
    if (steerValue !== null) {
        // Use analog joystick value for smoother steering
        turnDirection = -steerValue;
    } else {
        // Fall back to binary keyboard input
        turnDirection = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
    }

    if (state.speed !== 0) {
        const speedFactor = Math.min(1, Math.abs(state.speed) / 0.5);
        state.rotationAngle += turnDirection * state.handling * speedFactor;
    }

    // --- ✅ 2. HANDLE ACCELERATION, BRAKING, AND REVERSING ---
    if (keys['w']) { // Throttle
        state.speed += state.acceleration;
    } else if (keys['s']) { // Reverse
        // Only allow reversing if car is slow or already moving backwards
        if (state.speed > -0.5) {
            state.speed -= state.reverseSpeed;
        }
    }

    if (keys[' ']) { // Brake (Spacebar or Brake button)
        // Apply strong braking force only when moving
        if (state.speed !== 0) {
            state.speed *= state.braking;
        }
    }

    // Apply friction if no input is given
    if (!keys['w'] && !keys['s'] && !keys[' ']) {
        state.speed *= state.friction;
    }

    state.speed = Math.max(-state.maxSpeed / 2, Math.min(state.maxSpeed, state.speed));
    if (Math.abs(state.speed) < 0.005) {
        state.speed = 0;
    }

    // --- 3. UPDATE POSITION & TRACK COLLISION ---
    let angleDifference = state.rotationAngle - state.velocityAngle;
    while (angleDifference > Math.PI) angleDifference -= 2 * Math.PI;
    while (angleDifference < -Math.PI) angleDifference += 2 * Math.PI;
    state.velocityAngle += angleDifference * (1 - state.grip);

    velocityVector.set(Math.sin(state.velocityAngle) * state.speed, 0, Math.cos(state.velocityAngle) * state.speed);
    const newPosition = state.position.clone().add(velocityVector);

    const newProps = getTrackProperties(newPosition, curve, divisions, state.currentT);
    state.currentT = newProps.closestT;

    curve.getTangentAt(newProps.closestT, tangentVector);
    const carForward = new THREE.Vector3(Math.sin(state.rotationAngle), 0, Math.cos(state.rotationAngle));
    const dot = carForward.dot(tangentVector);

    state.isWrongWay = (dot < -0.5 && state.speed > 0.5);
    if (state.isWrongWay) { state.speed *= 0.8; }

    if (Math.abs(newProps.lateralDistance) > roadHalfWidth) {
        state.speed *= 0.5;
        const clampedLateral = Math.sign(newProps.lateralDistance) * (roadHalfWidth - 0.1);
        const clampedPosition = newProps.closestPoint.clone().add(newProps.binormal.clone().multiplyScalar(clampedLateral));
        state.position.copy(clampedPosition);
    } else {
        state.position.copy(newPosition);
    }

    return {
        position: state.position,
        rotationAngle: state.rotationAngle,
        speed: state.speed,
        isWrongWay: state.isWrongWay,
    };
}