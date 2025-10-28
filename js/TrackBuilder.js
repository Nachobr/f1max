import * as THREE from "three";

// --- REUSABLE GEOMETRIES AND MATERIALS (CREATE ONCE) ---
let roadGeometry = null;
let roadMaterial = null;
let whiteMaterial = null;
let blackMaterial = null;
let wallMaterial = null;
let baseGeometry = null;
let wallGeometryCache = new Map(); // Cache geometries by segment length
let lineGeometryCache = new Map();

// Track constants
const divisions = 2000;
export const roadWidth = 23.5;
export const roadHalfWidth = roadWidth / 2;

// --- TRACK DATA STATE ---
export const trackData = {
    curve: null,
    divisions: divisions,
    sceneMeshes: []
};

// --- DEFAULT TRACK POINTS (your existing points) ---
const DEFAULT_TRACK_POINTS = [
  new THREE.Vector3(108.5, 0, 57.9),
  new THREE.Vector3(102.0, 0, -30.0),
  // ... keep all your existing points ...
  new THREE.Vector3(108.0, 0, 57.9)
];

// --- INITIALIZE MATERIALS (ONCE) ---
function initializeMaterials() {
    if (!roadMaterial) {
        roadMaterial = new THREE.MeshPhongMaterial({ color: 0x333333, side: THREE.DoubleSide });
        whiteMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
        blackMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
        wallMaterial = new THREE.MeshPhongMaterial({ color: 0xaa2222 });
    }
}

// --- IMPROVED CLEAR TRACK FUNCTION ---
export function clearTrack(scene) {
    console.log(`🧹 Clearing track - Meshes: ${trackData.sceneMeshes.length}`);
    
    trackData.sceneMeshes.forEach(mesh => {
        if (scene) scene.remove(mesh);
        
        // Dispose geometry and materials ONLY if they're not shared/reusable
        if (mesh.geometry && !isSharedGeometry(mesh.geometry)) {
            mesh.geometry.dispose();
        }
        
        // Only dispose materials if they're instance-specific
        if (mesh.material && !isSharedMaterial(mesh.material)) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(material => material.dispose());
            } else {
                mesh.material.dispose();
            }
        }
    });
    
    trackData.sceneMeshes = [];
    console.log(`✅ Track cleared`);
}

// Helper functions to check if geometry/material is shared
function isSharedGeometry(geometry) {
    return geometry === roadGeometry || wallGeometryCache.has(geometry) || lineGeometryCache.has(geometry);
}

function isSharedMaterial(material) {
    return material === roadMaterial || material === whiteMaterial || 
           material === blackMaterial || material === wallMaterial;
}

// --- CLEANUP ALL RESOURCES (call when game exits) ---
export function disposeAllTrackResources() {
    clearTrack();
    
    // Dispose shared materials
    if (roadMaterial) roadMaterial.dispose();
    if (whiteMaterial) whiteMaterial.dispose();
    if (blackMaterial) blackMaterial.dispose();
    if (wallMaterial) wallMaterial.dispose();
    
    // Dispose shared geometries
    if (roadGeometry) roadGeometry.dispose();
    if (baseGeometry) baseGeometry.dispose();
    
    // Clear caches
    wallGeometryCache.forEach(geometry => geometry.dispose());
    lineGeometryCache.forEach(geometry => geometry.dispose());
    wallGeometryCache.clear();
    lineGeometryCache.clear();
    
    roadMaterial = null;
    whiteMaterial = null;
    blackMaterial = null;
    wallMaterial = null;
    roadGeometry = null;
    baseGeometry = null;
}

// --- YOUR EXISTING FUNCTIONS WITH OPTIMIZATIONS ---

