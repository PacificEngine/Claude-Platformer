import type { EventType, GameState } from './types';

export function emit(s: GameState, type: EventType): void {
  s.events.push({ type });
}
