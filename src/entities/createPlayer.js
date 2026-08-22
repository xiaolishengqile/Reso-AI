import * as THREE from "three";
import { createOutlinedMesh, makeMaterial } from "../world/primitives.js";

function createPart(geometry, material, position) {
  const part = createOutlinedMesh(geometry, material, {
    outlineOpacity: 0.66,
  });
  part.position.set(...position);
  return part;
}

export function createPlayer() {
  const group = new THREE.Group();
  const visual = new THREE.Group();
  group.add(visual);

  const skin = makeMaterial(0xf0b38b);
  const coat = makeMaterial(0x4f7f8f);
  const coatDark = makeMaterial(0x365d6a);
  const scarf = makeMaterial(0xe58d67);
  const boots = makeMaterial(0x65483e);

  const body = createPart(new THREE.BoxGeometry(0.72, 0.86, 0.48), coat, [0, 1.12, 0]);
  const head = createPart(new THREE.DodecahedronGeometry(0.38, 0), skin, [0, 1.83, 0]);
  head.scale.set(1, 1.08, 0.92);
  const hair = createPart(
    new THREE.SphereGeometry(0.39, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55),
    coatDark,
    [0, 1.96, -0.03],
  );
  const scarfTail = createPart(new THREE.BoxGeometry(0.2, 0.58, 0.12), scarf, [0.3, 1.15, -0.28]);
  scarfTail.rotation.z = -0.28;

  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  leftArm.position.set(-0.48, 1.42, 0);
  rightArm.position.set(0.48, 1.42, 0);
  leftArm.add(createPart(new THREE.BoxGeometry(0.22, 0.7, 0.24), coat, [0, -0.31, 0]));
  rightArm.add(createPart(new THREE.BoxGeometry(0.22, 0.7, 0.24), coat, [0, -0.31, 0]));

  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  leftLeg.position.set(-0.2, 0.73, 0);
  rightLeg.position.set(0.2, 0.73, 0);
  leftLeg.add(createPart(new THREE.BoxGeometry(0.25, 0.72, 0.28), boots, [0, -0.34, 0]));
  rightLeg.add(createPart(new THREE.BoxGeometry(0.25, 0.72, 0.28), boots, [0, -0.34, 0]));
  visual.add(body, head, hair, scarfTail, leftArm, rightArm, leftLeg, rightLeg);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 20),
    new THREE.MeshBasicMaterial({
      color: 0x4a372f,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  group.add(shadow);

  group.userData.leftLeg = leftLeg;
  group.userData.rightLeg = rightLeg;
  group.userData.leftArm = leftArm;
  group.userData.rightArm = rightArm;
  group.userData.walkTime = 0;

  function update(deltaSeconds, direction) {
    const moving = Math.hypot(direction.x, direction.z) > 0.01;
    if (moving) {
      group.rotation.y = Math.atan2(direction.x, direction.z);
      group.userData.walkTime += deltaSeconds;
    }
    const swing = moving ? Math.sin(group.userData.walkTime * 12) * 0.52 : 0;
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;
    leftArm.rotation.x = -swing * 0.72;
    rightArm.rotation.x = swing * 0.72;
    visual.position.y = moving ? Math.abs(Math.sin(group.userData.walkTime * 12)) * 0.055 : 0;
  }

  return Object.freeze({ group, update });
}
