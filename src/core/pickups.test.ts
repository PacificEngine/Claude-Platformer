import { describe, expect, it } from 'vitest';
import { collect, levelText, playing } from '../testing/helpers';

describe('coin pickups', () => {
  it('collects a coin the player walks through', () => {
    const s = playing(levelText(30, [[3, 4, 'c']]));
    const events = collect(s, { right: true }, 40);
    expect(s.coins).toBe(1);
    expect(s.score).toBe(100);
    expect(s.coinPickups).toHaveLength(0);
    expect(events).toContain('coin');
  });

  it('leaves coins the player never touches', () => {
    const s = playing(levelText(30, [[20, 4, 'c']]));
    collect(s, { right: true }, 10);
    expect(s.coinPickups).toHaveLength(1);
  });
});
