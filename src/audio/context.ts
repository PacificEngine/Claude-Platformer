let shared: AudioContext | null = null;

/**
 * The one AudioContext for the whole game. Created on first use, which only
 * happens after a key press (browsers block audio before a user gesture).
 */
export function getAudioContext(): AudioContext {
  shared ??= new AudioContext();
  if (shared.state === 'suspended') void shared.resume();
  return shared;
}
