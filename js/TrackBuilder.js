import * as THREE from "three";

// --- IMPROVED DEFAULT MONZA TRACK POINTS WITH ROUNDED CORNERS ---
const DEFAULT_TRACK_POINTS = [
  new THREE.Vector3(108.5, 0, 57.9),
  new THREE.Vector3(102.0, 0, -30.0),  // Intermediate point for smoother turn
  new THREE.Vector3(96.75, 0, -95.45),
  new THREE.Vector3(50.0, 0, -150.0),  // Intermediate point
  new THREE.Vector3(-32.0, 0, -251.65),
  new THREE.Vector3(-100.0, 0, -245.0), // Intermediate point
  new THREE.Vector3(-169.0, 0, -238.65),
  new THREE.Vector3(-173.0, 0, -185.0), // Intermediate point
  new THREE.Vector3(-177.0, 0, -135.65),
  new THREE.Vector3(-140.0, 0, -110.0), // Intermediate point
  new THREE.Vector3(-69.0, 0, -71.65),
  new THREE.Vector3(-150.0, 0, -30.0),  // Intermediate point
  new THREE.Vector3(-230.0, 0, 8.4),
  new THREE.Vector3(-280.0, 0, 75.0),   // Intermediate point
  new THREE.Vector3(-321.0, 0, 143.4),
  new THREE.Vector3(-280.0, 0, 200.0),  // Intermediate point
  new THREE.Vector3(-241.0, 0, 265.4),
  new THREE.Vector3(-190.0, 0, 245.0),  // Intermediate point
  new THREE.Vector3(-141.0, 0, 222.4),
  new THREE.Vector3(-100.0, 0, 245.0),  // Intermediate point
  new THREE.Vector3(-59.0, 0, 271.4),
  new THREE.Vector3(100.0, 0, 280.0),   // Intermediate point
  new THREE.Vector3(263.0, 0, 288.4),
  new THREE.Vector3(300.0, 0, 240.0),   // Intermediate point
  new THREE.Vector3(314.0, 0, 189.4),
  new THREE.Vector3(314.0, 0, 145.0),   // Intermediate point
  new THREE.Vector3(314.0, 0, 102.4),
  new THREE.Vector3(230.0, 0, 140.0),   // Intermediate point
  new THREE.Vector3(143.0, 0, 174.4),
  new THREE.Vector3(125.0, 0, 115.0),   // Intermediate point
  new THREE.Vector3(108.0, 0, 57.9)
];

// --- TRACK CONSTANTS ---
const divisions = 2000;
export const roadWidth = 23.5;
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
 * Smooths sharp corners in track points by adding intermediate points
 * @param {THREE.Vector3[]} points - Original track points
 * @param {number} smoothness - Smoothness factor (0-1)
 * @param {number} maxAngle - Maximum angle threshold for smoothing (degrees)
 * @returns {THREE.Vector3[]} - Smoothed track points
 */
function smoothTrackCorners(points, smoothness = 0.3, maxAngle = 60) {
    if (points.length < 3) return points;
    
    const smoothedPoints = [points[0].clone()];
    const maxAngleRad = THREE.MathUtils.degToRad(maxAngle);
    
    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const current = points[i];
        const next = points[i + 1];
        
        // Calculate vectors between points
        const v1 = new THREE.Vector3().subVectors(current, prev);
        const v2 = new THREE.Vector3().subVectors(next, current);
        
        // Calculate angle between segments
        const angle = v1.angleTo(v2);
        
        // If angle is too sharp, add intermediate points
        if (angle > maxAngleRad) {
            const numIntermediatePoints = Math.ceil(angle / maxAngleRad) * 2;
            
            // Add points before the corner
            for (let j = 1; j <= numIntermediatePoints; j++) {
                const t = j / (numIntermediatePoints + 1);
                const smoothPoint = new THREE.Vector3()
                    .lerpVectors(prev, current, t)
                    .lerp(current, smoothness);
                smoothedPoints.push(smoothPoint);
            }
            
            smoothedPoints.push(current.clone());
            
            // Add points after the corner
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
                //console.log(`Loading custom track '${trackName}' from localStorage.`);
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

    // Apply corner smoothing
    const smoothedPoints = smoothTrackCorners(points, 0.3, 60);
    
    // Update the curve object with better tension for smoother corners
    if (smoothedPoints.length < 3) {
        console.error("Track has insufficient points. Loading default.");
        points = DEFAULT_TRACK_POINTS;
    }
    
    // Use lower tension (0.1) for much smoother corners
    trackData.curve = new THREE.CatmullRomCurve3(smoothedPoints, true, "catmullrom", 0.1);
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
    const normals = [];

    // Use enhanced divisions for smoother curves
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
        
        // Add normals for better lighting
        normals.push(normal.x, normal.y, normal.z);
        normals.push(normal.x, normal.y, normal.z);

        if (i < enhancedDivisions) {
            const base = i * 2;
            indices.push(base, base + 1, base + 2);
            indices.push(base + 1, base + 3, base + 2);
        }
    }

    const roadGeometry = new THREE.BufferGeometry();
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
    const wallThickness = 0.5;
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

        // Generate walls on both sides
        [1, -1].forEach(side => {
            const wallOffset = roadHalfWidth + 1.5;
            const edgeOffset = roadHalfWidth;

            const wallP1 = p1.clone().add(binormal.clone().multiplyScalar(wallOffset * side));
            const wallP2 = p2.clone().add(binormal.clone().multiplyScalar(wallOffset * side));
            const lineP1 = p1.clone().add(binormal.clone().multiplyScalar(edgeOffset * side));
            const lineP2 = p2.clone().add(binormal.clone().multiplyScalar(edgeOffset * side));

            // Wall
            const wallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, segmentLength);
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.castShadow = true;
            wall.receiveShadow = true;
            wall.position.copy(wallP1).lerp(wallP2, 0.5);
            wall.position.y = wallHeight / 2;
            wall.lookAt(wallP2.clone().setY(wall.position.y));
            scene.add(wall);
            trackData.sceneMeshes.push(wall);

            // Edge line
            const edgeLineGeometry = new THREE.BoxGeometry(lineThickness, lineHeight, segmentLength);
            const edgeLine = new THREE.Mesh(edgeLineGeometry, whiteMaterial);
            edgeLine.position.copy(lineP1).lerp(lineP2, 0.5);
            edgeLine.position.y = lineHeight / 2;
            edgeLine.lookAt(lineP2.clone().setY(edgeLine.position.y));
            scene.add(edgeLine);
            trackData.sceneMeshes.push(edgeLine);
        });

        // Generate center dashed line
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

    // Optional: Analyze and log track curvature for debugging
    // const analysis = analyzeTrackCurvature(trackData.curve);
    // console.log('Track Curvature Analysis:', analysis);


export function generateTrackMesh(scene) {
    generateRoadMesh(scene);
    generateStartFinishLine(scene);
    generateMarkingsAndWalls(scene);
}

