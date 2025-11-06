import * as THREE from "three";

// --- REUSABLE GEOMETRIES AND MATERIALS (CREATE ONCE) ---
let roadGeometry = null;
let roadMaterial = null;
let whiteMaterial = null;
let blackMaterial = null;
let redMaterial = null;
let yellowMaterial = null;
let blueMaterial = null;
let kerbGeometryCache = new Map();
let lineGeometryCache = new Map();
let baseGeometry = null;

// Track constants
const divisions = 2000;
export const roadWidth = 23.5;
export const roadHalfWidth = roadWidth / 2;
const KERB_WIDTH = 1.5;
const KERB_HEIGHT = 0.1;
const KERB_SEGMENT_LENGTH = 4;

// --- TRACK DATA STATE ---
export const trackData = {
    curve: null,
    divisions: divisions,
    sceneMeshes: []
};

// --- DEFAULT TRACK POINTS (Monza-inspired layout) ---
// --- DEFAULT TRACK POINTS (Mexico GP - Autódromo Hermanos Rodríguez) ---
const DEFAULT_TRACK_POINTS = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(300, 0, 0),
    new THREE.Vector3(320, 0, 50),
    new THREE.Vector3(300, 0, 100),
    new THREE.Vector3(320, 0, 150),
    new THREE.Vector3(340, 0, 200),
    new THREE.Vector3(320, 0, 250),
    new THREE.Vector3(340, 0, 300),
    new THREE.Vector3(340, 0, 500),
    new THREE.Vector3(320, 0, 550),
    new THREE.Vector3(290, 0, 500),
    new THREE.Vector3(260, 0, 550),
    new THREE.Vector3(240, 0, 600),
    new THREE.Vector3(210, 0, 550),
    new THREE.Vector3(180, 0, 600),
    new THREE.Vector3(100, 0, 600),
    new THREE.Vector3(50, 0, 550),
    new THREE.Vector3(0, 0, 500),
    new THREE.Vector3(-50, 0, 450),
    new THREE.Vector3(-100, 0, 400),
    new THREE.Vector3(-50, 0, 350),
    new THREE.Vector3(0, 0, 0)

];

// --- F1 TRACK FEATURE ZONES FOR MEXICO ---
const TRACK_FEATURES = {
    kerbZones: [
        // Turn 1-2 Complex (The Esses)
        { startT: 0.08, endT: 0.15, type: 'red-white', sides: ['left', 'right'] },

        // Turn 3 (Medium speed left)
        { startT: 0.18, endT: 0.22, type: 'yellow', sides: ['right'] },

        // Turn 4-5 (Right-left flick)
        { startT: 0.25, endT: 0.30, type: 'red-white', sides: ['left', 'right'] },

        // Turn 6 (Long right-hander exit)
        { startT: 0.35, endT: 0.40, type: 'red-white', sides: ['left'] },

        // Peraltada (Turn 7-8) - High speed banked corner
        { startT: 0.45, endT: 0.52, type: 'yellow', sides: ['right'] },
        { startT: 0.52, endT: 0.58, type: 'red-white', sides: ['left'] },

        // Stadium Section Entrance (Turn 9)
        { startT: 0.60, endT: 0.65, type: 'red-white', sides: ['right'] },

        // Stadium Complex
        // Turn 10-11 (Hairpin)
        { startT: 0.68, endT: 0.72, type: 'red-white', sides: ['left', 'right'] },

        // Turn 12-13 (Double right)
        { startT: 0.75, endT: 0.80, type: 'red-white', sides: ['left'] },

        // Turn 14-15 (Chicane)
        { startT: 0.82, endT: 0.87, type: 'red-white', sides: ['left', 'right'] },

        // Turn 16 (Final corner)
        { startT: 0.90, endT: 0.96, type: 'red-white', sides: ['left'] }
    ],

    drsZones: [
        { startT: 0.02, endT: 0.06, side: 'left' },  // Main straight
        { startT: 0.38, endT: 0.42, side: 'left' }   // Back straight before Peraltada
    ]
};

// --- INITIALIZE MATERIALS (ONCE) ---
function initializeMaterials() {
    if (!roadMaterial) {
        roadMaterial = new THREE.MeshPhongMaterial({
            color: 0x333333,
            side: THREE.DoubleSide,
            shininess: 30
        });
        whiteMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            shininess: 60
        });
        blackMaterial = new THREE.MeshPhongMaterial({
            color: 0x111111,
            shininess: 60
        });
        redMaterial = new THREE.MeshPhongMaterial({
            color: 0xff0000,
            shininess: 50
        });
        yellowMaterial = new THREE.MeshPhongMaterial({
            color: 0xffff00,
            shininess: 50
        });
        blueMaterial = new THREE.MeshPhongMaterial({
            color: 0x0066ff,
            shininess: 50
        });
    }
}

