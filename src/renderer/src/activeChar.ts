import type { Character } from '../../shared/types';

/** Unique-ish within a session (distinguishes same-class characters). */
export const charKey = (c: Character) => `${c.classId}-${c.className}-${c.level}-${c.fame}`;
/** Stable across sessions (survives level/fame changes) — the "preferred class". */
const classKey = (c: Character) => `${c.classId}-${c.className}`;

const KEY = 'overlayActiveKey';
const CLASS = 'overlayActiveClass';

export function rememberActive(c: Character): void {
  localStorage.setItem(KEY, charKey(c));
  localStorage.setItem(CLASS, classKey(c));
}

/**
 * Choose the active character for the overlay: the exact remembered one, else the
 * remembered class (survives stat/fame changes), else the first (most-progressed).
 * Pass an already-sorted list so the fallback is the top character.
 */
export function pickActive(characters: Character[]): Character | null {
  if (!characters.length) return null;
  const k = localStorage.getItem(KEY);
  const ck = localStorage.getItem(CLASS);
  return (
    characters.find((c) => charKey(c) === k) ??
    characters.find((c) => classKey(c) === ck) ??
    characters[0]!
  );
}
