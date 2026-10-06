import { useState, type KeyboardEvent } from 'react';
import type { Character } from '../../../shared/types';
import {
  HOTKEY_ACTIONS,
  OVERLAY_PRESETS,
  type OverlayCorner,
  type OverlayDungeonCard,
  type OverlayWidgets,
} from '../../../shared/overlay';
import type { DungeonCategory } from '../../../shared/engine';
import { dungeons } from '../gameData';
import type { OverlayApi } from '../hooks';
import type { Nav } from '../pages';
import { OverlayHud } from './OverlayHud';
import { Icon } from './Icon';
import { ClassSprite, Panel, ToggleRow } from './ui';

const hk = (a: string) => a.replace('CommandOrControl', 'Ctrl');

/** 3×3 anchor grid (center cell unused). */
const GRID: (OverlayCorner | null)[] = [
  'top-left', 'top-center', 'top-right',
  'left-center', null, 'right-center',
  'bottom-left', 'bottom-center', 'bottom-right',
];

const WIDGETS: { key: keyof OverlayWidgets; label: string; hint: string }[] = [
  { key: 'header', label: 'Character header', hint: 'Class sprite, level, n/8' },
  { key: 'target', label: 'Target biome / beacon', hint: 'Where to head + the dungeon to enter' },
  { key: 'beacons', label: 'Beacons to farm', hint: 'Every beacon across your goals + what it drops' },
  { key: 'goals', label: 'Next goals', hint: 'The prioritized to-do list' },
  { key: 'locations', label: 'Where-to-farm tags', hint: 'Dungeon name on each goal' },
  { key: 'setToFarm', label: 'Recommended set', hint: 'Best ST set to farm' },
  { key: 'currentDungeon', label: 'Current-dungeon card', hint: 'Details for the dungeon you picked' },
  { key: 'liveToasts', label: 'Live change toasts', hint: 'Flash pots maxed / gear equipped as RealmEye syncs' },
];

/** Shown in the preview so the toast style is visible before a real change arrives. */
const SAMPLE_TOAST = { title: 'Live: Defense maxed!', detail: 'Changes RealmEye picks up flash here for 8s', more: 0, at: 0 };

const CARD: { key: keyof OverlayDungeonCard; label: string; hint: string }[] = [
  { key: 'strategy', label: 'Strategy tip', hint: 'The one mechanic that matters' },
  { key: 'exalt', label: 'Exalt stat', hint: 'If the dungeon grants one' },
  { key: 'pots', label: 'Potions', hint: 'Regular + Greater (marked +)' },
  { key: 'drops', label: 'UT / ST drops', hint: 'Top 4 by score' },
  { key: 'classDropsOnly', label: 'Only my class’s drops', hint: 'Hide gear the active class can’t use' },
  { key: 'keyItems', label: 'Key items', hint: 'O3 runes, Wine Cellar incantations' },
];

const CAT_ORDER: DungeonCategory[] = ['starter', 'low', 'mid', 'high', 'endgame'];