// --- IMPROVED CLEAR TRACK FUNCTION ---
export function clearTrack(scene) {
    trackData.sceneMeshes.forEach(mesh => {
        if (scene) scene.remove(mesh);

        if (mesh.geometry && !isSharedGeometry(mesh.geometry)) {
            mesh.geometry.dispose();
        }

        if (mesh.material && !isSharedMaterial(mesh.material)) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(material => material.dispose());
            } else {
                mesh.material.dispose();
            }
        }
    });

    trackData.sceneMeshes = [];
}

// Helper functions to check if geometry/material is shared
function isSharedGeometry(geometry) {
    return geometry === roadGeometry || kerbGeometryCache.has(geometry) || lineGeometryCache.has(geometry);
}

function isSharedMaterial(material) {
    return material === roadMaterial || material === whiteMaterial ||
        material === blackMaterial || material === redMaterial ||
        material === yellowMaterial || material === blueMaterial;
}

// --- CLEANUP ALL RESOURCES ---
export function disposeAllTrackResources() {
    clearTrack();

    if (roadMaterial) roadMaterial.dispose();
    if (whiteMaterial) whiteMaterial.dispose();
    if (blackMaterial) blackMaterial.dispose();
    if (redMaterial) redMaterial.dispose();
    if (yellowMaterial) yellowMaterial.dispose();
    if (blueMaterial) blueMaterial.dispose();

    if (roadGeometry) roadGeometry.dispose();
    if (baseGeometry) baseGeometry.dispose();

    kerbGeometryCache.forEach(geometry => geometry.dispose());
    lineGeometryCache.forEach(geometry => geometry.dispose());
    kerbGeometryCache.clear();
    lineGeometryCache.clear();

    roadMaterial = null;
    whiteMaterial = null;
    blackMaterial = null;
    redMaterial = null;
    yellowMaterial = null;
    blueMaterial = null;
    roadGeometry = null;
    baseGeometry = null;
}

// --- SMOOTHING FUNCTION (UNCHANGED) ---
function smoothTrackCorners(points, smoothness = 0.3, maxAngle = 60) {
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

// --- TRACK LOADING (UNCHANGED) ---
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
                points = DEFAULT_TRACK_POINTS;
            }
        } catch (e) {
            points = DEFAULT_TRACK_POINTS;
        }
    }

    const smoothedPoints = smoothTrackCorners(points, 0.3, 60);

    if (smoothedPoints.length < 3) {
        points = DEFAULT_TRACK_POINTS;
    }

    trackData.curve = new THREE.CatmullRomCurve3(smoothedPoints, true, "catmullrom", 0.1);
}

