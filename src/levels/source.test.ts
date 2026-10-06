import { describe, expect, it } from 'vitest';
import { levelText } from '../testing/level-text';
import { parseLevel } from './format';
import { fromLevels } from './source';

describe('fromLevels', () => {
  const levels = [parseLevel(levelText(10)), parseLevel(levelText(12))];

  it('reports how many levels it holds', () => {
    expect(fromLevels(levels).count()).toBe(2);
  });

  it('returns levels by index', () => {
    expect(fromLevels(levels).get(1).width).toBe(12);
  });

  it('rejects an index out of range', () => {
    expect(() => fromLevels(levels).get(2)).toThrow(/level 2/i);
  });
});
