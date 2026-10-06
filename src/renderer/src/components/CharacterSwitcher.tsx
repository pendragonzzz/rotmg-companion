import { useEffect, useRef, useState } from 'react';
import type { Character } from '../../../shared/types';
import { charKey } from '../activeChar';
import { ClassSprite } from './ui';
import { Icon } from './Icon';

/** Top-bar picker for the ONE active character every page (and the overlay) plans for. */
export function CharacterSwitcher({
  characters,
  active,
  onSelect,
  empty = null,
  onEmptyClick,
}: {
  characters: Character[];
  active: Character | null;
  onSelect: (c: Character) => void;
  /** A profile loaded but RealmEye lists no characters: 'hidden' (privacy) or 'none'. */
  empty?: 'hidden' | 'none' | null;
  onEmptyClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (empty && onEmptyClick) {
    return (
      <div className="switcher" title="RealmEye shows no characters for this player — click for why and how to fix it">
        <button className="switcher-empty warn" onClick={onEmptyClick}>
          <Icon name="info" size={15} /> {empty === 'hidden' ? 'Characters hidden' : 'No characters on RealmEye'}
        </button>
      </div>
    );
  }
  if (!characters.length || !active) {
    return (
      <div className="switcher disabled" title="Load a player to pick a character">
        <span className="switcher-empty">
          <Icon name="user" size={15} /> No character
        </span>
      </div>
    );
  }

  return (
    <div className={`switcher ${open ? 'open' : ''}`} ref={ref}>
      <button className="switcher-btn" onClick={() => setOpen((o) => !o)} title="Active character (drives every page + the overlay)">
        <ClassSprite className={active.className} size={26} />
        <span className="switcher-text">
          <b>{active.className}</b>
          <span>
            {active.statsMaxed} · Lv {active.level}
          </span>
        </span>
        <Icon name="chevron" size={14} className={`chev ${open ? 'up' : ''}`} />
      </button>
      {open && (
        <div className="switcher-menu" role="listbox">
          {characters.map((c) => {
            const k = charKey(c);
            const on = k === charKey(active);
            return (
              <button
                key={k}
                role="option"
                aria-selected={on}
                className={`switcher-item ${on ? 'active' : ''}`}
                onClick={() => {
                  onSelect(c);
                  setOpen(false);
                }}
              >
                <ClassSprite className={c.className} size={22} />
                <span className="switcher-item-name">{c.className}</span>
                <span className={`maxed-badge ${c.maxedCount === 8 ? 'full' : ''}`}>{c.statsMaxed}</span>
                <span className="switcher-item-lv">Lv {c.level}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
