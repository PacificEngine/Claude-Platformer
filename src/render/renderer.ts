import { activeDarkRange } from '../core/camera';
import { VIEW_TILES_W } from '../core/constants';
import type { GameState, Tile } from '../core/types';
import type { SpriteName } from './spriteData';
import type { SpriteSheet } from './sprites';

export const TILE = 16;
export const VIEW_W = VIEW_TILES_W * TILE;
export const VIEW_H = 224;

const TILE_SPRITE: Record<Tile, SpriteName | null> = {
  empty: null,
  solid: 'ground',
  brick: 'brick',
  coinBlock: 'question',
  mushroomBlock: 'question',
  used: 'used',
  pipeTL: 'pipeTL',
  pipeTR: 'pipeTR',
  pipeL: 'pipeL',
  pipeR: 'pipeR',
  hiddenCoin: null,
  hiddenOneUp: null,
  hiddenMushroom: null,
  hiddenWarp: null,
  warpBlock: 'warpBlock',
};

function blit(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  flip = false,
): void {
  if (!flip) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  ctx.save();
  ctx.translate(x + w, y);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
}

/** Draws a 16-px-wide sprite horizontally centered on a body and flush with its bottom. */
function blitBody(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  body: { x: number; y: number; w: number; h: number },
  cam: number,
  heightPx: number,
  flip: boolean,
): void {
  const x = Math.round((body.x + body.w / 2) * TILE - TILE / 2) - cam;
  const y = Math.round((body.y + body.h) * TILE - heightPx);
  blit(ctx, img, x, y, TILE, heightPx, flip);
}

/** Columns of a dark room are drawn only while the player is inside that same room. */
function colVisible(s: GameState, col: number): boolean {
  const inDark = s.levels[s.levelIndex].dark.some((range) => col >= range.from && col <= range.to);
  if (!inDark) return true;
  const active = activeDarkRange(s);
  return active !== undefined && col >= active.from && col <= active.to;
}

function drawBackground(ctx: CanvasRenderingContext2D, cam: number, dark: boolean): void {
  if (dark) {
    ctx.fillStyle = '#0a0a1e';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    return;
  }
  ctx.fillStyle = '#5c94fc';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.fillStyle = '#ffffff';
  const cloudOffset = -((cam * 0.25) % 160);
  for (let x = cloudOffset - 160; x < VIEW_W + 160; x += 160) {
    ctx.fillRect(x + 20, 40, 32, 8);
    ctx.fillRect(x + 28, 34, 16, 6);
    ctx.fillRect(x + 90, 64, 40, 8);
    ctx.fillRect(x + 98, 58, 20, 6);
  }

  ctx.fillStyle = '#00a800';
  const hillOffset = -((cam * 0.5) % 192);
  for (let x = hillOffset - 192; x < VIEW_W + 192; x += 192) {
    ctx.beginPath();
    ctx.arc(x + 96, 12 * TILE, 48, Math.PI, 0);
    ctx.fill();
  }
}

function drawTiles(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet, cam: number): void {
  const first = Math.max(0, Math.floor(s.cameraX));
  const last = Math.min(s.width - 1, Math.ceil(s.cameraX + VIEW_TILES_W));
  for (let row = 0; row < s.height; row++) {
    for (let col = first; col <= last; col++) {
      if (!colVisible(s, col)) continue;
      const name = TILE_SPRITE[s.tiles[row][col]];
      if (name) blit(ctx, sheet[name], col * TILE - cam, row * TILE, TILE, TILE);
    }
  }
}

function drawCoins(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet, cam: number): void {
  const width = Math.max(4, Math.round(TILE * Math.abs(Math.cos(s.tick / 12))));
  for (const cell of s.coinPickups) {
    if (!colVisible(s, cell.col)) continue;
    blit(ctx, sheet.coin, cell.col * TILE - cam + (TILE - width) / 2, cell.row * TILE, width, TILE);
  }
}

