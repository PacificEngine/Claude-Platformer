import { describe, expect, it } from 'vitest';
import { collect, levelText, pipeEdits, playing, tick } from '../testing/helpers';
import { DT, WARP_EMERGE_TIME, WARP_SINK_TIME } from './constants';

const WARP_TICKS = Math.ceil((WARP_SINK_TIME + WARP_EMERGE_TIME) / DT) + 3;

/** 40 wide: pipe 1 at col 8 warps to pipe 2 at col 30. */
const TWO_PIPES = levelText(40, [...pipeEdits(8, '1'), ...pipeEdits(30, '2')], 6, ['warp 1 -> 2']);

/** A game with the player standing on the mouth of the pipe whose left column is `col`. */
function onPipe(text: string, col: number) {
  const s = playing(text);
  s.player.x = col + 1 - s.player.w / 2;
  s.player.y = 2;
  tick(s, {}, 3);
  return s;
}

describe('entering a pipe', () => {
  it('starts a warp on a fresh Down press while standing on a linked mouth', () => {
    const s = onPipe(TWO_PIPES, 8);
    const events = collect(s, { down: true }, 1);
    expect(s.phase).toBe('warping');
    expect(events).toContain('warp');
  });

  it('ignores Down when the player is not centred on the mouth', () => {
    const s = onPipe(TWO_PIPES, 8);
    s.player.x = 9.7; // still resting on the pipe's edge, but centred beyond it
    tick(s, {}, 3);
    expect(s.player.onGround).toBe(true);
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('playing');
  });

  it('ignores Down in the air', () => {
    const s = onPipe(TWO_PIPES, 8);
    s.player.onGround = false;
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('playing');
  });

  it('ignores Down on a pipe with no warp', () => {
    const s = onPipe(levelText(40, [...pipeEdits(8, '1'), ...pipeEdits(30, '2')]), 8);
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('playing');
  });

  it('needs a fresh press, not a held Down', () => {
    const s = onPipe(TWO_PIPES, 8);
    s.prevDown = true;
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('playing');
    tick(s, {}, 1);
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('warping');
  });
});

describe('entering a pipe: guards', () => {
  it('does not start a warp when the feet are not on top', () => {
    const s = playing(TWO_PIPES);
    s.player.x = 6; // on the ground beside pipe 1
    tick(s, {}, 5);
    expect(s.player.onGround).toBe(true);
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('playing');
  });

  it('does not re-warp when Down is held through the whole warp', () => {
    const text = levelText(40, [...pipeEdits(8, '1'), ...pipeEdits(30, '2')], 6, [
      'warp 1 -> 2',
      'warp 2 -> 1',
    ]);
    const s = onPipe(text, 8);
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('warping');
    tick(s, { down: true }, WARP_TICKS + 20);
    expect(s.phase).toBe('playing');
    expect(s.player.x + s.player.w / 2).toBeCloseTo(31, 1);
    tick(s, {}, 1);
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('warping');
    tick(s, {}, WARP_TICKS);
    expect(s.player.x + s.player.w / 2).toBeCloseTo(9, 1);
  });
});

describe('the warp itself', () => {
  it('sinks, teleports and emerges standing on the destination pipe', () => {
    const s = onPipe(TWO_PIPES, 8);
    tick(s, { down: true }, 1);
    tick(s, {}, WARP_TICKS);
    expect(s.phase).toBe('playing');
    expect(s.warp).toBeNull();
    expect(s.player.x + s.player.w / 2).toBeCloseTo(31, 1);
    expect(s.player.y + s.player.h).toBeCloseTo(3, 1);
    expect(s.player.vx).toBe(0);
  });

  it('is in the warping phase for about 0.8 seconds', () => {
    const s = onPipe(TWO_PIPES, 8);
    tick(s, { down: true }, 1);
    tick(s, {}, 20);
    expect(s.phase).toBe('warping');
    tick(s, {}, WARP_TICKS);
    expect(s.phase).toBe('playing');
  });

  it('snaps the camera back to a destination behind it', () => {
    const text = levelText(60, [...pipeEdits(50, '1'), ...pipeEdits(5, '2')], 6, ['warp 1 -> 2']);
    const s = onPipe(text, 50);
    s.cameraX = 40;
    tick(s, { down: true }, 1);
    tick(s, {}, WARP_TICKS);
    expect(s.cameraX).toBe(0);
    expect(s.player.x).toBeGreaterThanOrEqual(s.cameraX);
  });

  it('freezes enemies and the clock while warping', () => {
    const text = levelText(40, [...pipeEdits(8, '1'), ...pipeEdits(30, '2'), [14, 4, 'g']], 6, ['warp 1 -> 2']);
    const s = onPipe(text, 8);
    tick(s, { down: true }, 1);
    const enemyX = s.enemies[0].x;
    const timeLeft = s.timeLeft;
    tick(s, {}, 10);
    expect(s.phase).toBe('warping');
    expect(s.enemies[0].x).toBe(enemyX);
    expect(s.timeLeft).toBe(timeLeft);
  });
});

describe('pipes and warp blocks', () => {
  it('blocks the player like a wall', () => {
    const s = playing(levelText(20, pipeEdits(8, '<')));
    tick(s, { right: true, run: true }, 120);
    expect(s.player.x + s.player.w).toBeLessThanOrEqual(8 + 1e-6);
  });

  it('lets a revealed warp block be entered from above', () => {
    const text = levelText(30, [[8, 3, 'w'], ...pipeEdits(20, '2')], 6, ['secret 1 -> 2']);
    const s = playing(text);
    tick(s, {}, 3);
    s.player.x = 8.1;
    tick(s, {}, 3);
    tick(s, { jump: true }, 3); // bump from below: reveals the block
    expect(s.tiles[3][8]).toBe('warpBlock');
    s.player.x = 8.125;
    s.player.y = 2;
    s.player.vy = 0;
    tick(s, {}, 6);
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('warping');
    tick(s, {}, WARP_TICKS);
    expect(s.player.x + s.player.w / 2).toBeCloseTo(21, 1);
  });
});
