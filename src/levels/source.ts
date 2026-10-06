import type { Level } from '../core/types';

export interface LevelSource {
  count(): number;
  get(index: number): Level;
}

export function fromLevels(levels: Level[]): LevelSource {
  return {
    count: () => levels.length,
    get: (index) => {
      if (index < 0 || index >= levels.length) throw new Error(`No level ${index}`);
      return levels[index];
    },
  };
}