function smoothTrackCorners(points, smoothness = 0.3, maxAngle = 60) {
    // Keep your existing implementation
    if (points.length < 3) return points;
    
    const smoothedPoints = [points[0].clone()];
    const maxAngleRad = THREE.MathUtils.degToRad(maxAngle);
    
    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const current = points[i];
        const next = points[i + 1];
        
        const v1 = new THREE.Vector3().subVectors(current, prev);
        const v2 = new THREE.Vector3().subVectors(next, current);
        const angle = v1.angleTo(v2);
        
        if (angle > maxAngleRad) {
            const numIntermediatePoints = Math.ceil(angle / maxAngleRad) * 2;
            
            for (let j = 1; j <= numIntermediatePoints; j++) {
                const t = j / (numIntermediatePoints + 1);
                const smoothPoint = new THREE.Vector3()
                    .lerpVectors(prev, current, t)
                    .lerp(current, smoothness);
                smoothedPoints.push(smoothPoint);
            }
            
            smoothedPoints.push(current.clone());
            
            for (let j = 1; j <= numIntermediatePoints; j++) {
                const t = j / (numIntermediatePoints + 1);
                const smoothPoint = new THREE.Vector3()
                    .lerpVectors(current, next, t)
                    .lerp(current, smoothness);
                smoothedPoints.push(smoothPoint);
            }
        } else {
            smoothedPoints.push(current.clone());
        }
    }
    
    smoothedPoints.push(points[points.length - 1].clone());
    return smoothedPoints;
}

export function loadTrackDefinition(trackName) {
    let points;

    if (trackName === 'Monza Standard' || trackName === 'Track1') {
        points = DEFAULT_TRACK_POINTS;
    } else {
        try {
            const data = localStorage.getItem(`trackData_${trackName}`);
            if (data) {
                const rawPoints = JSON.parse(data);
                points = rawPoints.map(p => new THREE.Vector3(parseFloat(p.x), 0, parseFloat(p.z)));
            } else {
                console.warn(`Track '${trackName}' not found. Loading default track instead.`);
                points = DEFAULT_TRACK_POINTS;
            }
        } catch (e) {
            console.error("Error loading track from localStorage:", e);
            points = DEFAULT_TRACK_POINTS;
        }
    }

    const smoothedPoints = smoothTrackCorners(points, 0.3, 60);
    
    if (smoothedPoints.length < 3) {
        console.error("Track has insufficient points. Loading default.");
        points = DEFAULT_TRACK_POINTS;
    }
    
    trackData.curve = new THREE.CatmullRomCurve3(smoothedPoints, true, "catmullrom", 0.1);
}

// --- OPTIMIZED ROAD MESH GENERATION ---
function generateRoadMesh(scene) {
    if (!trackData.curve) {
        console.error("No track curve defined!");
        return;
    }

    initializeMaterials();
    
    const curve = trackData.curve;
    const positions = [];
    const indices = [];
    const normals = [];
    const enhancedDivisions = divisions;

    for (let i = 0; i <= enhancedDivisions; i++) {
        const t = i / enhancedDivisions;
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t).normalize();
        const normal = new THREE.Vector3(0, 1, 0);
        const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

        const left = point.clone().add(binormal.clone().multiplyScalar(roadHalfWidth));
        const right = point.clone().add(binormal.clone().multiplyScalar(-roadHalfWidth));

        positions.push(left.x, left.y, left.z);
        positions.push(right.x, right.y, right.z);
        
        normals.push(normal.x, normal.y, normal.z);
        normals.push(normal.x, normal.y, normal.z);

        if (i < enhancedDivisions) {
            const base = i * 2;
            indices.push(base, base + 1, base + 2);
            indices.push(base + 1, base + 3, base + 2);
        }
    }

    // Reuse road geometry if it exists, otherwise create new
    if (!roadGeometry) {
        roadGeometry = new THREE.BufferGeometry();
    }
    
    roadGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    roadGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    roadGeometry.setIndex(indices);
    roadGeometry.computeVertexNormals();

    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.receiveShadow = true;
    road.castShadow = true;
    scene.add(road);
    trackData.sceneMeshes.push(road);
}

