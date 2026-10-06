import type { Player } from './types';

/** Both keep the player's feet in place. */
export function growPlayer(p: Player): void {
  if (p.size === 'big') return;
  p.size = 'big';
  p.h = 2;
  p.y -= 1;
}

export function shrinkPlayer(p: Player): void {
  if (p.size === 'small') return;
  p.size = 'small';
  p.h = 1;
  p.y += 1;
}
