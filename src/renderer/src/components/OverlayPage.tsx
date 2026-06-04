import { useEffect, useState, type KeyboardEvent } from 'react';
import type { Character } from '../../../shared/types';
import {
  DEFAULT_OVERLAY_SETTINGS,
  HOTKEY_ACTIONS,
  type OverlaySettings,
  type OverlayCorner,
  type OverlayWidgets,
  type OverlayHotkeys,
} from '../../../shared/overlay';
import type { DungeonGate } from '../../../shared/engine';
import dungeonsData from '../../../shared/data/dungeons.json';
import { OverlayHud } from './OverlayHud';
import { Dropdown } from './Dropdown';
import { charKey, pickActive, rememberActive } from '../activeChar';

const dungeonOpts = [
  { value: '', label: 'None' },
  ...(dungeonsData as DungeonGate[]).map((d) => ({ value: d.id, label: d.name })),
];
const hk = (a: string) => a.replace('CommandOrControl', 'Ctrl');

const CORNERS: { value: OverlayCorner; label: string }[] = [
  { value: 'top-left', label: 'Top-left' },
  { value: 'top-center', label: 'Top-center' },
  { value: 'top-right', label: 'Top-right' },
  { value: 'left-center', label: 'Left-center' },
  { value: 'right-center', label: 'Right-center' },
  { value: 'bottom-left', label: 'Bottom-left' },
  { value: 'bottom-center', label: 'Bottom-center' },
  { value: 'bottom-right', label: 'Bottom-right' },
];
const WIDGET_LABELS: { key: keyof OverlayWidgets; label: string; hint: string }[] = [
  { key: 'header', label: 'Character header', hint: 'Class sprite, level, n/8' },
  { key: 'target', label: 'Target biome / beacon', hint: 'Where to head + dungeon to enter' },
  { key: 'beacons', label: 'Beacons to farm', hint: 'All beacons across your goals + what they give' },
  { key: 'goals', label: 'Next goals', hint: 'The prioritized to-do list' },
  { key: 'setToFarm', label: 'Recommended set', hint: 'Best ST set to farm' },
  { key: 'locations', label: 'Where-to-farm tags', hint: 'Dungeon/biome on each line' },
  { key: 'currentDungeon', label: 'Current-dungeon card', hint: 'Drops + strategy for the dungeon set below' },
];

