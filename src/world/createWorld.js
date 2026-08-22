import * as THREE from "three";
import { LOCATIONS } from "../config/world.js";
import {
  createCloud,
  createFloatingIsland,
  createLocationRing,
  createMountain,
  createOutlinedMesh,
  createRock,
  createTree,
  makeMaterial,
} from "./primitives.js";

function setPosition(object, x, y, z) {
  object.position.set(x, y, z);
  return object;
}

function createMainland() {
  const shape = new THREE.Shape();
  shape.moveTo(-20, -10);
  shape.lineTo(-15, -13);
  shape.lineTo(-5, -14);
  shape.lineTo(5, -13.5);
  shape.lineTo(15, -12);
  shape.lineTo(20, -7);
  shape.lineTo(21, 2);
  shape.lineTo(18, 11);
  shape.lineTo(10, 14);
  shape.lineTo(0, 13.5);
  shape.lineTo(-10, 14);
  shape.lineTo(-18, 10);
  shape.lineTo(-21, 3);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 2.5,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.45,
    bevelThickness: 0.28,
  });
  geometry.rotateX(Math.PI / 2);

  const land = createOutlinedMesh(
    geometry,
    [makeMaterial(0x9fc27f), makeMaterial(0x795548)],
    { receiveShadow: true, thresholdAngle: 18 },
  );
  land.position.y = -0.12;
  land.userData.mesh.receiveShadow = true;
  return land;
}

function createRibbon(points, radius, color, y = 0.06) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, y, z)),
  );
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, radius, 6, false),
    makeMaterial(color, { roughness: 0.96 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

function createBridge() {
  const bridge = new THREE.Group();
  const wood = makeMaterial(0xb6865e);
  const darkWood = makeMaterial(0x775341);
  for (let index = -3; index <= 3; index += 1) {
    const plank = createOutlinedMesh(
      new THREE.BoxGeometry(0.48, 0.14, 2.35),
      wood,
      { outlineOpacity: 0.45 },
    );
    plank.position.set(index * 0.48, 0.2 + Math.cos(index * 0.5) * 0.06, 0);
    bridge.add(plank);
  }
  [-1.24, 1.24].forEach((z) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.12, 0.12), darkWood);
    rail.position.set(0, 0.72, z);
    bridge.add(rail);
    for (let index = -3; index <= 3; index += 2) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), darkWood);
      post.position.set(index * 0.48, 0.42, z);
      bridge.add(post);
    }
  });
  bridge.rotation.y = -0.12;
  return bridge;
}

function addMountainLocation(root) {
  const back = createMountain({ scale: 1.5, color: 0xa7786b });
  back.position.set(-0.4, 0, 0.35);
  const left = createMountain({ scale: 1.05, color: 0xc18c76, snow: false });
  left.position.set(-1.6, 0, 1.1);
  const right = createMountain({ scale: 0.88, color: 0x8f786d });
  right.position.set(1.25, 0, 0.8);
  const shrine = createOutlinedMesh(
    new THREE.CylinderGeometry(0.45, 0.58, 0.28, 8),
    makeMaterial(0xe6d4ae),
  );
  shrine.position.set(1.45, 0.16, -1.15);
  root.add(back, left, right, shrine);
}

function addForestLocation(root) {
  const treeLayout = [
    [-1.2, 0.7, 1.1, 0x648b61],
    [-0.35, -0.6, 1.35, 0x719d6c],
    [0.65, 0.5, 1.05, 0x83aa70],
    [1.25, -0.7, 0.92, 0x5f865b],
    [0.1, 1.25, 0.86, 0x91b978],
  ];
  treeLayout.forEach(([x, z, scale, color]) => {
    root.add(setPosition(createTree({ scale, color }), x, 0, z));
  });

  const tower = createOutlinedMesh(
    new THREE.CylinderGeometry(0.6, 0.76, 1.8, 7),
    makeMaterial(0xa77452),
  );
  tower.position.set(0.1, 0.9, 0.15);
  const roof = createOutlinedMesh(
    new THREE.ConeGeometry(1.05, 0.75, 7),
    makeMaterial(0xd19a72),
  );
  roof.position.set(0.1, 2.15, 0.15);
  root.add(tower, roof);
}

function addRuinsLocation(root) {
  const stone = makeMaterial(0xc8b49b);
  [-1.05, 1.05].forEach((x) => {
    const pillar = createOutlinedMesh(
      new THREE.CylinderGeometry(0.25, 0.34, 2.2, 7),
      stone,
    );
    pillar.position.set(x, 1.1, 0);
    root.add(pillar);
  });
  const lintel = createOutlinedMesh(
    new THREE.BoxGeometry(2.7, 0.38, 0.5),
    stone,
  );
  lintel.position.y = 2.22;
  lintel.rotation.z = -0.06;
  root.add(lintel);

  const crystal = createOutlinedMesh(
    new THREE.OctahedronGeometry(0.55, 0),
    makeMaterial(0x8bb8bc, { roughness: 0.45 }),
  );
  crystal.position.set(0, 0.72, -0.6);
  crystal.rotation.z = 0.12;
  root.add(crystal);
}

