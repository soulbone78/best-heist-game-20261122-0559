// The game's rules and state, with no drawing and no browser in it: the thief, the
// guards and cameras, the loot and the exit, the alarm meter, the two tools, lives
// and score. step() advances one fixed step and returns what happened as bit flags,
// so the caller can react (and play sounds) without the world knowing about screens.

import { ALARM, CAMERA, GUARD, LIVES, PLAYER, SCORE, TOOLS } from './config.js';
import { LEVELS, parseLevel } from './levels.js';
import { createCamera, updateCamera } from './cameras.js';
import { createGuard, updateGuard } from './guards.js';

export const EVENT_LOOT = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_LEVEL = 4;
export const EVENT_WIN = 8;
export const EVENT_OVER = 16;
export const EVENT_ALARM = 32;
export const EVENT_SMOKE = 64;
export const EVENT_EMP = 128;
export const EVENT_EXIT_OPEN = 256;

const LOOT_VALUE = { painting: SCORE.painting, gold: SCORE.gold, diamond: SCORE.diamond };

function circleHitsWall(x, y, radius, walls) {
  for (const wall of walls) {
    const nearestX = Math.max(wall.x, Math.min(x, wall.x + wall.width));
    const nearestY = Math.max(wall.y, Math.min(y, wall.y + wall.height));
    if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < radius * radius) return true;
  }
  return false;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: null,
    player: { x: 0, y: 0, angle: -Math.PI / 2, sneaking: false, hidden: false, moving: false, mercy: 0 },
    guards: [],
    cameras: [],
    smokes: [],
    alarm: 0,
    alarmActive: false,
    alarmTimer: 0,
    alarmRaised: false,
    lives: LIVES,
    score: 0,
    lootTaken: 0,
    lootTotal: 0,
    exitOpen: false,
    tools: { smoke: TOOLS.smokePerLevel, emp: TOOLS.empPerLevel },
    empTimer: 0,
    time: 0,
    levelTime: 0,
    ghost: true,
  };

  function loadLevel(index) {
    const level = parseLevel(LEVELS[index]);
    state.levelIndex = index;
    state.level = level;
    state.player.x = level.start.x;
    state.player.y = level.start.y;
    state.player.angle = -Math.PI / 2;
    state.player.mercy = 0;
    state.guards = level.guards.map((guard) => createGuard(guard.route));
    state.cameras = level.cameras.map((camera) => createCamera(camera));
    state.smokes = [];
    state.alarm = 0;
    state.alarmActive = false;
    state.alarmTimer = 0;
    state.alarmRaised = false;
    state.lootTaken = 0;
    state.lootTotal = level.loot.length;
    state.exitOpen = false;
    state.tools = { smoke: TOOLS.smokePerLevel, emp: TOOLS.empPerLevel };
    state.empTimer = 0;
    state.levelTime = 0;
    state.ghost = true;
  }

  function reset() {
    state.score = 0;
    state.lives = LIVES;
    state.time = 0;
    loadLevel(0);
  }

  function respawnAfterCaught() {
    state.player.x = state.level.start.x;
    state.player.y = state.level.start.y;
    state.player.mercy = PLAYER.mercy;
    state.alarm = ALARM.afterCaught;
    state.alarmActive = false;
    state.alarmTimer = 0;
    for (const guard of state.guards) {
      guard.x = guard.route[0].x;
      guard.y = guard.route[0].y;
      guard.waypointIndex = 1 % guard.route.length;
      guard.suspicion = 0;
      guard.mode = 'patrol';
      guard.lastSeen = null;
    }
  }

  /** Drop a smoke cloud at the thief: hidden inside it, no guard or camera can see. */
  function useSmoke() {
    if (state.tools.smoke <= 0) return false;
    state.tools.smoke -= 1;
    state.smokes.push({ x: state.player.x, y: state.player.y, radius: TOOLS.smokeRadius, left: TOOLS.smokeSeconds });
    return true;
  }

  /** Fire the EMP: every camera goes dark for a few seconds. */
  function useEmp() {
    if (state.tools.emp <= 0) return false;
    state.tools.emp -= 1;
    state.empTimer = TOOLS.empSeconds;
    return true;
  }

  /**
   * One fixed step. `move` is {x, y} (each -1, 0 or 1) and `sneaking` slows the
   * thief down but makes them harder to spot. Returns the EVENT_* flags.
   */
  function step(dt, move, sneaking) {
    let events = 0;
    state.time += dt;
    state.levelTime += dt;
    const player = state.player;
    if (player.mercy > 0) player.mercy = Math.max(0, player.mercy - dt);
    if (state.empTimer > 0) state.empTimer = Math.max(0, state.empTimer - dt);

    for (const smoke of state.smokes) smoke.left -= dt;
    state.smokes = state.smokes.filter((smoke) => smoke.left > 0);
    player.hidden = state.smokes.some(
      (smoke) => Math.hypot(player.x - smoke.x, player.y - smoke.y) < smoke.radius,
    );

    const speed = sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    player.sneaking = sneaking;
    const length = Math.hypot(move.x, move.y) || 1;
    const dx = (move.x / length) * speed * dt;
    const dy = (move.y / length) * speed * dt;
    player.moving = move.x !== 0 || move.y !== 0;
    if (player.moving) {
      player.angle = Math.atan2(move.y, move.x);
      const walls = state.level.walls;
      if (!circleHitsWall(player.x + dx, player.y, PLAYER.radius, walls)) player.x += dx;
      if (!circleHitsWall(player.x, player.y + dy, PLAYER.radius, walls)) player.y += dy;
    }

    let anyoneSees = false;
    for (const guard of state.guards) {
      updateGuard(guard, dt, player, state.level.walls, state.alarmActive);
      if (guard.seesPlayer) anyoneSees = true;
      if (guard.suspicion >= GUARD.certainAt) {
        state.alarm = Math.min(100, state.alarm + ALARM.guardRate * dt);
      } else if (guard.suspicion > 0.2) {
        state.alarm = Math.min(100, state.alarm + ALARM.suspicionRate * guard.suspicion * dt);
      }
    }
    for (const camera of state.cameras) {
      updateCamera(camera, dt, player, state.level.walls, state.empTimer > 0);
      if (camera.seesPlayer) {
        anyoneSees = true;
        state.alarm = Math.min(100, state.alarm + CAMERA.alarmRate * dt);
      }
    }
    if (!anyoneSees && !state.alarmActive) {
      state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
    }

    if (!state.alarmActive && state.alarm >= 100) {
      state.alarmActive = true;
      state.alarmTimer = ALARM.duration;
      state.alarmRaised = true;
      state.ghost = false;
      events |= EVENT_ALARM;
    }
    if (state.alarmActive) {
      state.alarmTimer -= dt;
      if (state.alarmTimer <= 0) {
        state.alarmActive = false;
        state.alarm = 55;
      }
    }

    // Loot: walk over it to pocket it. Taking the last piece opens the exit.
    for (const loot of state.level.loot) {
      if (!loot.taken && Math.hypot(player.x - loot.x, player.y - loot.y) < 30) {
        loot.taken = true;
        state.lootTaken += 1;
        state.score += LOOT_VALUE[loot.kind] ?? 0;
        events |= EVENT_LOOT;
        if (state.lootTaken === state.lootTotal) {
          state.exitOpen = true;
          events |= EVENT_EXIT_OPEN;
        }
      }
    }

    // Caught: a guard (or a chasing guard) touches the thief.
    if (player.mercy === 0) {
      for (const guard of state.guards) {
        if (Math.hypot(player.x - guard.x, player.y - guard.y) < PLAYER.catchDistance) {
          state.lives -= 1;
          events |= EVENT_CAUGHT;
          if (state.lives <= 0) {
            events |= EVENT_OVER;
          } else {
            respawnAfterCaught();
          }
          break;
        }
      }
    }

    // The exit: with every loot pocketed, reach the green door to clear the floor.
    if (state.exitOpen && Math.hypot(player.x - state.level.exit.x, player.y - state.level.exit.y) < 32) {
      state.score += SCORE.levelClear;
      if (state.ghost) state.score += SCORE.ghostBonus;
      state.score += Math.max(0, Math.floor((state.level.parSeconds - state.levelTime) * SCORE.timePerSecond));
      if (state.levelIndex + 1 >= LEVELS.length) {
        events |= EVENT_WIN;
      } else {
        events |= EVENT_LEVEL;
        loadLevel(state.levelIndex + 1);
      }
    }
    return events;
  }

  reset();
  return { state, reset, loadLevel, step, useSmoke, useEmp };
}