// --- OPTIMIZED START/FINISH LINE ---
function generateStartFinishLine(scene) {
    if (!trackData.curve) return;
    
    const curve = trackData.curve;
    const checkeredWidth = 1.0;
    const lineLength = roadWidth;
    const numCheckers = Math.ceil(lineLength / checkeredWidth);
    
    // Reuse base geometry
    if (!baseGeometry) {
        baseGeometry = new THREE.BoxGeometry(checkeredWidth, 0.01, checkeredWidth);
    }

    const t = 0; 
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const normal = new THREE.Vector3(0, 1, 0);
    const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    const startOffset = roadHalfWidth - (checkeredWidth / 2);

    for (let i = 0; i < numCheckers; i++) {
        const isWhite = i % 2 === 0;
        const material = isWhite ? whiteMaterial : blackMaterial;
        const lateralPos = startOffset - (i * checkeredWidth); 
        const blockPosition = point.clone()
            .add(binormal.clone().multiplyScalar(lateralPos))
            .add(tangent.clone().multiplyScalar(checkeredWidth * 0.5));
        
        const checkerBlock = new THREE.Mesh(baseGeometry, material);
        checkerBlock.position.copy(blockPosition);
        checkerBlock.position.y = 0.005;
        checkerBlock.lookAt(point.clone().add(tangent));

        scene.add(checkerBlock);
        trackData.sceneMeshes.push(checkerBlock);
    }
}

// --- OPTIMIZED WALLS AND MARKINGS ---
function generateMarkingsAndWalls(scene) {
    if (!trackData.curve) return;
    
    const curve = trackData.curve;
    const wallHeight = 2;
    const wallThickness = 0.5;
    const lineThickness = 0.2;
    const lineHeight = 0.01;
    const dashedSegmentLength = 3;
    const dashedGapLength = 3;

    // Generate walls and lines in batches to reduce mesh count
    for (let i = 0; i < divisions; i += 5) { // Process every 5th segment to reduce mesh count
        const t = i / divisions;
        const next_t = Math.min((i + 5) / divisions, 1.0);

        const p1 = curve.getPointAt(t);
        const p2 = curve.getPointAt(next_t);
        const tangent = curve.getTangentAt(t);
        const normal = new THREE.Vector3(0, 1, 0);
        const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();
        const segmentLength = p1.distanceTo(p2);

        // Generate walls on both sides
        [1, -1].forEach(side => {
            const wallOffset = roadHalfWidth + 1.5;
            const edgeOffset = roadHalfWidth;

            const wallP1 = p1.clone().add(binormal.clone().multiplyScalar(wallOffset * side));
            const wallP2 = p2.clone().add(binormal.clone().multiplyScalar(wallOffset * side));
            const lineP1 = p1.clone().add(binormal.clone().multiplyScalar(edgeOffset * side));
            const lineP2 = p2.clone().add(binormal.clone().multiplyScalar(edgeOffset * side));

            // Reuse wall geometry by segment length
            let wallGeometry = wallGeometryCache.get(segmentLength);
            if (!wallGeometry) {
                wallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, segmentLength);
                wallGeometryCache.set(segmentLength, wallGeometry);
            }

            // Wall
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.castShadow = true;
            wall.receiveShadow = true;
            wall.position.copy(wallP1).lerp(wallP2, 0.5);
            wall.position.y = wallHeight / 2;
            wall.lookAt(wallP2.clone().setY(wall.position.y));
            scene.add(wall);
            trackData.sceneMeshes.push(wall);

            // Edge line - reuse geometry
            let edgeLineGeometry = lineGeometryCache.get(segmentLength);
            if (!edgeLineGeometry) {
                edgeLineGeometry = new THREE.BoxGeometry(lineThickness, lineHeight, segmentLength);
                lineGeometryCache.set(segmentLength, edgeLineGeometry);
            }

            const edgeLine = new THREE.Mesh(edgeLineGeometry, whiteMaterial);
            edgeLine.position.copy(lineP1).lerp(lineP2, 0.5);
            edgeLine.position.y = lineHeight / 2;
            edgeLine.lookAt(lineP2.clone().setY(edgeLine.position.y));
            scene.add(edgeLine);
            trackData.sceneMeshes.push(edgeLine);
        });
    }
}

export function generateTrackMesh(scene) {
    console.log(`🛠️ Generating track mesh - Current meshes: ${trackData.sceneMeshes.length}`);
    
    // Clear any existing track first
    clearTrack(scene);
    
    // Generate new track
    generateRoadMesh(scene);
    generateStartFinishLine(scene);
    generateMarkingsAndWalls(scene);
    
    console.log(`✅ Track generation complete - Total meshes: ${trackData.sceneMeshes.length}`);
}