export function OverlayPage({ character, overlay, nav }: { character: Character | null; overlay: OverlayApi; nav: Nav }) {
  const { settings, patch } = overlay;

  return (
    <div className="ov-page">
      <div className="ov-controls">
        <Panel title="Status" icon="layout">
          <ToggleRow
            title="Show overlay"
            hint="Transparent, click-through, always on top of the game"
            on={settings.enabled}
            onChange={(enabled) => patch({ enabled })}
          />
          <div className="ov-active">
            {character ? (
              <>
                <ClassSprite className={character.className} size={26} />
                <span>
                  Following <b>{character.className}</b> · {character.statsMaxed} · Lv {character.level}
                </span>
              </>
            ) : (
              <span className="muted">No character yet — load a player first.</span>
            )}
            <span className="muted small">Switch in the top bar</span>
          </div>
          <p className="ov-note">
            The app can&apos;t read the game (that would break DECA&apos;s ToS), so the overlay follows the character
            you pick here and the dungeon you choose with <kbd>{hk(settings.hotkeys.picker)}</kbd>.
          </p>
        </Panel>

        <Panel title="Layout presets" icon="star">
          <div className="preset-grid">
            {OVERLAY_PRESETS.map((p) => (
              <button key={p.id} className="preset" onClick={() => patch(p.apply)}>
                <b>{p.label}</b>
                <span>{p.hint}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Position & size" icon="pin">
          <div className="pos-row">
            <div className="pos-grid" role="radiogroup" aria-label="Overlay position">
              {GRID.map((c, i) =>
                c ? (
                  <button
                    key={c}
                    role="radio"
                    aria-checked={settings.corner === c}
                    className={`pos-cell ${settings.corner === c ? 'on' : ''}`}
                    onClick={() => patch({ corner: c })}
                    title={c.replace('-', ' ')}
                  />
                ) : (
                  <span key={`x${i}`} className="pos-cell void" />
                ),
              )}
            </div>
            <div className="pos-sliders">
              <Slider label={`Opacity — ${Math.round(settings.opacity * 100)}%`} min={0.3} max={1} step={0.02} value={settings.opacity} onChange={(opacity) => patch({ opacity })} />
              <Slider label={`Scale — ${settings.scale.toFixed(2)}×`} min={0.8} max={1.5} step={0.05} value={settings.scale} onChange={(scale) => patch({ scale })} />
              <Slider label={`Goals shown — ${settings.maxGoals}`} min={1} max={6} step={1} value={settings.maxGoals} onChange={(maxGoals) => patch({ maxGoals })} />
            </div>
          </div>
          <ToggleRow title="Compact goals" hint="Titles only, no detail line" on={settings.compact} onChange={(compact) => patch({ compact })} />
        </Panel>

        <Panel title="Widgets" icon="sets">
          {WIDGETS.map((w) => (
            <ToggleRow
              key={w.key}
              title={w.label}
              hint={w.hint}
              on={settings.widgets[w.key]}
              onChange={(v) => patch({ widgets: { ...settings.widgets, [w.key]: v } })}
            />
          ))}
        </Panel>

        <Panel
          title="Dungeon card"
          icon="castle"
          actions={
            <button className="link-btn small" onClick={() => nav.go('dungeons')}>
              Browse dungeons ▸
            </button>
          }
        >
          <div className="settings-row">
            <span className="settings-label">
              <strong>Current dungeon</strong>
              <em>
                Or press <kbd>{hk(settings.hotkeys.picker)}</kbd> in-game
              </em>
            </span>
            <select className="select" value={settings.currentDungeon} onChange={(e) => patch({ currentDungeon: e.target.value })}>
              <option value="">None</option>
              {CAT_ORDER.map((cat) => (
                <optgroup key={cat} label={cat[0]!.toUpperCase() + cat.slice(1)}>
                  {dungeons
                    .filter((d) => d.category === cat)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
          {CARD.map((c) => (
            <ToggleRow
              key={c.key}
              title={c.label}
              hint={c.hint}
              on={settings.dungeonCard[c.key]}
              onChange={(v) => patch({ dungeonCard: { ...settings.dungeonCard, [c.key]: v } })}
            />
          ))}
        </Panel>

        <Panel title="Behavior & hotkeys" icon="keyboard">
          <ToggleRow
            title="Peek when something changes"
            hint="Pop the HUD up with the live toast even while it's hidden"
            on={settings.peekOnChange}
            onChange={(peekOnChange) => patch({ peekOnChange })}
          />
          <Slider
            label={`Peek lasts — ${settings.peekSeconds}s`}
            min={2}
            max={15}
            step={1}
            value={settings.peekSeconds}
            onChange={(peekSeconds) => patch({ peekSeconds })}
          />
          <div className="ov-hotkeys">
            {HOTKEY_ACTIONS.map((a) => (
              <div className="ov-hotkey-row" key={a.key}>
                <span>{a.label}</span>
                <HotkeyInput value={settings.hotkeys[a.key]} onChange={(accel) => patch({ hotkeys: { ...settings.hotkeys, [a.key]: accel } })} />
              </div>
            ))}
          </div>
          <p className="ov-note">
            Click a binding, then press your combo (Esc cancels). Include Ctrl/Alt/Shift so it fires while the game has focus.
          </p>
        </Panel>
      </div>

      <div className="ov-preview">
        <div className="ov-preview-label">
          <Icon name="layout" size={12} /> Live preview
          <span className={`pill ${settings.enabled ? 'on' : ''}`}>{settings.enabled ? 'Overlay on' : 'Overlay off'}</span>
        </div>
        <div className={`ov-preview-stage corner-${settings.corner}`}>
          <OverlayHud character={character} settings={{ ...settings, opacity: 1 }} toast={character ? SAMPLE_TOAST : null} />
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** Translate a browser keydown into an Electron accelerator (null = modifier-only / cancel). */
function eventToAccelerator(e: KeyboardEvent): string | null {
  const k = e.key;
  if (k === 'Escape' || ['Control', 'Alt', 'Shift', 'Meta'].includes(k)) return null;
  const mods: string[] = [];
  if (e.ctrlKey) mods.push('CommandOrControl');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  if (e.metaKey) mods.push('Super');
  let key: string;
  if (k === ' ') key = 'Space';
  else if (k.startsWith('Arrow')) key = k.slice(5);
  else if (k.length === 1) key = k.toUpperCase();
  else key = k; // F1–F12, Tab, Home, etc.
  return [...mods, key].join('+');
}

function HotkeyInput({ value, onChange }: { value: string; onChange: (a: string) => void }) {
  const [capturing, setCapturing] = useState(false);
  const onKeyDown = (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') return setCapturing(false);
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return; // wait for a real key
    const a = eventToAccelerator(e);
    if (a) {
      onChange(a);
      setCapturing(false);
    }
  };
  return (
    <button
      type="button"
      className={`hotkey-btn ${capturing ? 'capturing' : ''}`}
      onClick={() => setCapturing((c) => !c)}
      onBlur={() => setCapturing(false)}
      onKeyDown={capturing ? onKeyDown : undefined}
    >
      {capturing ? 'Press keys…' : hk(value)}
    </button>
  );
}
