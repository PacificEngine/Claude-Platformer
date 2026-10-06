import { step } from '../core/game';
import { createGame } from '../core/state';
import type { EventType, GameState, Input } from '../core/types';
import { parseLevel } from '../levels/format';

export { levelText, pipeEdits, span, type Edit } from './level-text';

export const NONE: Input = { left: false, right: false, jump: false, run: false, down: false };

/** A game already in the `playing` phase on the given level texts. */
export function playing(...texts: string[]): GameState {
  const s = createGame(texts.map(parseLevel));
  s.phase = 'playing';
  return s;
}

export function tick(s: GameState, input: Partial<Input> = {}, n = 1): GameState {
  for (let i = 0; i < n; i++) step(s, { ...NONE, ...input });
  return s;
}

/** Runs n ticks and returns every event emitted along the way. */
export function collect(s: GameState, input: Partial<Input> = {}, n = 1): EventType[] {
  const seen: EventType[] = [];
  for (let i = 0; i < n; i++) {
    step(s, { ...NONE, ...input });
    seen.push(...s.events.map((e) => e.type));
  }
  return seen;
}

export function eventTypes(s: GameState): EventType[] {
  return s.events.map((e) => e.type);
}
