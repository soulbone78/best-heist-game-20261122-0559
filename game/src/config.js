// Every tuning number and colour for The Gilded Vault, in one place. The playfield is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size. Tiles are 40 px: the maps are 32 columns by 18 rows.

export const FIELD = { width: 1280, height: 720 };
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 205,
  sneakSpeed: 115,
  /** How close a guard must get to catch the thief. */
  catchDistance: 26,
  /** Seconds of mercy after being caught, before a guard can catch again. */
  mercy: 2.0,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 78,
  /** How fast a guard walks when it is suspicious and investigating. */
  investigateSpeed: 118,
  /** How fast a guard runs during the alarm. */
  chaseSpeed: 168,
  /** Vision range in pixels and half-angle of the cone, in radians. */
  viewRange: 235,
  viewHalfAngle: 0.62,
  /** Suspicion gained per second while the thief is in the cone and in sight. */
  suspicionRate: 0.85,
  /** Suspicion gained per second when the thief is close (under 90 px). */
  closeBonus: 0.7,
  /** Suspicion lost per second when the thief is out of sight. */
  suspicionDecay: 0.28,
  /** Above this, the guard leaves its patrol to investigate the last seen spot. */
  suspiciousAt: 0.45,
  /** At this, the guard is certain: the alarm meter jumps. */
  certainAt: 0.95,
  /** How long a guard waits at each patrol waypoint, in seconds. */
  waitAtWaypoint: 1.6,
  /** How long a guard searches the last seen spot before giving up. */
  searchSeconds: 4.0,
};

export const CAMERA = {
  range: 265,
  halfAngle: 0.5,
  /** Degrees per second the camera sweeps. */
  sweepSpeed: 0.55,
  /** How far, in radians, it swings either side of its base angle. */
  sweepArc: 0.85,
  /** Alarm gained per second while a camera watches the thief. */
  alarmRate: 34,
};

export const ALARM = {
  /** Alarm gained per second from a guard that is certain it saw the thief. */
  guardRate: 30,
  /** Alarm gained per second while any guard is suspicious (scaled by suspicion). */
  suspicionRate: 10,
  /** Alarm lost per second while nobody sees the thief. */
  decay: 7,
  /** How long the full alarm lasts before the house calms down. */
  duration: 9,
  /** Alarm level the meter drops to after the thief is caught. */
  afterCaught: 40,
};

export const TOOLS = {
  smokePerLevel: 3,
  /** Seconds a smoke cloud lasts. */
  smokeSeconds: 4.5,
  smokeRadius: 78,
  empPerLevel: 2,
  /** Seconds the cameras stay dark after an EMP. */
  empSeconds: 6,
};

export const LIVES = 3;

/** Points for each loot kind, and for clearing a level without ever raising the alarm. */
export const SCORE = {
  painting: 100,
  gold: 150,
  diamond: 300,
  levelClear: 200,
  ghostBonus: 250,
  /** Points per second left under the level's par time. */
  timePerSecond: 5,
};

export const PALETTE = {
  backdrop: '#0a0c12',
  floor: '#1c2027',
  floorAlt: '#20242d',
  floorLine: '#262b36',
  wall: '#3a4152',
  wallTop: '#565f75',
  cover: '#2e5d43',
  coverTop: '#4c8a63',
  shadow: '#141821',
  player: '#37e0c8',
  playerDark: '#1d9e8c',
  guard: '#ff5a4e',
  guardDark: '#b33228',
  cone: '#ffd23e',
  coneHot: '#ff7a1a',
  coneDanger: '#ff2e1f',
  camera: '#ff8fa3',
  loot: '#ffd23e',
  lootGlow: '#ffe98a',
  exit: '#3dff7a',
  exitLocked: '#ff5a4e',
  smoke: '#9aa3b2',
  panel: '#171b24',
  panelEdge: '#2c3342',
  text: '#f2f4f8',
  muted: '#9aa3b2',
  alarm: '#ff2e1f',
  alarmMid: '#ff7a1a',
  alarmLow: '#ffd23e',
  gold: '#ffd23e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gilded-vault.best';
