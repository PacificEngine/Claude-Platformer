import type { Input } from '../core/types';
import type { InputSource } from './keyboard';

/** An input source that presses a field whenever any of the given sources does. */
export function combineInputs(...sources: InputSource[]): InputSource {
  return {
    poll(): Input {
      const all: Input = { left: false, right: false, jump: false, run: false, down: false };
      for (const source of sources) {
        const next = source.poll();
        all.left ||= next.left;
        all.right ||= next.right;
        all.jump ||= next.jump;
        all.run ||= next.run;
        all.down ||= next.down;
      }
      return all;
    },
  };
}
