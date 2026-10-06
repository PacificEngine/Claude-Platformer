import { addCoin } from './blocks';
import { overlaps } from './physics';
import type { GameState } from './types';

export function collectCoins(s: GameState): void {
  s.coinPickups = s.coinPickups.filter((cell) => {
    const rect = { x: cell.col + 0.25, y: cell.row + 0.25, w: 0.5, h: 0.5 };
    if (!overlaps(s.player, rect)) return true;
    addCoin(s);
    return false;
  });
}
