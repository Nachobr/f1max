import * as THREE from "three";
import { TRACKS } from './Config.js';

// PRE-ALLOCATE ALL VECTORS (CRITICAL FIX)
const closestPoint = new THREE.Vector3();
const tangent = new THREE.Vector3();
const binormal = new THREE.Vector3();
const tempVector = new THREE.Vector3();
const normal = new THREE.Vector3(0, 1, 0); // MOVE THIS OUTSIDE THE FUNCTION
const searchPoint = new THREE.Vector3(); // ADD THIS FOR THE LOOP

export function getAvailableTracks() {
    const allTracks = new Set(TRACKS);
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('trackData_')) {
            const trackName = key.substring(10);
            allTracks.add(trackName);
        }
    }
    return Array.from(allTracks).sort();
}

export function formatTime(ms) {
    if (ms === null || isNaN(ms) || ms === Infinity || ms === 0) {
        return '--:--.---';
    }
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor(ms % 1000);
    return `${String(minutes)}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

export function getTrackProperties(position, curve, divisions, lastT) {
    let closestPointT = lastT;
    let minDistanceSq = Infinity;
    const searchRange = 30;
    const currentI = Math.floor(lastT * divisions);

    for (let i = -searchRange; i <= searchRange; i += 2) {
        let index = currentI + i;
        if (index < 0) index += divisions;
        else if (index > divisions) index -= divisions;
        
        const t = index / divisions;
        
        // REUSE pre-allocated vector instead of creating new one
        curve.getPointAt(t, searchPoint);
        const distanceSq = searchPoint.distanceToSquared(position);
        
        if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq;
            closestPointT = t;
        }
    }

    // REUSE all pre-allocated vectors
    curve.getPointAt(closestPointT, closestPoint);
    curve.getTangentAt(closestPointT, tangent);
    
    // Calculate binormal using pre-allocated vectors
    binormal.crossVectors(normal, tangent).normalize();
    
    // Calculate lateral distance
    tempVector.copy(position).sub(closestPoint);
    const lateralDistance = tempVector.dot(binormal);

    return { 
        lateralDistance, 
        minDistanceSq, 
        binormal, 
        closestPoint, 
        closestT: closestPointT 
    };
}