function createLocation(location) {
  const root = new THREE.Group();
  root.position.set(location.x, 0.05, location.z);
  root.userData.locationId = location.id;
  root.userData.location = location;

  const ring = createLocationRing(location.color);
  ring.scale.setScalar(1.55);
  ring.userData.baseScale = 1.55;
  root.add(ring);
  root.userData.ring = ring;

  if (location.id === "cloud-ridge") addMountainLocation(root);
  if (location.id === "whispering-woods") addForestLocation(root);
  if (location.id === "starfall-ruins") addRuinsLocation(root);
  return root;
}

function addAmbientDetails(scene) {
  const treeLayout = [
    [-15, 7, 1.1, 0x80a96f], [-13, 9, 0.78, 0x6f9665],
    [-6, 9, 0.9, 0x8eb47c], [-4, 7, 0.65, 0x739b66],
    [4, 9, 0.88, 0x86ad70], [14, 8, 0.78, 0x6f9762],
    [-15, -8, 0.72, 0x7da36a], [-5, -10, 0.82, 0x91b77b],
    [3, -9, 0.68, 0x719860], [16, -1, 0.9, 0x83aa70],
  ];
  treeLayout.forEach(([x, z, scale, color]) => {
    scene.add(setPosition(createTree({ scale, color }), x, 0, z));
  });

  [
    [-16, 2, 0.8], [-7, -8, 0.72], [4, 4, 0.6],
    [14, 10, 0.75], [16, -9, 0.64], [0, 11, 0.52],
  ].forEach(([x, z, scale]) => {
    scene.add(setPosition(createRock({ scale }), x, 0, z));
  });
}

function addFloatingBackground(scene) {
  [
    [-27, 1, -2, 7, 5, 4],
    [25, 7, -5, 6, 4, 3.4],
    [26, -5, -1, 4.5, 3.4, 3],
    [-25, -8, -4, 5, 3.4, 3.6],
  ].forEach(([x, z, y, width, depth, height], index) => {
    const island = createFloatingIsland({
      width,
      depth,
      height,
      color: index % 2 === 0 ? 0x91b879 : 0xc8b77f,
    });
    island.position.set(x, y, z);
    scene.add(island);
  });
}

function addLights(scene) {
  const hemisphere = new THREE.HemisphereLight(0xeafcff, 0x765949, 2.4);
  const sun = new THREE.DirectionalLight(0xfff1d2, 3.1);
  sun.position.set(-12, 24, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(hemisphere, sun);
}

export function createWorld(scene, { locations = LOCATIONS } = {}) {
  const animatedObjects = [];
  const locationTargets = [];
  scene.fog = new THREE.Fog(0xb9dfeb, 42, 78);
  addLights(scene);
  scene.add(createMainland());

  const river = createRibbon(
    [[-17, 6], [-10, 4], [-4, 2], [1, -1], [7, -3], [18, -1]],
    0.72,
    0x76bfd1,
    -0.18,
  );
  scene.add(river);

  const road = createRibbon(
    [[-14, 0], [-7, 3], [0, 6], [7, 3], [13, -3]],
    0.42,
    0xe7d6a8,
    0.03,
  );
  scene.add(road);

  const lake = createOutlinedMesh(
    new THREE.CircleGeometry(2.25, 28),
    makeMaterial(0x7fc5d4, { roughness: 0.35 }),
    { castShadow: false, outlineOpacity: 0.48 },
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(-2, 0.015, -2);
  scene.add(lake);

  const bridge = createBridge();
  bridge.position.set(4.4, 0.05, -2.2);
  scene.add(bridge);

  locations.forEach((location, index) => {
    if (!location?.id || !Number.isFinite(location.x) || !Number.isFinite(location.z)) return;
    const target = createLocation(location);
    locationTargets.push(target);
    scene.add(target);
    animatedObjects.push({
      type: "location",
      object: target.userData.ring,
      phase: index * 1.7,
    });
  });

  addAmbientDetails(scene);
  addFloatingBackground(scene);

  [
    [-18, 8, 9, 1.7, 0.42],
    [3, -5, 11, 1.3, -0.28],
    [19, 9, 8, 1.8, -0.36],
    [-8, -12, 7, 1.05, 0.31],
  ].forEach(([x, z, y, scale, speed], index) => {
    const cloud = createCloud({ scale });
    cloud.position.set(x, y, z);
    scene.add(cloud);
    animatedObjects.push({
      type: "cloud",
      object: cloud,
      originX: x,
      speed,
      phase: index * 1.9,
    });
  });

  return Object.freeze({ locationTargets, animatedObjects });
}
