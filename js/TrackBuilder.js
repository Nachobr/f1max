import * as THREE from "three";

// --- DEFAULT MONZA TRACK POINTS ---
const DEFAULT_TRACK_POINTS = [
  new THREE.Vector3(217.0, 0, 115.8),
  new THREE.Vector3(193.5, 0, -190.9),
  new THREE.Vector3(-64.0, 0, -503.3),
  new THREE.Vector3(-338.0, 0, -477.3),
  new THREE.Vector3(-354.0, 0, -271.3),
  new THREE.Vector3(-138.0, 0, -143.3),
  new THREE.Vector3(-460.0, 0, 16.8),
  new THREE.Vector3(-642.0, 0, 286.8),
  new THREE.Vector3(-482.0, 0, 530.8),
  new THREE.Vector3(-282.0, 0, 444.8),
  new THREE.Vector3(-118.0, 0, 542.8),
  new THREE.Vector3(526.0, 0, 576.8),
  new THREE.Vector3(628.0, 0, 378.8),
  new THREE.Vector3(628.0, 0, 204.8),
  new THREE.Vector3(286.0, 0, 348.8),
  new THREE.Vector3(216.0, 0, 115.8)
];

// --- TRACK CONSTANTS ---
const divisions = 1200;
export const roadWidth = 35;
export const roadHalfWidth = roadWidth / 2;

// --- TRACK DATA STATE ---
export const trackData = {
    curve: new THREE.CatmullRomCurve3(DEFAULT_TRACK_POINTS, true, "catmullrom", 0.05),
    divisions: divisions,
    sceneMeshes: [] // Store references to all track meshes for clearing
};

// --- MATERIALS ---
const roadMaterial = new THREE.MeshPhongMaterial({ color: 0x333333, side: THREE.DoubleSide });
const whiteMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
const blackMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
const wallMaterial = new THREE.MeshPhongMaterial({ color: 0xaa2222 });


/**
 * Loads track points from localStorage or default and updates trackData.curve.
 * @param {string} trackName - Name of the track to load.
 */
export function loadTrackDefinition(trackName) {
    let points;

    // ✅ FIX: Treat 'Track1' (from server/Config) and 'Monza Standard' as the default track.
    if (trackName === 'Monza Standard' || trackName === 'Track1') {
        points = DEFAULT_TRACK_POINTS;
    } else {
        try {
            const data = localStorage.getItem(`trackData_${trackName}`);
            if (data) {
                console.log(`Loading custom track '${trackName}' from localStorage.`);
                const rawPoints = JSON.parse(data);
                points = rawPoints.map(p => new THREE.Vector3(parseFloat(p.x), 0, parseFloat(p.z)));
            } else {
                // A better fallback for other unknown tracks (like 'Track2')
                console.warn(`Track '${trackName}' not found. Loading default track instead.`);
                points = DEFAULT_TRACK_POINTS;
            }
        } catch (e) {
            console.error("Error loading track from localStorage:", e);
            points = DEFAULT_TRACK_POINTS;
        }
    }

    // Update the curve object
    if (points.length < 3) {
        console.error("Track has insufficient points. Loading default.");
        points = DEFAULT_TRACK_POINTS;
    }
    trackData.curve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.05);
}

/**
 * Clears all previously generated track meshes from the scene.
 * @param {THREE.Scene} scene - The main scene object.
 */
export function clearTrack(scene) {
    trackData.sceneMeshes.forEach(mesh => {
        scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
    });
    trackData.sceneMeshes = [];
}

function generateRoadMesh(scene) {
    const curve = trackData.curve;
    const positions = [];
    const indices = [];

    for (let i = 0; i <= divisions; i++) {
        const t = i / divisions;
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        const normal = new THREE.Vector3(0, 1, 0);
        const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

        const left = point.clone().add(binormal.clone().multiplyScalar(roadHalfWidth));
        const right = point.clone().add(binormal.clone().multiplyScalar(-roadHalfWidth));

        positions.push(left.x, left.y, left.z);
        positions.push(right.x, right.y, right.z);

        if (i < divisions) {
            const base = i * 2;
            indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        }
    }

    const roadGeometry = new THREE.BufferGeometry();
    roadGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    roadGeometry.setIndex(indices);
    roadGeometry.computeVertexNormals();

    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.receiveShadow = true;
    scene.add(road);
    trackData.sceneMeshes.push(road);
}

