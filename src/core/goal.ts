import { DT, LEVEL_CLEAR_TIME, POINTS } from './constants';
import { emit } from './events';
import { overlaps } from './physics';
import { loadLevel } from './state';
import type { GameState } from './types';

export function checkGoal(s: GameState): void {
  if (!overlaps(s.player, s.flag)) return;
  s.phase = 'levelClear';
  s.phaseTimer = LEVEL_CLEAR_TIME;
  s.score += Math.floor(s.timeLeft) * POINTS.timeBonus;
  s.player.vx = 0;
  emit(s, 'flag');
}

export function stepLevelClear(s: GameState): void {
  s.phaseTimer -= DT;
  if (s.phaseTimer > 0) return;
  const next = s.levelIndex + 1;
  if (next < s.levels.length) {
    loadLevel(s, next, s.player.size);
    s.phase = 'playing';
  } else {
    s.phase = 'won';
  }
}
