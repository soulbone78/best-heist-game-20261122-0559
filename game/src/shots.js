// The screenshot scenes behind ?shot=start|play|alarm|escape. The start scene lets
// the guards patrol under the title; play steers the thief with a waypoint autopilot
// that sneaks when a guard is close and backs off from a rising cone, so the frame is
// what a real game looks like and the same seed always gives the same frame. The
// alarm and escape scenes are staged (see stageAlarm and stageEscape): the alarm one
// mid-chase with the meter nearly full, the escape one with every loot pocketed and
// the exit open — both states a real run reaches.

import { STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 16;
/** Waypoints the play autopilot follows, around the planters to the first loot. */
const PLAY_PATH = [
  [140, 620],
  [260, 620],
  [260, 100],
  [140, 100],
  [260, 100],
  [260, 300],
  [500, 300],
];

/** Steer toward `target`, or away from a guard that is watching the thief. */
function autopilot(world, target) {
  const player = world.state.player;
  let mx = target.x - player.x;
  let my = target.y - player.y;
  let sneaking = false;
  for (const guard of world.state.guards) {
    const distance = Math.hypot(guard.x - player.x, guard.y - player.y);
    if (distance < 200 && guard.suspicion > 0.15) sneaking = true;
    if (distance < 170 && guard.seesPlayer) {
      mx += (player.x - guard.x) * 2.5;
      my += (player.y - guard.y) * 2.5;
    }
  }
  const length = Math.hypot(mx, my) || 1;
  return { move: { x: mx / length, y: my / length }, sneaking };
}

function runAutopilot(world, seconds, path) {
  let waypoint = 0;
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const target = path[Math.min(waypoint, path.length - 1)];
    const player = world.state.player;
    if (Math.hypot(target.x - player.x, target.y - player.y) < 24 && waypoint < path.length - 1) {
      waypoint += 1;
    }
    const steering = autopilot(world, path[Math.min(waypoint, path.length - 1)]);
    if (world.step(STEP, steering.move, steering.sneaking) & (EVENT_OVER | EVENT_WIN)) break;
  }
}

/** The alarm scene, staged: the meter nearly full, a guard running the thief down. */
function stageAlarm(world) {
  world.loadLevel(1);
  const state = world.state;
  state.player.x = 640;
  state.player.y = 360;
  state.alarm = 88;
  state.alarmActive = true;
  state.alarmTimer = 7;
  state.alarmRaised = true;
  state.ghost = false;
  state.score = 150;
  state.level.loot[0].taken = true;
  state.lootTaken = 1;
  const chaser = state.guards[0];
  chaser.x = 500;
  chaser.y = 360;
  chaser.angle = 0;
  chaser.suspicion = 1;
  chaser.mode = 'chase';
  chaser.lastSeen = { x: 640, y: 360 };
  const watcher = state.guards[1];
  watcher.x = 820;
  watcher.y = 300;
  watcher.angle = Math.atan2(60, -180);
  watcher.suspicion = 0.72;
  watcher.mode = 'investigate';
  watcher.lastSeen = { x: 640, y: 360 };
  const camera = state.cameras[0];
  camera.angle = Math.atan2(state.player.y - camera.y, state.player.x - camera.x);
  camera.seesPlayer = true;
  return { screen: SCREEN_PLAY, best: 0 };
}

/** The escape scene, staged: every loot pocketed, the exit open, the thief one step out. */
function stageEscape(world) {
  world.loadLevel(2);
  const state = world.state;
  for (const loot of state.level.loot) loot.taken = true;
  state.lootTaken = state.lootTotal;
  state.exitOpen = true;
  state.score = 1450;
  state.alarm = 12;
  state.player.x = 1060;
  state.player.y = 620;
  state.player.angle = 0;
  const guard = state.guards[0];
  guard.x = 480;
  guard.y = 100;
  guard.angle = Math.PI / 2;
  guard.suspicion = 0.3;
  const guard2 = state.guards[3];
  guard2.x = 980;
  guard2.y = 580;
  guard2.angle = Math.PI;
  guard2.suspicion = 0.1;
  return { screen: SCREEN_PLAY, best: 1450 };
}

/**
 * Set `world` to the named scene (start, play, alarm or escape; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    runAutopilot(world, PLAY_SECONDS, PLAY_PATH.map(([x, y]) => ({ x, y })));
    if (world.state.alarm < 25) world.state.alarm = 32;
    // Aim the camera at the thief so its sweep is part of the frame.
    const camera = world.state.cameras[0];
    const player = world.state.player;
    camera.angle = Math.atan2(player.y - camera.y, player.x - camera.x);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'alarm') return stageAlarm(world);
  if (name === 'escape') return stageEscape(world);
  for (let index = 0; index < START_SECONDS / STEP; index += 1) {
    world.step(STEP, { x: 0, y: 0 }, false);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
