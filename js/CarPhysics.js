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

// PRE-ALLOCATE ALL VECTORS (CRITICAL FIX)
const velocityVector = new THREE.Vector3();
const tangentVector = new THREE.Vector3();
const newPosition = new THREE.Vector3();
const carForward = new THREE.Vector3();
const clampedPosition = new THREE.Vector3();

export function updatePhysics(keys, state, curve, divisions, roadHalfWidth, steerValue = null) {
    let turnDirection = 0;
    if (steerValue !== null) {
        turnDirection = -steerValue;
    } else {
        turnDirection = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
    }

    if (state.speed !== 0) {
        const speedFactor = Math.min(1, Math.abs(state.speed) / 0.5);
        state.rotationAngle += turnDirection * state.handling * speedFactor;
    }

    if (keys['w']) { // Throttle
        state.speed += state.acceleration;
    } else if (keys['s']) { // Reverse
        if (state.speed > -0.5) {
            state.speed -= state.reverseSpeed;
        }
    }

    if (keys[' ']) { // Brake
        if (state.speed !== 0) {
            state.speed *= state.braking;
        }
    }

    if (!keys['w'] && !keys['s'] && !keys[' ']) {
        state.speed *= state.friction;
    }

    state.speed = Math.max(-state.maxSpeed / 2, Math.min(state.maxSpeed, state.speed));
    if (Math.abs(state.speed) < 0.005) {
        state.speed = 0;
    }

    let angleDifference = state.rotationAngle - state.velocityAngle;
    while (angleDifference > Math.PI) angleDifference -= 2 * Math.PI;
    while (angleDifference < -Math.PI) angleDifference += 2 * Math.PI;
    state.velocityAngle += angleDifference * (1 - state.grip);

    // REUSE pre-allocated vectors
    velocityVector.set(Math.sin(state.velocityAngle) * state.speed, 0, Math.cos(state.velocityAngle) * state.speed);
    newPosition.copy(state.position).add(velocityVector);

    const newProps = getTrackProperties(newPosition, curve, divisions, state.currentT);
    state.currentT = newProps.closestT;

    curve.getTangentAt(newProps.closestT, tangentVector);
    carForward.set(Math.sin(state.rotationAngle), 0, Math.cos(state.rotationAngle));
    const dot = carForward.dot(tangentVector);

    state.isWrongWay = (dot < -0.5 && state.speed > 0.5);
    if (state.isWrongWay) { state.speed *= 0.8; }

    if (Math.abs(newProps.lateralDistance) > roadHalfWidth) {
        state.speed *= 0.95;
        const clampedLateral = Math.sign(newProps.lateralDistance) * (roadHalfWidth - 0.1);
        clampedPosition.copy(newProps.closestPoint).addScaledVector(newProps.binormal, clampedLateral);
        state.position.lerp(clampedPosition, 0.1);
    } else {
        state.position.copy(newPosition);
    }

    return {
        position: state.position,
        rotationAngle: state.rotationAngle,
        speed: state.speed,
        isWrongWay: state.isWrongWay,
        turnDirection: turnDirection,
    };
}