function drawFlag(ctx: CanvasRenderingContext2D, s: GameState, cam: number): void {
  const f = s.flag;
  const x = Math.round(f.x * TILE) - cam;
  const y = Math.round(f.y * TILE);
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(x, y, Math.round(f.w * TILE), Math.round(f.h * TILE));
  ctx.fillStyle = '#58d854';
  ctx.beginPath();
  ctx.moveTo(x, y + 2);
  ctx.lineTo(x - 12, y + 8);
  ctx.lineTo(x, y + 14);
  ctx.fill();
  ctx.fillStyle = '#fcbc3c';
  ctx.fillRect(x - 1, y - 3, 6, 4);
}

function drawMushrooms(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet, cam: number): void {
  for (const m of s.mushrooms) {
    if (!colVisible(s, Math.floor(m.x))) continue;
    blitBody(ctx, sheet[m.kind === 'oneUp' ? 'mushroomOneUp' : 'mushroom'], m, cam, TILE, false);
  }
}

function drawEnemies(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet, cam: number): void {
  for (const e of s.enemies) {
    if (!colVisible(s, Math.floor(e.x))) continue;
    if (e.kind === 'walker') {
      blitBody(ctx, sheet.walker, e, cam, TILE, Math.floor(s.tick / 8) % 2 === 1);
    } else {
      const name = e.mode === 'walking' ? 'turtle' : 'shell';
      blitBody(ctx, sheet[name], e, cam, TILE, e.dir > 0);
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet, cam: number): void {
  const p = s.player;
  if (p.invulnerable > 0 && Math.floor(s.tick / 3) % 2 === 0) return;
  const big = p.size === 'big';
  const moving = Math.abs(p.vx) > 0.5 && p.onGround;
  const running = moving && Math.floor(s.tick / 6) % 2 === 1;
  const pose = !p.onGround ? 'Jump' : running ? 'Run' : 'Stand';
  const name = `player${big ? 'Big' : 'Small'}${pose}` as SpriteName;
  blitBody(ctx, sheet[name], p, cam, big ? 2 * TILE : TILE, p.facing < 0);
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign = 'left'): void {
  ctx.textAlign = align;
  ctx.fillStyle = '#000000';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.font = 'bold 8px monospace';
  ctx.textBaseline = 'alphabetic';
  drawText(ctx, `SCORE ${String(s.score).padStart(6, '0')}`, 8, 12);
  drawText(ctx, `COIN x${String(s.coins).padStart(2, '0')}`, 80, 12);
  drawText(ctx, `WORLD ${s.levelIndex + 1}`, 130, 12);
  drawText(ctx, `LIVES ${Math.max(0, s.lives)}`, 178, 12);
  drawText(ctx, `T ${String(Math.floor(s.timeLeft)).padStart(3, '0')}`, 220, 12);
}

function drawOverlay(ctx: CanvasRenderingContext2D, s: GameState): void {
  const lines: Record<string, [string, string]> = {
    title: ['SUPER PLATFORMER', 'PRESS JUMP TO START'],
    levelClear: ['LEVEL CLEAR!', ''],
    gameOver: ['GAME OVER', 'PRESS JUMP'],
    won: ['YOU WIN!', `SCORE ${s.score}  -  PRESS JUMP`],
  };
  const text = lines[s.phase];
  if (!text) return;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 80, VIEW_W, 64);
  ctx.font = 'bold 16px monospace';
  drawText(ctx, text[0], VIEW_W / 2, 108, 'center');
  ctx.font = 'bold 8px monospace';
  drawText(ctx, text[1], VIEW_W / 2, 128, 'center');
}

export function render(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet): void {
  ctx.imageSmoothingEnabled = false;
  const cam = Math.round(s.cameraX * TILE);
  drawBackground(ctx, cam, activeDarkRange(s) !== undefined);
  // While warping, the player is drawn first so the pipe tiles cover them.
  if (s.phase === 'warping') drawPlayer(ctx, s, sheet, cam);
  drawTiles(ctx, s, sheet, cam);
  drawCoins(ctx, s, sheet, cam);
  drawFlag(ctx, s, cam);
  drawMushrooms(ctx, s, sheet, cam);
  drawEnemies(ctx, s, sheet, cam);
  if (s.phase !== 'warping') drawPlayer(ctx, s, sheet, cam);
  drawHud(ctx, s);
  drawOverlay(ctx, s);
}