function generateStartFinishLine(scene) {
    const curve = trackData.curve;
    const checkeredWidth = 1.0;
    const lineLength = roadWidth;
    const lineHeight = 0.01;
    const numCheckers = Math.ceil(lineLength / checkeredWidth);
    
    const t = 0; 
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const normal = new THREE.Vector3(0, 1, 0);
    const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    const baseGeometry = new THREE.BoxGeometry(checkeredWidth, lineHeight, checkeredWidth);
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
        checkerBlock.position.y = lineHeight / 2;
        checkerBlock.lookAt(point.clone().add(tangent));

        scene.add(checkerBlock);
        trackData.sceneMeshes.push(checkerBlock);
    }
}

function generateMarkingsAndWalls(scene) {
    const curve = trackData.curve;
    const wallHeight = 2;
    const wallThickness = 0.2;
    const lineThickness = 0.2;
    const lineHeight = 0.01;
    const dashedSegmentLength = 3;
    const dashedGapLength = 3;

    generateStartFinishLine(scene); 

    for (let i = 0; i < divisions; i++) {
        const t = i / divisions;
        const next_t = (i + 1) / divisions;

        const p1 = curve.getPointAt(t);
        const p2 = curve.getPointAt(next_t);

        const tangent = curve.getTangentAt(t);
        const normal = new THREE.Vector3(0, 1, 0);
        const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();
        const segmentLength = p1.distanceTo(p2);

        [1, -1].forEach(side => {
            const wallOffset = roadHalfWidth + 1.5;
            const edgeOffset = roadHalfWidth;

            const wallP1 = p1.clone().add(binormal.clone().multiplyScalar(wallOffset * side));
            const wallP2 = p2.clone().add(binormal.clone().multiplyScalar(wallOffset * side));
            const lineP1 = p1.clone().add(binormal.clone().multiplyScalar(edgeOffset * side));
            const lineP2 = p2.clone().add(binormal.clone().multiplyScalar(edgeOffset * side));

            const wallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, segmentLength);
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.castShadow = true;
            wall.receiveShadow = true;
            wall.position.copy(wallP1).lerp(wallP2, 0.5);
            wall.position.y = wallHeight / 2;
            wall.lookAt(wallP2.clone().setY(wall.position.y));
            scene.add(wall);
            trackData.sceneMeshes.push(wall);

            const edgeLineGeometry = new THREE.BoxGeometry(lineThickness, lineHeight, segmentLength);
            const edgeLine = new THREE.Mesh(edgeLineGeometry, whiteMaterial);
            edgeLine.position.copy(lineP1).lerp(lineP2, 0.5);
            edgeLine.position.y = lineHeight / 2;
            edgeLine.lookAt(lineP2.clone().setY(edgeLine.position.y));
            scene.add(edgeLine);
            trackData.sceneMeshes.push(edgeLine);
        });

        let totalLength = segmentLength;
        let currentOffset = 0;
        const centerLineGeometry = new THREE.BoxGeometry(lineThickness, lineHeight, dashedSegmentLength);
        const lineRotation = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            tangent.clone().setY(0).normalize()
        );

        while (currentOffset < totalLength) {
            const lineFraction = currentOffset / totalLength;
            const centerPoint = p1.clone().lerp(p2, lineFraction);
            const dottedLine = new THREE.Mesh(centerLineGeometry, whiteMaterial);
            dottedLine.position.copy(centerPoint);
            dottedLine.position.y = lineHeight / 2;
            dottedLine.setRotationFromQuaternion(lineRotation);
            scene.add(dottedLine);
            trackData.sceneMeshes.push(dottedLine);
            currentOffset += dashedSegmentLength + dashedGapLength;
        }
    }
}

/**
 * Generates all track components and adds them to the scene.
 * @param {THREE.Scene} scene - The main scene object.
 */
export function generateTrackMesh(scene) {
    generateRoadMesh(scene);
    generateMarkingsAndWalls(scene);
}