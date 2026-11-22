// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints
// what is there. The game moves between six screens: title, play, paused, floor
// clear, game over and the clean getaway. Sounds fire on the world's events.
//
// ?seed=N fixes the random seed. ?shot=start|play|alarm|escape (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_ALARM,
  EVENT_CAUGHT,
  EVENT_EMP,
  EVENT_EXIT_OPEN,
  EVENT_LEVEL,
  EVENT_LOOT,
  EVENT_OVER,
  EVENT_SMOKE,
  EVENT_WIN,
  createWorld,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_EMP,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_SMOKE,
  createInput,
} from './input.js';
import { createSound } from './sound.js';
import {
  SCREEN_CLEAR,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;
/** Seconds the floor-clear screen shows before the next floor starts. */
const CLEAR_SECONDS = 2.2;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let clearTimer = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    sound.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Grab every loot, then reach the exit.');
  }

  function endGame(won) {
    sound.stopSiren();
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `Clean getaway. Score ${world.state.score}.` : `Caught. Score ${world.state.score}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_LOOT) {
      const lastLoot = world.state.level.loot.filter((loot) => loot.taken).pop();
      sound.loot(lastLoot ? lastLoot.kind : 'painting');
    }
    if (events & EVENT_EXIT_OPEN) {
      sound.exitOpen();
      announce('Exit open. Get out!');
    }
    if (events & EVENT_ALARM) {
      sound.alarmStart();
      announce('Alarm! Guards are coming for you.');
    }
    if (events & EVENT_CAUGHT) {
      sound.caught();
      sound.stopSiren();
    }
    if (events & EVENT_SMOKE) sound.smoke();
    if (events & EVENT_EMP) sound.emp();
    if (events & EVENT_LEVEL) {
      sound.levelClear();
      sound.stopSiren();
      screen = SCREEN_CLEAR;
      clearTimer = CLEAR_SECONDS;
      announce(`Floor cleared. Next: ${world.state.level.name}.`);
    }
    if (events & EVENT_WIN) {
      sound.win();
      endGame(true);
    } else if (events & EVENT_OVER) {
      endGame(false);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = sound.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        sound.click();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_CLEAR) return;
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_SMOKE) {
      if (world.useSmoke()) handleEvents(EVENT_SMOKE);
    }
    if (actions & ACTION_EMP) {
      if (world.useEmp()) handleEvents(EVENT_EMP);
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false);
      return;
    }
    if (screen === SCREEN_CLEAR) {
      clearTimer -= STEP;
      if (clearTimer <= 0) screen = SCREEN_PLAY;
      return;
    }
    const move = input.move();
    const events = world.step(STEP, move, move.sneaking);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_CLEAR) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_CLEAR)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, now / 1000);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Gilded Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