export function OverlayPage({ characters }: { characters: Character[] }) {
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_OVERLAY_SETTINGS);
  const [selectedKey, setSelectedKey] = useState<string>('');

  useEffect(() => {
    window.api.overlay.getState().then((s) => setSettings(s.settings)).catch(() => {});
    return window.api.overlay.onState((s) => setSettings(s.settings));
  }, []);

  const active = characters.find((c) => charKey(c) === selectedKey) ?? pickActive(characters);
  const activeId = active ? charKey(active) : '';
  useEffect(() => {
    window.api.overlay.setCharacter(active ?? null).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const patch = (p: Partial<OverlaySettings>) => {
    setSettings((s) => ({ ...s, ...p }));
    window.api.overlay.setSettings(p).catch(() => {});
  };
  const patchWidget = (k: keyof OverlayWidgets, v: boolean) =>
    patch({ widgets: { ...settings.widgets, [k]: v } });

  const charOpts = characters.map((c) => ({ value: charKey(c), label: `${c.className} · ${c.statsMaxed} · Lv ${c.level}` }));

  return (
    <>
      <div className="profile-head">
        <h1>Game Overlay</h1>
        <div className="profile-meta">
          <span>
            Click-through HUD over the game. Toggle <kbd>{hk(settings.hotkeys.toggle)}</kbd> · Peek{' '}
            <kbd>{hk(settings.hotkeys.peek)}</kbd> · Quick-pick <kbd>{hk(settings.hotkeys.picker)}</kbd>
          </span>
        </div>
      </div>

      <div className="ov-page">
        <div className="ov-controls">
          <label className="ov-switch-row">
            <span>
              <strong>Show overlay</strong>
              <em>The transparent HUD window</em>
            </span>
            <button
              className={`switch ${settings.enabled ? 'on' : ''}`}
              onClick={() => patch({ enabled: !settings.enabled })}
              aria-pressed={settings.enabled}
            >
              <span className="knob" />
            </button>
          </label>

          <div className="ov-field">
            <label>Active character</label>
            {characters.length ? (
              <Dropdown
                value={activeId}
                options={charOpts}
                onChange={(v) => {
                  setSelectedKey(v);
                  const c = characters.find((x) => charKey(x) === v);
                  if (c) rememberActive(c);
                }}
              />
            ) : (
              <p className="muted">Load a player on the Characters tab first.</p>
            )}
            <p className="ov-note">
              The app can&apos;t read the game (ToS), so pick which loaded character you&apos;re playing — the
              overlay shows its goals.
            </p>
          </div>

          <div className="ov-field">
            <label>Position</label>
            <Dropdown value={settings.corner} options={CORNERS} onChange={(v) => patch({ corner: v as OverlayCorner })} />
          </div>

          <div className="ov-field">
            <label>Opacity — {Math.round(settings.opacity * 100)}%</label>
            <input type="range" min={0.3} max={1} step={0.02} value={settings.opacity}
              onChange={(e) => patch({ opacity: Number(e.target.value) })} />
          </div>
          <div className="ov-field">
            <label>Scale — {settings.scale.toFixed(2)}×</label>
            <input type="range" min={0.8} max={1.5} step={0.05} value={settings.scale}
              onChange={(e) => patch({ scale: Number(e.target.value) })} />
          </div>
          <div className="ov-field">
            <label>Goals shown — {settings.maxGoals}</label>
            <input type="range" min={1} max={6} step={1} value={settings.maxGoals}
              onChange={(e) => patch({ maxGoals: Number(e.target.value) })} />
          </div>

          <div className="ov-field">
            <label>Current dungeon</label>
            <Dropdown
              value={settings.currentDungeon}
              options={dungeonOpts}
              onChange={(v) => patch({ currentDungeon: v })}
            />
            <p className="ov-note">
              Or press <kbd>{hk(settings.hotkeys.picker)}</kbd> in-game to open the quick-pick menu (search +
              ★ favorites) — no alt-tab needed.
            </p>
          </div>

          <label className="ov-check">
            <input type="checkbox" checked={settings.compact} onChange={(e) => patch({ compact: e.target.checked })} />
            Compact (titles only)
          </label>

          <div className="ov-field">
            <label>Show widgets</label>
            <div className="ov-widgets">
              {WIDGET_LABELS.map((w) => (
                <label key={w.key} className="ov-check" title={w.hint}>
                  <input
                    type="checkbox"
                    checked={settings.widgets[w.key]}
                    onChange={(e) => patchWidget(w.key, e.target.checked)}
                  />
                  {w.label}
                </label>
              ))}
            </div>
          </div>

          <div className="ov-field">
            <label>Hotkeys</label>
            <div className="ov-hotkeys">
              {HOTKEY_ACTIONS.map((a) => (
                <div className="ov-hotkey-row" key={a.key}>
                  <span>{a.label}</span>
                  <HotkeyInput
                    value={settings.hotkeys[a.key]}
                    onChange={(accel) => patch({ hotkeys: { ...settings.hotkeys, [a.key]: accel } })}
                  />
                </div>
              ))}
            </div>
            <p className="ov-note">Click a binding, then press your combo (Esc cancels). Include a modifier (Ctrl/Alt/Shift) so it fires while the game is focused.</p>
          </div>
        </div>

        <div className="ov-preview">
          <div className="ov-preview-label">Live preview</div>
          <div className={`ov-preview-stage corner-${settings.corner}`}>
            <OverlayHud character={active} settings={{ ...settings, opacity: 1 }} />
          </div>
        </div>
      </div>
    </>
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
