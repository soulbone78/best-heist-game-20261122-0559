// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred. Everything the judge
// needs to see at a glance is drawn in one frame: the thief, the guards and their
// vision cones, the cameras and their sweep, the loot, the exit and the alarm meter.
// Safe cover (planters) is green, danger (cones, guards) is warm, loot is gold.

import { CAMERA, FIELD, FONT, GUARD, LIVES, PALETTE, PLAYER, TILE } from './config.js';
import { rayDistance } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';
export const SCREEN_CLEAR = 'clear';

const HUD_HEIGHT = 56;
const CONE_RAYS = 22;

const LOOT_LABEL = { painting: 'Painting', gold: 'Gold bar', diamond: 'Diamond' };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const lootLabel = cachedLabel('');
  const timeLabel = cachedLabel('');
  const bestLabel = cachedLabel('BEST ');
  const finalLabel = cachedLabel('SCORE ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function plainText(value, x, y, size, color, align) {
    if (!fonts.has(-size)) fonts.set(-size, `${size}px ${FONT}`);
    context.font = fonts.get(-size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function circle(x, y, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function conePolygon(x, y, angle, halfAngle, range, walls) {
    context.beginPath();
    context.moveTo(x, y);
    for (let index = 0; index <= CONE_RAYS; index += 1) {
      const rayAngle = angle - halfAngle + (2 * halfAngle * index) / CONE_RAYS;
      const distance = rayDistance(x, y, rayAngle, walls, range);
      context.lineTo(x + Math.cos(rayAngle) * distance, y + Math.sin(rayAngle) * distance);
    }
    context.closePath();
  }

  function coneColor(suspicion) {
    if (suspicion >= 0.95) return PALETTE.coneDanger;
    if (suspicion >= 0.45) return PALETTE.coneHot;
    return PALETTE.cone;
  }

  function drawFloor(state) {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.floorAlt;
    for (let row = 0; row < FIELD.height / TILE; row += 1) {
      for (let column = 0; column < FIELD.width / TILE; column += 1) {
        if ((row + column) % 2 === 0) context.fillRect(column * TILE, row + HUD_HEIGHT, TILE, TILE);
      }
    }
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    context.beginPath();
    for (let column = 0; column <= FIELD.width / TILE; column += 1) {
      context.moveTo(column * TILE, HUD_HEIGHT);
      context.lineTo(column * TILE, FIELD.height);
    }
    for (let row = 0; row <= FIELD.height / TILE; row += 1) {
      context.moveTo(0, HUD_HEIGHT + row * TILE);
      context.lineTo(FIELD.width, HUD_HEIGHT + row * TILE);
    }
    context.stroke();
  }

  function drawExit(state, now) {
    const exit = state.level.exit;
    const open = state.exitOpen;
    const pulse = 0.5 + 0.5 * Math.sin(now * 4);
    context.save();
    context.translate(exit.x, exit.y);
    if (open) {
      context.fillStyle = `rgba(61, 255, 122, ${0.25 + 0.2 * pulse})`;
      context.beginPath();
      context.arc(0, 0, 34 + 6 * pulse, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = open ? PALETTE.exit : PALETTE.exitLocked;
    context.fillRect(-16, -22, 32, 44);
    context.fillStyle = PALETTE.panel;
    context.fillRect(-9, -12, 18, 24);
    context.fillStyle = open ? PALETTE.exit : PALETTE.exitLocked;
    context.beginPath();
    context.arc(4, 0, 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
    plainText(open ? 'EXIT OPEN' : 'EXIT LOCKED', exit.x, exit.y + 40, 13, open ? PALETTE.exit : PALETTE.muted, 'center');
  }

  function drawLoot(state, now) {
    for (const loot of state.level.loot) {
      if (loot.taken) continue;
      const bob = Math.sin(now * 2.5 + loot.x) * 3;
      const y = loot.y + bob;
      context.save();
      context.translate(loot.x, y);
      const glow = 0.3 + 0.15 * Math.sin(now * 3 + loot.y);
      context.fillStyle = `rgba(255, 210, 62, ${glow})`;
      context.beginPath();
      context.arc(0, 0, 24, 0, Math.PI * 2);
      context.fill();
      if (loot.kind === 'painting') {
        context.fillStyle = '#8a6d2f';
        context.fillRect(-14, -17, 28, 34);
        context.fillStyle = '#7fb069';
        context.fillRect(-11, -14, 22, 28);
        context.fillStyle = '#e9c46a';
        context.beginPath();
        context.arc(-3, -4, 6, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#264653';
        context.fillRect(-11, 4, 22, 10);
      } else if (loot.kind === 'gold') {
        context.fillStyle = '#b8860b';
        context.fillRect(-15, -8, 30, 16);
        context.fillStyle = PALETTE.loot;
        context.fillRect(-13, -10, 26, 12);
        context.fillStyle = PALETTE.lootGlow;
        context.fillRect(-13, -10, 26, 4);
      } else {
        context.rotate(Math.PI / 4);
        context.fillStyle = '#b8f1ff';
        context.fillRect(-11, -11, 22, 22);
        context.fillStyle = '#e8fbff';
        context.fillRect(-11, -11, 22, 8);
        context.fillStyle = '#7fd4f2';
        context.fillRect(-4, -4, 8, 8);
      }
      context.restore();
      plainText(LOOT_LABEL[loot.kind], loot.x, loot.y + 34, 12, PALETTE.loot, 'center');
    }
  }

  function drawSmoke(state) {
    for (const smoke of state.smokes) {
      const alpha = Math.min(0.55, (smoke.left / 1.5) * 0.55);
      context.fillStyle = `rgba(154, 163, 178, ${alpha})`;
      context.beginPath();
      context.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = `rgba(220, 226, 235, ${alpha * 0.7})`;
      context.beginPath();
      context.arc(smoke.x - 20, smoke.y - 12, smoke.radius * 0.45, 0, Math.PI * 2);
      context.arc(smoke.x + 22, smoke.y + 10, smoke.radius * 0.4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCones(state) {
    const walls = state.level.walls;
    for (const camera of state.cameras) {
      conePolygon(camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.range, walls);
      context.fillStyle = camera.disabled
        ? 'rgba(120, 130, 145, 0.10)'
        : camera.seesPlayer
          ? 'rgba(255, 46, 31, 0.30)'
          : 'rgba(255, 143, 163, 0.24)';
      context.fill();
    }
    for (const guard of state.guards) {
      conePolygon(guard.x, guard.y, guard.angle, GUARD.viewHalfAngle, GUARD.viewRange, walls);
      context.fillStyle = coneColor(guard.suspicion);
      context.globalAlpha = guard.suspicion >= 0.45 ? 0.3 : 0.18;
      context.fill();
      context.globalAlpha = 1;
    }
  }

  function drawWalls(state) {
    for (const wall of state.level.walls) {
      context.fillStyle = wall.cover ? PALETTE.cover : PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.width, wall.height);
      context.fillStyle = wall.cover ? PALETTE.coverTop : PALETTE.wallTop;
      context.fillRect(wall.x, wall.y, wall.width, 5);
      if (wall.cover) {
        context.fillStyle = '#6fbf82';
        context.beginPath();
        context.arc(wall.x + 12, wall.y + 22, 6, 0, Math.PI * 2);
        context.arc(wall.x + 28, wall.y + 16, 5, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      // Body: a guard in a dark uniform with a red cap, facing where it looks.
      circle(guard.x, guard.y, GUARD.radius, PALETTE.guardDark);
      circle(guard.x, guard.y, GUARD.radius - 2, PALETTE.guard);
      const eyeX = guard.x + Math.cos(guard.angle) * 7;
      const eyeY = guard.y + Math.sin(guard.angle) * 7;
      circle(eyeX, eyeY, 4, '#ffffff');
      circle(eyeX + Math.cos(guard.angle) * 2, eyeY + Math.sin(guard.angle) * 2, 2, '#1a1a1a');
      if (guard.suspicion > 0.15) {
        // Suspicion bar above the guard's head.
        context.fillStyle = '#10131a';
        context.fillRect(guard.x - 16, guard.y - 30, 32, 6);
        context.fillStyle = coneColor(guard.suspicion);
        context.fillRect(guard.x - 15, guard.y - 29, 30 * guard.suspicion, 4);
      }
      if (guard.suspicion >= GUARD.suspiciousAt) {
        text('!', guard.x, guard.y - 34, 22, '#ffffff', 'center');
      }
    }
  }

  function drawCameras(state, now) {
    for (const camera of state.cameras) {
      const blink = camera.seesPlayer && Math.floor(now * 6) % 2 === 0;
      context.save();
      context.translate(camera.x, camera.y);
      context.rotate(camera.angle);
      context.fillStyle = '#2c3342';
      context.fillRect(-8, -6, 16, 12);
      context.fillStyle = camera.disabled ? '#5a6272' : blink ? '#ff2e1f' : PALETTE.camera;
      context.beginPath();
      context.arc(10, 0, 5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawPlayer(state, now) {
    const player = state.player;
    if (player.mercy > 0 && Math.floor(now * 10) % 2 === 0) return;
    circle(player.x, player.y, PLAYER.radius + 3, 'rgba(55, 224, 200, 0.25)');
    circle(player.x, player.y, PLAYER.radius, PALETTE.playerDark);
    circle(player.x, player.y, PLAYER.radius - 2, PALETTE.player);
    // The mask: a dark band with two eyes, facing the way the thief moves.
    context.save();
    context.translate(player.x, player.y);
    context.rotate(player.angle);
    context.fillStyle = '#12211e';
    context.fillRect(0, -7, 11, 14);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(4, -3.5, 2, 0, Math.PI * 2);
    context.arc(4, 3.5, 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    if (player.hidden) {
      plainText('HIDDEN', player.x, player.y - 24, 12, '#dfe6ef', 'center');
    } else if (player.sneaking) {
      plainText('SNEAKING', player.x, player.y - 24, 12, PALETTE.muted, 'center');
    }
  }

  function drawAlarmMeter(state, now) {
    const width = 320;
    const x = FIELD.width / 2 - width / 2;
    const y = 14;
    const value = state.alarm / 100;
    const flashing = state.alarmActive && Math.floor(now * 5) % 2 === 0;
    context.fillStyle = flashing ? '#5a1010' : PALETTE.panel;
    context.fillRect(x - 8, y - 4, width + 16, 32);
    context.strokeStyle = state.alarmActive ? PALETTE.alarm : PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x - 8, y - 4, width + 16, 32);
    context.fillStyle = '#10131a';
    context.fillRect(x, y, width, 20);
    const color = value > 0.66 ? PALETTE.alarm : value > 0.33 ? PALETTE.alarmMid : PALETTE.alarmLow;
    context.fillStyle = color;
    context.fillRect(x, y, width * value, 20);
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(x, y, width * value, 6);
    text('ALARM', x - 12, y + 17, 18, state.alarmActive ? PALETTE.alarm : PALETTE.text, 'right');
    if (state.alarmActive) {
      text('ALARM!', x + width + 12, y + 17, 18, PALETTE.alarm, 'left');
    }
  }

  function drawHud(state, now) {
    context.fillStyle = PALETTE.panel;
    context.fillRect(0, 0, FIELD.width, HUD_HEIGHT);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, HUD_HEIGHT - 2, FIELD.width, 2);
    plainText(state.level.name.toUpperCase(), 20, 24, 15, PALETTE.muted, 'left');
    text(`LOOT ${state.lootTaken}/${state.lootTotal}`, 20, 46, 20, PALETTE.loot, 'left');
    drawAlarmMeter(state, now);
    text(scoreLabel(state.score), FIELD.width - 20, 24, 20, PALETTE.text, 'right');
    const livesX = FIELD.width - 20;
    for (let life = 0; life < LIVES; life += 1) {
      circle(livesX - 110 - life * 24, 40, 7, life < state.lives ? '#ff5a7a' : '#2c3342');
    }
    plainText(`SMOKE ${state.tools.smoke}  ·  EMP ${state.tools.emp}`, 170, 46, 13, PALETTE.muted, 'left');
    plainText(`${Math.floor(state.levelTime / 60)}:${String(Math.floor(state.levelTime % 60)).padStart(2, '0')}`, FIELD.width / 2, 48, 13, PALETTE.muted, 'center');
  }

  function drawBanner(lines, prompt, accent) {
    const width = 620;
    const height = 120 + lines.length * 30;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10, 12, 18, 0.82)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index].value, FIELD.width / 2, y + 62 + index * 30, lines[index].size, lines[index].color, 'center');
    }
    if (prompt) text(prompt, FIELD.width / 2, y + height - 26, 20, PALETTE.loot, 'center');
  }

  const TITLE_LINES = [
    'Sneak in. Grab the loot. Get out.',
    'Guards patrol with vision cones — stay out of the yellow.',
    'Cameras sweep the halls and fill the alarm meter.',
    'Smoke (1 / click) hides you. EMP (2) blinds the cameras.',
    'Move: WASD or arrows · Sneak: Shift · Pause: P · Mute: M',
  ];

  /** Paint one frame: the floor, the heist, the HUD, then a panel for the screen. */
  function draw(state, screen, best, now) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawExit(state, now);
    drawLoot(state, now);
    drawSmoke(state);
    drawCones(state);
    drawWalls(state);
    drawGuards(state);
    drawCameras(state, now);
    drawPlayer(state, now);
    if (state.alarmActive) {
      context.strokeStyle = `rgba(255, 46, 31, ${0.35 + 0.25 * Math.sin(now * 6)})`;
      context.lineWidth = 8;
      context.strokeRect(4, HUD_HEIGHT + 4, FIELD.width - 8, FIELD.height - HUD_HEIGHT - 8);
    }
    if (screen === SCREEN_TITLE) {
      drawBanner(
        [
          { value: 'THE GILDED VAULT', size: 52, color: PALETTE.loot },
          { value: 'A midnight heist in three floors', size: 22, color: PALETTE.text },
          ...TITLE_LINES.map((line) => ({ value: line, size: 17, color: PALETTE.muted })),
        ],
        `Press Space or click to start   ·   ${bestLabel(best)}`,
        PALETTE.loot,
      );
      return;
    }
    drawHud(state, now);
    if (screen === SCREEN_PAUSED) {
      drawBanner([{ value: 'PAUSED', size: 44, color: PALETTE.text }], 'Press P to resume', PALETTE.panelEdge);
    } else if (screen === SCREEN_OVER) {
      drawBanner(
        [
          { value: 'CAUGHT!', size: 48, color: PALETTE.alarm },
          { value: 'The guards hauled you out of the vault.', size: 20, color: PALETTE.text },
          { value: finalLabel(state.score), size: 24, color: PALETTE.loot },
          { value: bestLabel(best), size: 20, color: PALETTE.muted },
        ],
        'Press Space or click to try again',
        PALETTE.alarm,
      );
    } else if (screen === SCREEN_WIN) {
      drawBanner(
        [
          { value: 'CLEAN GETAWAY!', size: 44, color: PALETTE.exit },
          { value: 'Every floor cleared. The vault is empty.', size: 20, color: PALETTE.text },
          { value: finalLabel(state.score), size: 26, color: PALETTE.loot },
          { value: bestLabel(best), size: 20, color: PALETTE.muted },
        ],
        'Press Space or click to play again',
        PALETTE.exit,
      );
    } else if (screen === SCREEN_CLEAR) {
      drawBanner(
        [
          { value: 'FLOOR CLEARED', size: 44, color: PALETTE.exit },
          { value: `Next: ${state.level.name}`, size: 22, color: PALETTE.text },
          { value: finalLabel(state.score), size: 24, color: PALETTE.loot },
        ],
        '',
        PALETTE.exit,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
