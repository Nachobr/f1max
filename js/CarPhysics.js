import * as THREE from "three";
import { getTrackProperties } from "./Utils.js";

// --- IMPROVED PHYSICS PROPERTIES ---
export const carState = {
    position: new THREE.Vector3(0, 0, 0),
    speed: 0,
    rotationAngle: 0, // Car's rotation (Y-axis)
    velocityAngle: 0, // Direction of travel (velocity vector)
    currentT: 0, // Closest point on track [0, 1]
    isWrongWay: false, // NEW FLAG for detection/HUD

    // Physics constants
    maxSpeed: 2.0,
    acceleration: 0.035,
    braking: 0.07,
    friction: 0.01,
    handling: 0.035,
    grip: 0.85,
    maxDriftAngle: Math.PI / 10,
};

// Reusable vectors for physics calculations
const velocityVector = new THREE.Vector3();
const tangentVector = new THREE.Vector3(); // NEW
const forwardVelocityVector = new THREE.Vector3(); // NEW
const tempVector = new THREE.Vector3();

/**
 * Updates the car's position, speed, and rotation based on input and track constraints.
 * @param {Object} keys - State of keyboard inputs.
 * @param {Object} state - The current car state (carState).
 * @param {THREE.Curve} curve - The track curve.
 * @param {number} divisions - Number of track divisions.
 * @param {number} roadHalfWidth - Half the width of the road.
 * @returns {Object} Updated car state properties.
 */
export function updatePhysics(keys, state, curve, divisions, roadHalfWidth) {
    // --- INPUT AND SPEED UPDATE ---
    let inputDelta = 0;
    if (keys["arrowup"] || keys["w"]) {
        inputDelta += state.acceleration;
    }
    if (keys["arrowdown"] || keys["s"]) {
        inputDelta -= state.braking;
    }

    const handbrakeMultiplier = keys[" "] ? 3 : 1;
    const friction = state.friction * handbrakeMultiplier;

    state.speed += inputDelta;
    if (state.speed > 0) {
        state.speed = Math.max(0, state.speed - friction);
        state.speed = Math.min(state.maxSpeed, state.speed);
    } else if (state.speed < 0) {
        state.speed = Math.min(0, state.speed + friction);
        state.speed = Math.max(-state.maxSpeed * 0.5, state.speed);
    }

    // --- STEERING (CAR ROTATION) ---
    if (Math.abs(state.speed) > 0.001) {
        const effectiveTurnSpeed = state.handling * (1 - Math.abs(state.speed) / state.maxSpeed * 0.6);
        const steerDirection = Math.sign(state.speed);

        if (keys["arrowleft"] || keys["a"]) {
            state.rotationAngle -= effectiveTurnSpeed * steerDirection;
        }
        if (keys["arrowright"] || keys["d"]) {
            state.rotationAngle += effectiveTurnSpeed * steerDirection;
        }
    }

    // --- VELOCITY ALIGNMENT (GRIP/DRIFT) ---
    let rotationDiff = state.rotationAngle - state.velocityAngle;
    if (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    if (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
    rotationDiff = Math.min(Math.max(rotationDiff, -state.maxDriftAngle), state.maxDriftAngle);

    state.velocityAngle += rotationDiff * state.grip;

    // --- MOVEMENT & COLLISION ---
    const velocityAngle = state.velocityAngle - Math.PI / 2;
    velocityVector.set(Math.cos(velocityAngle), 0, Math.sin(velocityAngle)).multiplyScalar(state.speed);

    const newPosition = state.position.clone().add(velocityVector);
    const newProps = getTrackProperties(newPosition, curve, divisions, state.currentT);
    
    // 1. WRONG WAY DETECTION & PENALTY (NEW LOGIC)
    curve.getTangentAt(newProps.closestT, tangentVector); 
    forwardVelocityVector.copy(velocityVector).normalize();
    const dotProduct = forwardVelocityVector.dot(tangentVector);
    
    if (dotProduct < -0.8 && state.speed > 0.5) { 
        // Penalize if moving forward quickly (> 0.5) against the track direction (dot < -0.8)
        
        state.isWrongWay = true; 
        
        // --- Penalty: Teleport and Reset ---
        state.position.copy(newProps.closestPoint);
        
        // Correct Angle: Face the track's tangent
        let correctAngle = Math.atan2(tangentVector.x, -tangentVector.z);
        state.velocityAngle = correctAngle;
        state.rotationAngle = correctAngle;
        
        // Stop speed
        state.speed = 0;
        
    } else {
        state.isWrongWay = false;

        // 2. REGULAR COLLISION LOGIC
        if (Math.abs(newProps.lateralDistance) < roadHalfWidth) {
            state.position.copy(newPosition);
        } else {
            // Collision Response
            state.speed *= 0.4;

            // Clamp position to the edge of the road
            const clampedLateral = Math.max(-roadHalfWidth + 0.1, Math.min(roadHalfWidth - 0.1, newProps.lateralDistance));
            const clampedPosition = newProps.closestPoint.clone().add(newProps.binormal.clone().multiplyScalar(clampedLateral));
            state.position.copy(clampedPosition);

            // Re-align velocity and rotation to track tangent
            curve.getTangentAt(newProps.closestT, tangentVector);
            let targetAngle = Math.atan2(tangentVector.x, -tangentVector.z);
            if (state.speed < 0) targetAngle += Math.PI;
            state.velocityAngle = targetAngle;
            state.rotationAngle = targetAngle;
        }
    }
    
    return state;
}