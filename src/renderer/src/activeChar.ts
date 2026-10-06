import type { Character } from '../../shared/types';
import { charKey } from '../../shared/live';

export { charKey };
/** Stable across sessions (survives level/fame changes) — the "preferred class". */
const classKey = (c: Character) => `${c.classId}-${c.className}`;

const KEY = 'overlayActiveKey';
const CLASS = 'overlayActiveClass';

export function rememberActive(c: Character): void {
  try {
    localStorage.setItem(KEY, charKey(c));
    localStorage.setItem(CLASS, classKey(c));
  } catch {
    /* non-fatal */
  }
}

/**
 * Choose the active character: the exact remembered one, else the remembered class
 * (survives stat/fame changes), else the first (most-progressed).
 * Pass an already-sorted list so the fallback is the top character.
 */
export function pickActive(characters: Character[]): Character | null {
  if (!characters.length) return null;
  let k: string | null = null;
  let ck: string | null = null;
  try {
    k = localStorage.getItem(KEY);
    ck = localStorage.getItem(CLASS);
  } catch {
    /* storage unavailable */
  }
  return (
    characters.find((c) => charKey(c) === k) ??
    characters.find((c) => classKey(c) === ck) ??
    characters[0]!
  );
}
