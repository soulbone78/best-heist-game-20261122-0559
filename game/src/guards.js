// Guards: patrols, vision cones, suspicion and the chase. A guard walks its route,
// pausing at each waypoint to look around. When it can see the thief its suspicion
// climbs (faster up close, slower while the thief sneaks); past a threshold it leaves
// the patrol to investigate the last place it saw the thief, and while the alarm is up
// it runs the thief down. Nothing here draws or touches the browser.

import { GUARD } from './config.js';

/** Smallest signed angle from `from` to `to`, in (-PI, PI]. */
export function angleDiff(from, to) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff <= -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** True when the segment from (x1, y1) to (x2, y2) crosses any wall rectangle. */
export function segmentBlocked(x1, y1, x2, y2, walls) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (const wall of walls) {
    // Slab test: the segment enters the rectangle when the intervals on both axes
    // overlap the segment's own [0, 1] range.
    let tMin = 0;
    let tMax = 1;
    let blocked = true;
    const axes = [
      [dx, x1, wall.x, wall.x + wall.width],
      [dy, y1, wall.y, wall.y + wall.height],
    ];
    for (const [direction, origin, low, high] of axes) {
      if (direction === 0) {
        if (origin < low || origin > high) {
          blocked = false;
          break;
        }
      } else {
        const enter = (low - origin) / direction;
        const leave = (high - origin) / direction;
        tMin = Math.max(tMin, Math.min(enter, leave));
        tMax = Math.min(tMax, Math.max(enter, leave));
        if (tMin > tMax) {
          blocked = false;
          break;
        }
      }
    }
    if (blocked) return true;
  }
  return false;
}

/** True when nothing stands between (x1, y1) and (x2, y2). */
export function lineOfSight(x1, y1, x2, y2, walls) {
  return !segmentBlocked(x1, y1, x2, y2, walls);
}

/**
 * How far a ray from (x, y) in direction `angle` travels before it hits a wall,
 * capped at `maxDistance`. Steps in 6 px hops: cheap and plenty for a cone edge.
 */
export function rayDistance(x, y, angle, walls, maxDistance) {
  const stepX = Math.cos(angle) * 6;
  const stepY = Math.sin(angle) * 6;
  // Start one hop out: the origin itself may sit on a wall's edge.
  let travelled = 6;
  while (travelled < maxDistance) {
    const px = x + stepX * (travelled / 6);
    const py = y + stepY * (travelled / 6);
    for (const wall of walls) {
      if (px >= wall.x && px <= wall.x + wall.width && py >= wall.y && py <= wall.y + wall.height) {
        return travelled;
      }
    }
    travelled += 6;
  }
  return maxDistance;
}

export function createGuard(route) {
  const first = route[0];
  return {
    x: first.x,
    y: first.y,
    angle: 0,
    route,
    waypointIndex: 1 % route.length,
    wait: 0,
    suspicion: 0,
    mode: 'patrol',
    lastSeen: null,
    searchTimer: 0,
    /** Where the guard looks while it waits at a waypoint. */
    scanAngle: 0,
    scanTime: 0,
    seesPlayer: false,
  };
}

/**
 * Can this guard see the thief right now? In range, inside the cone, a clear line,
 * and the thief not hidden inside a smoke cloud.
 */
export function guardSeesPlayer(guard, player, walls, hidden) {
  if (hidden) return false;
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > GUARD.viewRange) return false;
  if (Math.abs(angleDiff(guard.angle, Math.atan2(dy, dx))) > GUARD.viewHalfAngle) return false;
  return lineOfSight(guard.x, guard.y, player.x, player.y, walls);
}

function turnToward(guard, targetAngle, dt, rate) {
  const diff = angleDiff(guard.angle, targetAngle);
  const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
  guard.angle += step;
}

function moveToward(guard, target, speed, dt) {
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 2) return true;
  const step = Math.min(distance, speed * dt);
  guard.x += (dx / distance) * step;
  guard.y += (dy / distance) * step;
  turnToward(guard, Math.atan2(dy, dx), dt, 6);
  return distance - step < 2;
}

/**
 * One guard's step. `player` carries x, y, sneaking and hidden; `alarmActive`
 * makes every guard run at the thief. Returns nothing; the world reads the guard.
 */
export function updateGuard(guard, dt, player, walls, alarmActive) {
  guard.seesPlayer = guardSeesPlayer(guard, player, walls, player.hidden);
  if (guard.seesPlayer) {
    guard.lastSeen = { x: player.x, y: player.y };
    const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
    let rate = GUARD.suspicionRate;
    if (distance < 90) rate += GUARD.closeBonus;
    if (player.sneaking) rate *= 0.55;
    guard.suspicion = Math.min(1, guard.suspicion + rate * dt);
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionDecay * dt);
  }

  if (alarmActive) {
    guard.mode = 'chase';
  } else if (guard.suspicion >= GUARD.suspiciousAt && guard.mode === 'patrol') {
    guard.mode = 'investigate';
  } else if (guard.mode === 'investigate' && guard.suspicion < 0.15 && guard.lastSeen === null) {
    guard.mode = 'patrol';
  }

  if (guard.mode === 'chase') {
    moveToward(guard, player, GUARD.chaseSpeed, dt);
    return;
  }
  if (guard.mode === 'investigate' && guard.lastSeen) {
    if (moveToward(guard, guard.lastSeen, GUARD.investigateSpeed, dt)) {
      guard.searchTimer += dt;
      guard.scanTime += dt;
      guard.angle = guard.scanAngle + Math.sin(guard.scanTime * 1.8) * 1.1;
      if (guard.searchTimer > GUARD.searchSeconds) {
        guard.searchTimer = 0;
        guard.lastSeen = null;
        guard.mode = 'patrol';
      }
    }
    return;
  }

  // Patrol: walk to the next waypoint, wait there a while, scanning the room.
  if (guard.wait > 0) {
    guard.wait -= dt;
    guard.scanTime += dt;
    guard.angle = guard.scanAngle + Math.sin(guard.scanTime * 1.2) * 0.9;
    return;
  }
  const target = guard.route[guard.waypointIndex];
  if (moveToward(guard, target, GUARD.patrolSpeed, dt)) {
    guard.wait = target.wait || GUARD.waitAtWaypoint;
    guard.scanAngle = guard.angle;
    guard.scanTime = 0;
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.route.length;
  }
}
