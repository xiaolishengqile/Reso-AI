import * as THREE from "three";

const OUTLINE_COLOR = 0x60473f;

export function makeMaterial(color, options = {}) {
  const parameters = {
    color,
    roughness: options.roughness ?? 0.88,
    metalness: 0,
    flatShading: options.flatShading ?? true,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  };
  if (options.side != null) parameters.side = options.side;
  return new THREE.MeshStandardMaterial(parameters);
}

export function createOutlinedMesh(geometry, material, options = {}) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? false;
  group.add(mesh);

  if (options.outline !== false) {
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, options.thresholdAngle ?? 28),
      new THREE.LineBasicMaterial({
        color: options.outlineColor ?? OUTLINE_COLOR,
        transparent: true,
        opacity: options.outlineOpacity ?? 0.72,
      }),
    );
    outline.renderOrder = 2;
    group.add(outline);
  }

  group.userData.mesh = mesh;
  return group;
}

export function createTree({ scale = 1, color = 0x769d65 } = {}) {
  const tree = new THREE.Group();
  const trunk = createOutlinedMesh(
    new THREE.CylinderGeometry(0.13, 0.2, 0.9, 6),
    makeMaterial(0x8f674d),
  );
  trunk.position.y = 0.45;

  const crown = createOutlinedMesh(
    new THREE.DodecahedronGeometry(0.62, 0),
    makeMaterial(color),
  );
  crown.position.y = 1.18;
  crown.rotation.set(0.1, 0.35, -0.08);
  tree.add(trunk, crown);
  tree.scale.setScalar(scale);
  return tree;
}

export function createMountain({
  scale = 1,
  color = 0xb8816f,
  snow = true,
} = {}) {
  const mountain = new THREE.Group();
  const rock = createOutlinedMesh(
    new THREE.ConeGeometry(1.55, 3.9, 7),
    makeMaterial(color),
  );
  rock.position.y = 1.95;
  rock.rotation.y = 0.18;
  mountain.add(rock);

  if (snow) {
    const cap = createOutlinedMesh(
      new THREE.ConeGeometry(0.64, 1.15, 7),
      makeMaterial(0xf4eddc),
      { castShadow: false, outlineOpacity: 0.45 },
    );
    cap.position.y = 3.34;
    cap.rotation.y = 0.18;
    mountain.add(cap);
  }

  mountain.scale.setScalar(scale);
  return mountain;
}

export function createRock({ scale = 1, color = 0x9e7f6d } = {}) {
  const rock = createOutlinedMesh(
    new THREE.DodecahedronGeometry(0.48, 0),
    makeMaterial(color),
  );
  rock.scale.set(scale, scale * 0.72, scale * 0.84);
  rock.position.y = scale * 0.32;
  return rock;
}

export function createCloud({ scale = 1 } = {}) {
  const cloud = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0xfffbef,
    transparent: true,
    opacity: 0.87,
    depthWrite: false,
  });

  [
    [-0.82, 0, 0.62],
    [-0.24, 0.22, 0.85],
    [0.48, 0.1, 0.72],
    [0.92, -0.05, 0.5],
  ].forEach(([x, y, size]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 7), material);
    puff.scale.z = 0.62;
    puff.position.set(x, y, 0);
    cloud.add(puff);
  });

  cloud.scale.setScalar(scale);
  return cloud;
}

export function createFloatingIsland({
  width = 5,
  depth = 4,
  height = 4,
  color = 0x91b879,
} = {}) {
  const island = new THREE.Group();
  const top = createOutlinedMesh(
    new THREE.CylinderGeometry(width * 0.5, width * 0.46, height * 0.24, 10),
    makeMaterial(color),
    { receiveShadow: true },
  );
  top.scale.z = depth / width;

  const underside = createOutlinedMesh(
    new THREE.ConeGeometry(width * 0.45, height, 10),
    makeMaterial(0x856151),
  );
  underside.scale.z = depth / width;
  underside.position.y = -height * 0.55;
  island.add(top, underside);
  return island;
}

export function createLocationRing(color) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.075, 6, 48),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.14, 40),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.065;
  group.add(ring, halo);
  group.userData.ring = ring;
  group.userData.halo = halo;
  return group;
}