// --- OPTIMIZED ROAD MESH GENERATION (UNCHANGED) ---
function generateRoadMesh(scene) {
    if (!trackData.curve) return;

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

// --- F1-STYLE KERBS GENERATION ---
function generateF1Kerbs(scene) {
    if (!trackData.curve) return;

    const curve = trackData.curve;

    TRACK_FEATURES.kerbZones.forEach(zone => {
        const startIndex = Math.floor(zone.startT * divisions);
        const endIndex = Math.floor(zone.endT * divisions);

        for (let i = startIndex; i <= endIndex; i += 2) {
            const t = i / divisions;
            const point = curve.getPointAt(t);
            const tangent = curve.getTangentAt(t);
            const normal = new THREE.Vector3(0, 1, 0);
            const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

            // Generate kerbs on specified sides
            zone.sides.forEach(side => {
                const sideMultiplier = side === 'left' ? 1 : -1;
                const kerbPosition = point.clone().add(
                    binormal.clone().multiplyScalar((roadHalfWidth + KERB_WIDTH / 2) * sideMultiplier)
                );

                // Choose material and pattern based on kerb type
                let kerbMaterial;
                if (zone.type === 'red-white') {
                    // Alternating red/white pattern (2 red, 2 white)
                    const patternIndex = Math.floor(i / 2) % 4;
                    kerbMaterial = (patternIndex < 2) ? redMaterial : whiteMaterial;
                } else if (zone.type === 'yellow') {
                    kerbMaterial = yellowMaterial;
                } else {
                    kerbMaterial = blueMaterial;
                }

                // Reuse kerb geometry
                let kerbGeometry = kerbGeometryCache.get(KERB_SEGMENT_LENGTH);
                if (!kerbGeometry) {
                    kerbGeometry = new THREE.BoxGeometry(KERB_WIDTH, KERB_HEIGHT, KERB_SEGMENT_LENGTH);
                    kerbGeometryCache.set(KERB_SEGMENT_LENGTH, kerbGeometry);
                }

                const kerb = new THREE.Mesh(kerbGeometry, kerbMaterial);
                kerb.position.copy(kerbPosition);
                kerb.position.y = KERB_HEIGHT / 2;

                // Calculate orientation
                const nextT = Math.min((i + 2) / divisions, 1.0);
                const nextPoint = curve.getPointAt(nextT);
                const direction = new THREE.Vector3().subVectors(nextPoint, point);
                kerb.lookAt(kerb.position.clone().add(direction));

                scene.add(kerb);
                trackData.sceneMeshes.push(kerb);
            });
        }
    });
}

// --- ROAD MARKINGS (F1 STYLE) ---
function generateRoadMarkings(scene) {
    if (!trackData.curve) return;

    const curve = trackData.curve;
    const lineThickness = 0.3;
    const lineHeight = 0.02;

    for (let i = 0; i < divisions; i += 5) {
        const t = i / divisions;
        const next_t = Math.min((i + 5) / divisions, 1.0);

        const p1 = curve.getPointAt(t);
        const p2 = curve.getPointAt(next_t);
        const tangent = curve.getTangentAt(t);
        const normal = new THREE.Vector3(0, 1, 0);
        const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();
        const segmentLength = p1.distanceTo(p2);

        // Edge lines (white continuous)
        [1, -1].forEach(side => {
            const edgeOffset = roadHalfWidth * side;
            const lineP1 = p1.clone().add(binormal.clone().multiplyScalar(edgeOffset));
            const lineP2 = p2.clone().add(binormal.clone().multiplyScalar(edgeOffset));

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

        // Center line (dashed, only on straights)
        if (i % 20 === 0) {
            const centerP1 = p1.clone();
            const centerP2 = p2.clone();

            // Only add center line if it's relatively straight
            const angle = tangent.angleTo(curve.getTangentAt(next_t));
            if (angle < 0.1) { // Threshold for straight sections
                let centerLineGeometry = lineGeometryCache.get(segmentLength * 0.5);
                if (!centerLineGeometry) {
                    centerLineGeometry = new THREE.BoxGeometry(lineThickness, lineHeight, segmentLength * 0.5);
                    lineGeometryCache.set(segmentLength * 0.5, centerLineGeometry);
                }

                const centerLine = new THREE.Mesh(centerLineGeometry, whiteMaterial);
                centerLine.position.copy(centerP1).lerp(centerP2, 0.5);
                centerLine.position.y = lineHeight / 2;
                centerLine.lookAt(centerP2.clone().setY(centerLine.position.y));
                scene.add(centerLine);
                trackData.sceneMeshes.push(centerLine);
            }
        }
    }

    // DRS zone markers
    generateDRSMarkings(scene);
}

// --- DRS ZONE MARKINGS ---
function generateDRSMarkings(scene) {
    if (!trackData.curve) return;

    const curve = trackData.curve;
    const drsWidth = 2.0;
    const drsHeight = 0.05;
    const drsLength = 8.0;

    TRACK_FEATURES.drsZones.forEach(zone => {
        const startT = zone.startT;
        const endT = zone.endT;
        const sideMultiplier = zone.side === 'left' ? 1 : -1;

        for (let t = startT; t < endT; t += 0.05) {
            const point = curve.getPointAt(t);
            const tangent = curve.getTangentAt(t);
            const normal = new THREE.Vector3(0, 1, 0);
            const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

            const drsPosition = point.clone().add(
                binormal.clone().multiplyScalar((roadHalfWidth - drsWidth) * sideMultiplier)
            );

            const drsGeometry = new THREE.BoxGeometry(drsWidth, drsHeight, drsLength);
            const drsMarker = new THREE.Mesh(drsGeometry, blueMaterial);
            drsMarker.position.copy(drsPosition);
            drsMarker.position.y = drsHeight / 2;

            const nextPoint = curve.getPointAt(t + 0.05);
            const direction = new THREE.Vector3().subVectors(nextPoint, point);
            drsMarker.lookAt(drsMarker.position.clone().add(direction));

            scene.add(drsMarker);
            trackData.sceneMeshes.push(drsMarker);
        }
    });
}

// --- START/FINISH LINE (UNCHANGED) ---
function generateStartFinishLine(scene) {
    if (!trackData.curve) return;

    const curve = trackData.curve;
    const checkeredWidth = 1.0;
    const lineLength = roadWidth;
    const numCheckers = Math.ceil(lineLength / checkeredWidth);

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

// --- MAIN TRACK GENERATION FUNCTION ---
export function generateTrackMesh(scene) {
    clearTrack(scene);

    generateRoadMesh(scene);
    generateStartFinishLine(scene);
    generateRoadMarkings(scene);
    generateF1Kerbs(scene);
}