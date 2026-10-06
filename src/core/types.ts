export type Tile =
  | 'empty' | 'solid' | 'brick' | 'coinBlock' | 'mushroomBlock' | 'used'
  | 'pipeTL' | 'pipeTR' | 'pipeL' | 'pipeR'
  | 'hiddenCoin' | 'hiddenOneUp' | 'hiddenMushroom' | 'hiddenWarp' | 'warpBlock';

export interface Cell {
  col: number;
  row: number;
}

/** A labelled pipe mouth: the top-left cell of a pipe. */
export interface Mouth {
  id: number;
  col: number;
  row: number;
}

export interface Warp {
  from: number;
  to: number;
}

/** A hidden warp block at (col, row) that, once revealed, enters mouth `to`. */
export interface SecretWarp {
  col: number;
  row: number;
  to: number;
}

export interface ColumnRange {
  from: number;
  to: number;
}

export interface Level {
  width: number;
  height: number;
  tiles: Tile[][];
  spawn: Cell;
  flag: Cell;
  walkers: Cell[];
  shells: Cell[];
  coins: Cell[];
  mouths: Mouth[];
  warps: Warp[];
  secretWarps: SecretWarp[];
  dark: ColumnRange[];
}

export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
  run: boolean;
  down: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Body extends Rect {
  vx: number;
  vy: number;
}

export interface Player extends Body {
  size: 'small' | 'big';
  onGround: boolean;
  jumping: boolean;
  facing: 1 | -1;
  coyote: number;
  jumpBuffer: number;
  invulnerable: number;
}

export interface Enemy extends Body {
  kind: 'walker' | 'shell';
  mode: 'walking' | 'stunned' | 'sliding';
  dir: 1 | -1;
  onGround: boolean;
  awake: boolean;
  cooldown: number;
}

export interface Mushroom extends Body {
  kind: 'grow' | 'oneUp';
  dir: 1 | -1;
  onGround: boolean;
}

export type EventType =
  | 'jump' | 'coin' | 'stomp' | 'kick' | 'sprout' | 'powerup'
  | 'shrink' | 'bump' | 'break' | 'death' | 'flag' | 'oneup' | 'warp';

export interface GameEvent {
  type: EventType;
}

export type Phase = 'title' | 'playing' | 'dying' | 'levelClear' | 'gameOver' | 'won' | 'warping';

export interface GameState {
  phase: Phase;
  levels: Level[];
  levelIndex: number;
  width: number;
  height: number;
  tiles: Tile[][];
  player: Player;
  enemies: Enemy[];
  mushrooms: Mushroom[];
  coinPickups: Cell[];
  flag: Rect;
  cameraX: number;
  score: number;
  coins: number;
  lives: number;
  timeLeft: number;
  phaseTimer: number;
  tick: number;
  prevJump: boolean;
  prevDown: boolean;
  warp: { to: number; teleported: boolean } | null;
  events: GameEvent[];
}
