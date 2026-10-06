export interface SaveData {
  version: 1;
  highestLevel: number;
  bestScore: number;
}

export interface SaveStore {
  load(): SaveData | null;
  save(data: SaveData): void;
}

export function createMemorySaveStore(): SaveStore {
  let saved: SaveData | null = null;
  return {
    load: () => (saved ? { ...saved } : null),
    save: (data) => {
      saved = { ...data };
    },
  };
}

export function recordProgress(prev: SaveData | null, levelIndex: number, score: number): SaveData {
  return {
    version: 1,
    highestLevel: Math.max(prev?.highestLevel ?? 0, levelIndex),
    bestScore: Math.max(prev?.bestScore ?? 0, score),
  };
}
