import { describe, expect, it } from 'vitest';
import { START_LIVES } from '../core/constants';
import { createGame } from '../core/state';
import { step } from '../core/game';
import type { GameState } from '../core/types';
import { createBot } from '../testing/bot';
import { parseLevel, serializeLevel } from './format';
import { builtinLevelTexts, builtinLevels } from './builtin';

describe('built-in levels', () => {
  it('ships three levels', () => {
    expect(builtinLevels.count()).toBe(3);
  });

  it.each(builtinLevelTexts.map((text, i) => [i + 1, text] as const))(
    'level %i is valid text that round-trips',
    (_n, text) => {
      expect(serializeLevel(parseLevel(text))).toBe(text.trim());
    },
  );
});

describe('replay: every level is completable', () => {
  const MAX_TICKS = 60 * 90;

  it.each([0, 1, 2])('a simple bot beats level %i without dying', (index) => {
    const s = createGame([builtinLevels.get(index)]);
    s.phase = 'playing' as GameState['phase']; // widen: TS narrows the literal and rejects the loop test
    const bot = createBot();
    while (s.phase !== 'won' && s.phase !== 'gameOver' && s.tick < MAX_TICKS) {
      step(s, bot(s));
    }
    expect({ phase: s.phase, lives: s.lives, x: Math.round(s.player.x) }).toMatchObject({
      phase: 'won',
      lives: START_LIVES,
    });
  });
});
