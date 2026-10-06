import { describe, expect, it } from 'vitest';
import { levelText, pipeEdits, playing, tick } from '../testing/helpers';
import type { GameState } from './types';

function scriptedRun(): GameState {
  const s = playing(levelText(60, [[20, 4, 'g'], [8, 3, '?']]));
  for (let i = 0; i < 300; i++) tick(s, { right: true, run: true, jump: i % 40 < 12 });
  return s;
}

describe('determinism', () => {
  it('replays the same inputs to the same state', () => {
    expect(scriptedRun()).toEqual(scriptedRun());
  });

  it('keeps state plain data that survives a JSON round trip', () => {
    const s = scriptedRun();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('survives a JSON round trip in the middle of a warp', () => {
    const s = playing(levelText(40, [...pipeEdits(8, '1'), ...pipeEdits(30, '2')], 6, ['warp 1 -> 2']));
    s.player.x = 9 - s.player.w / 2;
    s.player.y = 2;
    tick(s, {}, 3);
    tick(s, { down: true }, 1);
    tick(s, {}, 10);
    expect(s.phase).toBe('warping');
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
