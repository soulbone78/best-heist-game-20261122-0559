# The Gilded Vault — a midnight heist
[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/soulbone78/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/soulbone78/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A thief slips into a museum after dark. Grab **every loot** on the floor, then reach
the **exit** — before the alarm meter fills.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files (HTML + ES modules).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift | Sneak (slower, harder to spot) |
| 1 / Q, or click | Smoke bomb — hide inside the cloud |
| 2 / E | EMP — blinds every camera for 6 seconds |
| Space / click | Start, restart |
| P / Esc | Pause |
| M | Mute |

## How the heist works

- **Vision cones** — guards patrol fixed routes and look where they walk (pausing to
  scan the room). A cone turns yellow → orange → red as suspicion rises. Walls and
  planters block sight; sneaking halves how fast suspicion climbs.
- **Suspicion** — being in a cone with line of sight fills a guard's suspicion. Past
  halfway the guard leaves its patrol to investigate where it last saw you.
- **Cameras** — wall-mounted, sweeping back and forth. A camera watching you fills the
  alarm meter fast. EMP knocks them all out for 6 seconds.
- **Alarm meter** — rises while any guard is suspicious or a camera watches you, and
  drains while nobody sees you. At full, the alarm sounds: every guard runs you down
  for 9 seconds. Break sight and the house calms down.
- **Caught** — a guard that touches you costs 1 of 3 lives; you respawn at the floor's
  entrance, loot kept. Lose all 3 and the night is over.
- **Score** — loot values (painting 100, gold bar 150, diamond 300), 200 per floor
  cleared, 250 ghost bonus for a floor with no alarm, plus a time bonus under par.

Three floors, increasing difficulty: **The Atrium** (2 guards, 1 camera),
**The Gold Room** (3 guards, 2 cameras), **The Diamond Vault** (4 guards,
3 cameras). Clear all three for the clean getaway.

## Files

```text
game/index.html      canvas + status line, loads src/main.js
game/src/
  main.js            boot, fixed-step loop, screens, shot mode
  config.js          field, speeds, vision, alarm, score, palette
  levels.js          the 3 hand-designed floors (maps, routes, cameras)
  guards.js          vision cones, patrols, suspicion, chase, line of sight
  cameras.js         sweeping security cameras
  world.js           thief, loot, tools, alarm, lives, levels, scoring
  input.js           keyboard + mouse
  render.js          canvas drawing: floors, cones, HUD, screens
  sound.js           WebAudio synth blips and the alarm siren
  shots.js           the 4 screenshot scenes (?shot=start|play|alarm|escape)
  random.js          seeded RNG (mulberry32)
main.ts              hand-in: copies game/ + screenshots/ to /output, writes dossier.json
serve.ts             static server for local play
shots.json           the 4 screenshots (name + query)
screenshots/         4 real renders of the game's own code (1280x720 JPEG)
vendor/makefun-game.ts  the kit's dossier builder, unchanged
```

## Screenshots

`?shot=start` (title over the patrolling Atrium), `?shot=play` (mid-heist: thief
crossing the room, cones sweeping, camera watching, alarm a third full),
`?shot=alarm` (alarm nearly full, a guard running the thief down, camera locked on),
`?shot=escape` (every loot pocketed on the Diamond Vault, the exit open). Each stages
the scene with the game's own rules and sets `window.__shotReady` after two paints.

---

<sub>Entered on [make.fun](https://make.fun/?ref=gy7cazjt&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
