import { PLAYER_W, START_LIVES, START_TIME, WALKER_SPEED } from './constants';
import type { Cell, Enemy, GameState, Level, Player, Rect } from './types';

function makePlayer(spawn: Cell, size: Player['size']): Player {
  const h = size === 'big' ? 2 : 1;
  return {
    x: spawn.col + (1 - PLAYER_W) / 2,
    y: spawn.row + 1 - h,
    w: PLAYER_W,
    h,
    vx: 0,
    vy: 0,
    size,
    onGround: false,
    jumping: false,
    facing: 1,
    coyote: 0,
    jumpBuffer: 0,
    invulnerable: 0,
  };
}

function makeEnemy(cell: Cell, kind: Enemy['kind']): Enemy {
  return {
    x: cell.col + 0.1,
    y: cell.row + 0.2,
    w: 0.8,
    h: 0.8,
    vx: -WALKER_SPEED,
    vy: 0,
    kind,
    mode: 'walking',
    dir: -1,
    onGround: false,
    awake: false,
    cooldown: 0,
  };
}

function makeFlag(level: Level): Rect {
  let bottom = level.flag.row;
  while (bottom < level.height && level.tiles[bottom][level.flag.col] === 'empty') bottom += 1;
  return { x: level.flag.col + 0.35, y: level.flag.row, w: 0.3, h: bottom - level.flag.row };
}

export function loadLevel(s: GameState, index: number, size: Player['size']): void {
  const level = s.levels[index];
  s.levelIndex = index;
  s.width = level.width;
  s.height = level.height;
  s.tiles = level.tiles.map((row) => [...row]);
  s.player = makePlayer(level.spawn, size);
  s.enemies = [
    ...level.walkers.map((cell) => makeEnemy(cell, 'walker')),
    ...level.shells.map((cell) => makeEnemy(cell, 'shell')),
  ];
  s.mushrooms = [];
  s.coinPickups = level.coins.map((cell) => ({ ...cell }));
  s.flag = makeFlag(level);
  s.cameraX = 0;
  s.warp = null;
  s.timeLeft = START_TIME;
}

export function createGame(levels: Level[]): GameState {
  const state: GameState = {
    phase: 'title',
    levels,
    levelIndex: 0,
    width: 0,
    height: 0,
    tiles: [],
    player: makePlayer({ col: 0, row: 0 }, 'small'),
    enemies: [],
    mushrooms: [],
    coinPickups: [],
    flag: { x: 0, y: 0, w: 0, h: 0 },
    cameraX: 0,
    score: 0,
    coins: 0,
    lives: START_LIVES,
    timeLeft: START_TIME,
    phaseTimer: 0,
    tick: 0,
    prevJump: false,
    prevDown: false,
    warp: null,
    events: [],
  };
  loadLevel(state, 0, 'small');
  return state;
}

export function resetGame(s: GameState): void {
  s.score = 0;
  s.coins = 0;
  s.lives = START_LIVES;
  loadLevel(s, 0, 'small');
  s.phase = 'title';
}
