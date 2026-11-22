// The three heist floors. Each map is 32 columns by 18 rows of 40 px tiles:
//   '#' a wall (blocks movement and sight)
//   'H' cover: a planter or statue (blocks movement and sight, drawn green)
//   '.' open floor
//   'P' where the thief starts, 'E' the exit, 'L' a loot target (kinds, in scan order,
//       come from the level's `loot` list).
// Guard routes are tile waypoints [column, row] (a third number is a wait in seconds).
// Cameras sit on wall tiles and sweep around a base angle (radians; 0 is east).

import { TILE } from './config.js';

const LEVEL_1_MAP = [
  '################################',
  '#..............##..............#',
  '#..L...........##...........L..#',
  '#..............##..............#',
  '#..HH..........##..........HH..#',
  '#..............##..............#',
  '#......####....##....####......#',
  '#......####....##....####......#',
  '#..............................#',
  '#......####....##....####......#',
  '#......####....##....####......#',
  '#..............##..............#',
  '#..HH..........##..........HH..#',
  '#..............##..............#',
  '#..............##......L.......#',
  '#..P...........##..............#',
  '#..............##...........E..#',
  '################################',
];

const LEVEL_2_MAP = [
  '################################',
  '#....L........#........L.......#',
  '#.............#................#',
  '#..HH.........#.......HH.......#',
  '#..............................#',
  '#.............#................#',
  '#.....#####...#....#####.......#',
  '#.....#.......#.......#........#',
  '#.....#..L....#....L..#........#',
  '#.....#.......#.......#........#',
  '#.....#####...#....#####.......#',
  '#.............#................#',
  '#..............................#',
  '#.............#................#',
  '#.............#................#',
  '#..P..........#.............E..#',
  '#.............#................#',
  '################################',
];

const LEVEL_3_MAP = [
  '################################',
  '#..L....#...........#......L...#',
  '#.......#...........#..........#',
  '#..HH...#....HH.....#..HH......#',
  '#.......#...........#..........#',
  '#..#####....####.....####......#',
  '#.......#...........#..........#',
  '#.......#..L........#..L.......#',
  '#.......#...........#..........#',
  '#..#####....####.....####......#',
  '#.......#...........#..........#',
  '#..HH...#....HH.....#..HH......#',
  '#.......#...........#..........#',
  '#..L....#...........#......L...#',
  '#..............................#',
  '#..P....#...........#.......E..#',
  '#.......#...........#..........#',
  '################################',
];

function tileCentre(column, row) {
  return { x: column * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

export const LEVELS = [
  {
    name: 'The Atrium',
    parSeconds: 75,
    loot: ['painting', 'painting', 'painting'],
    map: LEVEL_1_MAP,
    guards: [
      { route: [[5, 5], [11, 5], [11, 12], [5, 12]] },
      { route: [[20, 5], [26, 5], [26, 12], [20, 12]] },
    ],
    cameras: [{ x: 580, y: 40, baseAngle: Math.PI / 2 }],
  },
  {
    name: 'The Gold Room',
    parSeconds: 95,
    loot: ['gold', 'gold', 'gold', 'gold'],
    map: LEVEL_2_MAP,
    guards: [
      { route: [[6, 2], [12, 2], [12, 4], [6, 4]] },
      { route: [[27, 2], [18, 2], [18, 4], [27, 4]] },
      { route: [[4, 14], [12, 14]] },
    ],
    cameras: [
      { x: 540, y: 40, baseAngle: Math.PI / 2 },
      { x: 540, y: 660, baseAngle: -Math.PI / 2 },
    ],
  },
  {
    name: 'The Diamond Vault',
    parSeconds: 120,
    loot: ['diamond', 'diamond', 'gold', 'gold', 'painting', 'painting'],
    map: LEVEL_3_MAP,
    guards: [
      { route: [[10, 2], [17, 2], [17, 4], [10, 4]] },
      { route: [[27, 2], [27, 10]] },
      { route: [[3, 14], [6, 14]] },
      { route: [[22, 14], [28, 14]] },
    ],
    cameras: [
      { x: 300, y: 40, baseAngle: Math.PI / 2 },
      { x: 860, y: 40, baseAngle: Math.PI / 2 },
      { x: 300, y: 660, baseAngle: -Math.PI / 2 },
    ],
  },
];

/**
 * Read a level's map into the pieces the game needs: wall rectangles (with a cover
 * flag for planters), the loot targets, the thief's start and the exit. The caller
 * owns the returned objects.
 */
export function parseLevel(definition) {
  const walls = [];
  const loot = [];
  let start = { x: 60, y: 620 };
  let exit = { x: 1140, y: 660 };
  let lootIndex = 0;
  for (let row = 0; row < definition.map.length; row += 1) {
    const line = definition.map[row];
    for (let column = 0; column < line.length; column += 1) {
      const cell = line[column];
      const x = column * TILE;
      const y = row * TILE;
      if (cell === '#' || cell === 'H') {
        walls.push({ x, y, width: TILE, height: TILE, cover: cell === 'H' });
      } else if (cell === 'P') {
        start = { x: x + TILE / 2, y: y + TILE / 2 };
      } else if (cell === 'E') {
        exit = { x: x + TILE / 2, y: y + TILE / 2 };
      } else if (cell === 'L') {
        loot.push({
          x: x + TILE / 2,
          y: y + TILE / 2,
          kind: definition.loot[lootIndex] ?? 'painting',
          taken: false,
        });
        lootIndex += 1;
      }
    }
  }
  const guards = definition.guards.map((guard) => ({
    route: guard.route.map((point) => ({
      x: point[0] * TILE + TILE / 2,
      y: point[1] * TILE + TILE / 2,
      wait: point[2] ?? 0,
    })),
  }));
  const cameras = definition.cameras.map((camera) => ({
    x: camera.x,
    y: camera.y,
    baseAngle: camera.baseAngle,
  }));
  return {
    name: definition.name,
    parSeconds: definition.parSeconds,
    walls,
    loot,
    start,
    exit,
    guards,
    cameras,
  };
}

export { tileCentre };
