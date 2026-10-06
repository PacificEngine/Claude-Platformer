export type PointerAction = 'left' | 'right' | 'down' | 'jump';

export interface PointerTracker {
  /** Record which action (or none) a finger is on; replaces its previous action. */
  track(pointerId: number, action: PointerAction | null): void;
  /** Forget a finger that lifted or was cancelled. */
  release(pointerId: number): void;
  releaseAll(): void;
  isHeld(action: PointerAction): boolean;
}

export function createPointerTracker(): PointerTracker {
  const fingers = new Map<number, PointerAction>();
  return {
    track(pointerId, action) {
      if (action === null) fingers.delete(pointerId);
      else fingers.set(pointerId, action);
    },
    release(pointerId) {
      fingers.delete(pointerId);
    },
    releaseAll() {
      fingers.clear();
    },
    isHeld(action) {
      return [...fingers.values()].includes(action);
    },
  };
}
