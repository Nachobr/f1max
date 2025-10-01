import * as THREE from "three";
import { getTrackProperties } from "./Utils.js";

// --- IMPROVED PHYSICS PROPERTIES ---
export const carState = {
    position: new THREE.Vector3(0, 0, 0),
    speed: 0,
    rotationAngle: 0,       // Car's visual rotation (Y-axis)
    velocityAngle: 0,       // Direction of travel
    currentT: 0,
    isWrongWay: false,

    // Physics constants
    maxSpeed: 2.0,
    acceleration: 0.035,
    braking: 0.07,
    friction: 0.01,
    handling: 0.035,        // How quickly the car can turn
    grip: 0.95,             // How much the velocity follows the car's rotation (closer to 1 = more grip)
};

// Reusable vectors for physics calculations
const velocityVector = new THREE.Vector3();
const tangentVector = new THREE.Vector3();

/**
 * Updates the car's position, speed, and rotation based on input and track constraints.
 */
export function updatePhysics(keys, state, curve, divisions, roadHalfWidth) {
    // --- 1. HANDLE INPUT & UPDATE SPEED/ROTATION ---

    // Acceleration and Braking
    if (keys['w']) {
        state.speed += state.acceleration;
    } else if (keys['s']) {
        state.speed -= state.braking;
    } else {
        // Apply friction when no input
        state.speed *= (1 - state.friction);
    }
    state.speed = Math.max(-state.maxSpeed / 2, Math.min(state.maxSpeed, state.speed)); // Clamp speed

    // Stop the car if speed is very low
    if (Math.abs(state.speed) < 0.005) {
        state.speed = 0;
    }

    // Steering
    if (state.speed !== 0) {
        const turnDirection = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
        // Steering is less effective at lower speeds
        const speedFactor = Math.min(1, Math.abs(state.speed) / 0.5);
        state.rotationAngle += turnDirection * state.handling * speedFactor;
    }

    // --- 2. UPDATE VELOCITY ANGLE & POSITION ---

    // The velocity angle gradually "catches up" to the car's visual rotation.
    let angleDifference = state.rotationAngle - state.velocityAngle;
    // Normalize the angle difference for the shortest turn.
    while (angleDifference > Math.PI) angleDifference -= 2 * Math.PI;
    while (angleDifference < -Math.PI) angleDifference += 2 * Math.PI;

    state.velocityAngle += angleDifference * (1 - state.grip);

    // Calculate new position based on the velocity vector
    velocityVector.set(
        Math.sin(state.velocityAngle) * state.speed,
        0,
        Math.cos(state.velocityAngle) * state.speed
    );
    const newPosition = state.position.clone().add(velocityVector);

    // --- 3. TRACK COLLISION & WRONG WAY DETECTION ---
    
    const newProps = getTrackProperties(newPosition, curve, divisions, state.currentT);
    state.currentT = newProps.closestT;

    // Get track's forward direction
    curve.getTangentAt(newProps.closestT, tangentVector);
    // Get car's forward direction
    const carForward = new THREE.Vector3(Math.sin(state.rotationAngle), 0, Math.cos(state.rotationAngle));
    const dot = carForward.dot(tangentVector);

    // Wrong Way Detection
    state.isWrongWay = (dot < -0.5 && state.speed > 0.5);
    if (state.isWrongWay) {
        state.speed *= 0.8; // Heavy speed penalty
    }

    // Wall Collision
    if (Math.abs(newProps.lateralDistance) > roadHalfWidth) {
        state.speed *= 0.5; // Lose speed on collision

        // Clamp position to the edge of the road
        const clampedLateral = Math.sign(newProps.lateralDistance) * (roadHalfWidth - 0.1);
        const clampedPosition = newProps.closestPoint.clone().add(newProps.binormal.clone().multiplyScalar(clampedLateral));
        state.position.copy(clampedPosition);
    } else {
        state.position.copy(newPosition);
    }

    return {
        position: state.position,
        rotationAngle: state.rotationAngle,
        velocityAngle: state.velocityAngle,
        speed: state.speed,
        isWrongWay: state.isWrongWay,
    };
}