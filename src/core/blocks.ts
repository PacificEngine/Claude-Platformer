import { POINTS } from './constants';
import { emit } from './events';
import { makeMushroom } from './mushrooms';
import type { GameState } from './types';

export function addCoin(s: GameState): void {
  s.coins += 1;
  s.score += POINTS.coin;
  emit(s, 'coin');
  if (s.coins >= 100) {
    s.coins -= 100;
    s.lives += 1;
    emit(s, 'oneup');
  }
}

/** Called when the player's head hits the tile at (col, row). */
export function hitBlock(s: GameState, col: number, row: number): void {
  switch (s.tiles[row][col]) {
    case 'coinBlock':
      s.tiles[row][col] = 'used';
      addCoin(s);
      break;
    case 'mushroomBlock':
      s.tiles[row][col] = 'used';
      s.mushrooms.push(makeMushroom(col, row));
      emit(s, 'sprout');
      break;
    case 'brick':
      if (s.player.size === 'big') {
        s.tiles[row][col] = 'empty';
        s.score += POINTS.brick;
        emit(s, 'break');
      } else {
        emit(s, 'bump');
      }
      break;
    default:
      break;
  }
}
