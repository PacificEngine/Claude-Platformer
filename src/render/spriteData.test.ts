import { describe, expect, it } from 'vitest';
import { PALETTE, SPRITES } from './spriteData';

describe('sprite data', () => {
  const entries = Object.entries(SPRITES);

  it.each(entries)('%s is a rectangular grid of known colors', (_name, rows) => {
    expect([8, 16]).toContain(rows.length);
    for (const row of rows) {
      expect(row).toHaveLength(8);
      for (const ch of row) expect(ch === '.' || ch in PALETTE).toBe(true);
    }
  });

  it('has a big-player grid twice as tall as the small one', () => {
    expect(SPRITES.playerBigStand).toHaveLength(2 * SPRITES.playerSmallStand.length);
  });

  it('has jump poses matching the stand heights', () => {
    expect(SPRITES.playerSmallJump).toHaveLength(SPRITES.playerSmallStand.length);
    expect(SPRITES.playerBigJump).toHaveLength(SPRITES.playerBigStand.length);
  });

  it('has pipe, warp block and 1-up sprites', () => {
    for (const name of ['pipeTL', 'pipeTR', 'pipeL', 'pipeR', 'warpBlock', 'mushroomOneUp'] as const) {
      expect(SPRITES[name]).toHaveLength(8);
    }
  });
});
