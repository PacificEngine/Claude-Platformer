import { describe, expect, it } from 'vitest';
import { collect, levelText, NONE, playing, span, tick } from '../testing/helpers';
import { step } from './game';
import { COYOTE_TIME, RUN_SPEED, WALK_SPEED } from './constants';

const FLAT = levelText(30);
const LEDGE = levelText(30, span(5, 29, 5, '.')); // ground only on cols 0-4

describe('player movement', () => {
  it('rests on the ground', () => {
    const s = playing(FLAT);
    tick(s, {}, 5);
    expect(s.player.onGround).toBe(true);
    expect(s.player.y).toBeCloseTo(4);
  });

  it('accelerates toward walking speed', () => {
    const s = playing(FLAT);
    tick(s, { right: true }, 10);
    expect(s.player.vx).toBeGreaterThan(0);
    expect(s.player.vx).toBeLessThan(WALK_SPEED);
    tick(s, { right: true }, 60);
    expect(s.player.vx).toBeCloseTo(WALK_SPEED);
  });

  it('runs faster while the run button is held', () => {
    const s = playing(FLAT);
    tick(s, { right: true, run: true }, 60);
    expect(s.player.vx).toBeCloseTo(RUN_SPEED);
  });

  it('slows to a stop when input is released', () => {
    const s = playing(FLAT);
    tick(s, { right: true }, 60);
    tick(s, {}, 60);
    expect(s.player.vx).toBe(0);
  });
});

describe('player jumping', () => {
  it('jumps and announces it', () => {
    const s = playing(FLAT);
    tick(s, {}, 5);
    step(s, { ...NONE, jump: true });
    expect(s.player.vy).toBeLessThan(0);
    expect(s.player.onGround).toBe(false);
    expect(s.events).toEqual([{ type: 'jump' }]);
  });

  it('lands again after a jump', () => {
    const s = playing(FLAT);
    tick(s, {}, 5);
    tick(s, { jump: true }, 1);
    tick(s, {}, 120);
    expect(s.player.onGround).toBe(true);
    expect(s.player.y).toBeCloseTo(4);
  });

  it('does not jump again while the button stays held', () => {
    const s = playing(FLAT);
    tick(s, {}, 5);
    tick(s, { jump: true }, 1);
    tick(s, {}, 120); // land
    expect(collect(s, { jump: true }, 30)).toEqual(['jump']);
  });

  it('jumps higher the longer the button is held', () => {
    const apex = (holdTicks: number) => {
      const s = playing(FLAT);
      tick(s, {}, 5);
      let top = s.player.y;
      for (let i = 0; i < 100; i++) {
        step(s, { ...NONE, jump: i < holdTicks });
        top = Math.min(top, s.player.y);
      }
      return 4 - top;
    };
    expect(apex(40)).toBeGreaterThan(apex(2) + 1);
  });

  it('allows a jump shortly after walking off a ledge (coyote time)', () => {
    const s = playing(LEDGE);
    tick(s, {}, 3);
    for (let i = 0; i < 200 && s.player.onGround; i++) tick(s, { right: true });
    expect(s.player.onGround).toBe(false);
    tick(s, { right: true, jump: true });
    expect(s.player.vy).toBeLessThan(0);
  });

  it('refuses a jump once coyote time has run out', () => {
    const s = playing(LEDGE);
    tick(s, {}, 3);
    for (let i = 0; i < 200 && s.player.onGround; i++) tick(s, { right: true });
    tick(s, { right: true }, Math.ceil((COYOTE_TIME / (1 / 60)) * 2));
    expect(collect(s, { right: true, jump: true }, 1)).not.toContain('jump');
  });

  it('remembers a jump pressed just before landing (jump buffer)', () => {
    const s = playing(FLAT);
    tick(s, {}, 3);
    Object.assign(s.player, { y: 3.7, vy: 5, onGround: false, coyote: 0 });
    const events = [...collect(s, { jump: true }, 1), ...collect(s, {}, 8)];
    expect(events).toContain('jump');
  });
});
