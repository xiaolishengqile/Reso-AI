const DIRECTIONS = Object.freeze({
  KeyW: Object.freeze([0, -1]),
  ArrowUp: Object.freeze([0, -1]),
  KeyS: Object.freeze([0, 1]),
  ArrowDown: Object.freeze([0, 1]),
  KeyA: Object.freeze([-1, 0]),
  ArrowLeft: Object.freeze([-1, 0]),
  KeyD: Object.freeze([1, 0]),
  ArrowRight: Object.freeze([1, 0]),
});

export function createInput(target = window) {
  const pressed = new Set();

  function onKeyDown(event) {
    if (!DIRECTIONS[event.code]) return;
    event.preventDefault?.();
    pressed.add(event.code);
  }

  function onKeyUp(event) {
    pressed.delete(event.code);
  }

  function reset() {
    pressed.clear();
  }

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", reset);

  return Object.freeze({
    getDirection() {
      let x = 0;
      let z = 0;
      for (const code of pressed) {
        x += DIRECTIONS[code][0];
        z += DIRECTIONS[code][1];
      }
      return { x: Math.sign(x), z: Math.sign(z) };
    },
    dispose() {
      reset();
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", reset);
    },
  });
}
