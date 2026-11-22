// Security cameras: wall-mounted, sweeping a cone back and forth. A camera that
// watches the thief fills the alarm meter fast, and flashes red while it does.
// An EMP (the thief's tool) knocks every camera out for a few seconds.

import { CAMERA } from './config.js';
import { angleDiff, lineOfSight } from './guards.js';

export function createCamera(definition) {
  return {
    x: definition.x,
    y: definition.y,
    baseAngle: definition.baseAngle,
    angle: definition.baseAngle,
    sweepTime: ((definition.x + definition.y) % 60) / 10,
    disabled: false,
    seesPlayer: false,
  };
}

/** A camera's cone right now, sweeping around its base angle. */
export function updateCamera(camera, dt, player, walls, empActive) {
  camera.disabled = empActive;
  camera.sweepTime += dt;
  camera.angle = camera.baseAngle + Math.sin(camera.sweepTime * CAMERA.sweepSpeed) * CAMERA.sweepArc;
  if (camera.disabled || player.hidden) {
    camera.seesPlayer = false;
    return;
  }
  const dx = player.x - camera.x;
  const dy = player.y - camera.y;
  const distance = Math.hypot(dx, dy);
  camera.seesPlayer =
    distance < CAMERA.range &&
    Math.abs(angleDiff(camera.angle, Math.atan2(dy, dx))) < CAMERA.halfAngle &&
    lineOfSight(camera.x, camera.y, player.x, player.y, walls);
}
