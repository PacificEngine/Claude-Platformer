import { describe, expect, it } from 'vitest';
import { createMemorySaveStore, recordProgress } from './store';

describe('recordProgress', () => {
  it('starts fresh when nothing was saved', () => {
    expect(recordProgress(null, 1, 500)).toEqual({ version: 1, highestLevel: 1, bestScore: 500 });
  });

  it('never lowers an existing best', () => {
    const prev = { version: 1 as const, highestLevel: 2, bestScore: 900 };
    expect(recordProgress(prev, 1, 500)).toEqual(prev);
  });

  it('raises whichever value improved', () => {
    const prev = { version: 1 as const, highestLevel: 1, bestScore: 900 };
    expect(recordProgress(prev, 2, 100)).toEqual({ version: 1, highestLevel: 2, bestScore: 900 });
  });
});

describe('createMemorySaveStore', () => {
  it('has nothing saved at first', () => {
    expect(createMemorySaveStore().load()).toBeNull();
  });

  it('returns what was saved, as a copy', () => {
    const store = createMemorySaveStore();
    const data = { version: 1 as const, highestLevel: 1, bestScore: 10 };
    store.save(data);
    const loaded = store.load();
    expect(loaded).toEqual(data);
    expect(loaded).not.toBe(data);
  });
});
