import { useState } from 'react';
import { HOTKEY_ACTIONS } from '../../../shared/overlay';
import { classMax, dungeons, exaltation, meta, sets } from '../gameData';
import { THEMES, type DeclinedApi, type Density, type OverlayApi, type Prefs, type RecentApi } from '../hooks';
import { PAGES, type Nav, type PageId } from '../pages';
import type { LiveState } from '../../../shared/live';
import { Icon } from './Icon';
import { LiveSettingsPanel } from './Live';
import { Panel, Segmented, ToggleRow } from './ui';

const hk = (a: string) => a.replace('CommandOrControl', 'Ctrl');

export function SettingsPage({
  prefs,
  setPrefs,
  resetPrefs,
  recent,
  declined,
  overlay,
  live,
  now,
  nav,
}: {
  live: LiveState | null;
  now: number;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  resetPrefs: () => void;
  recent: RecentApi;
  declined: DeclinedApi;
  overlay: OverlayApi;
  nav: Nav;
}) {
  const declinedClasses = Object.entries(declined.store).filter(([, ids]) => ids.length > 0);
  const declinedTotal = declinedClasses.reduce((n, [, ids]) => n + ids.length, 0);

  return (
    <div className="settings">
      <Panel title="Appearance" icon="layout" className="settings-wide">
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.value}
              className={`theme-card ${prefs.theme === t.value ? 'on' : ''}`}
              onClick={() => setPrefs({ theme: t.value })}
              aria-pressed={prefs.theme === t.value}
            >
              <span className="theme-preview" style={{ background: t.swatch[0] }}>
                <span className="theme-preview-panel" style={{ background: t.swatch[1] }}>
                  <span className="theme-preview-accent" style={{ background: t.swatch[2] }} />
                  <span className="theme-preview-line" />
                  <span className="theme-preview-line short" />
                </span>
              </span>
              <span className="theme-name">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="settings-row">
          <span className="settings-label">
            <strong>Density</strong>
            <em>Compact fits more on screen</em>
          </span>
          <Segmented<Density>
            value={prefs.density}
            onChange={(density) => setPrefs({ density })}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </div>
        <ToggleRow
          title="Collapse sidebar"
          hint="Icons only — more room for the page"
          on={prefs.sidebarCollapsed}
          onChange={(sidebarCollapsed) => setPrefs({ sidebarCollapsed })}
        />
      </Panel>

      <LiveSettingsPanel live={live} now={now} />

      <Panel title="Startup" icon="refresh">
        <ToggleRow
          title="Re-open my last player"
          hint={prefs.lastPlayer ? `Loads “${prefs.lastPlayer}” from RealmEye on launch` : 'Load a player once to enable'}
          on={prefs.autoLoad}
          onChange={(autoLoad) => setPrefs({ autoLoad })}
        />
        <div className="settings-row">
          <span className="settings-label">
            <strong>Open on</strong>
            <em>The page shown at launch</em>
          </span>
          <select
            className="select"
            value={prefs.startPage}
            onChange={(e) => setPrefs({ startPage: e.target.value as PageId | 'last' })}
          >
            <option value="last">Last page I used</option>
            {PAGES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      <Panel
        title="Overlay"
        icon="layout"
        actions={
          <button className="link-btn small" onClick={() => nav.go('overlay')}>
            Customize ▸
          </button>
        }
      >
        <ToggleRow
          title="Show the in-game overlay"
          hint="Transparent, click-through, always on top"
          on={overlay.settings.enabled}
          onChange={(enabled) => overlay.patch({ enabled })}
        />
        <div className="kbd-list">
          {HOTKEY_ACTIONS.map((a) => (
            <div key={a.key} className="kbd-row">
              <span>{a.label}</span>
              <kbd>{hk(overlay.settings.hotkeys[a.key])}</kbd>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Keyboard shortcuts" icon="keyboard">
        <div className="kbd-list">
          {PAGES.map((p, i) => (
            <div key={p.id} className="kbd-row">
              <span>{p.label}</span>
              <kbd>Ctrl+{i + 1}</kbd>
            </div>
          ))}
          <div className="kbd-row">
            <span>Search for a player</span>
            <span>
              <kbd>/</kbd> or <kbd>Ctrl+L</kbd>
            </span>
          </div>
          <div className="kbd-row">
            <span>Check RealmEye now (live sync)</span>
            <kbd>F5</kbd>
          </div>
        </div>
      </Panel>

      <Panel title="Your data" icon="trash">
        <div className="settings-sub">
          <div className="settings-sub-head">
            <strong>Recent players</strong>
            {recent.recent.length > 0 && (
              <button className="link-btn small" onClick={recent.clear}>
                Clear all
              </button>
            )}
          </div>
          {recent.recent.length ? (
            <div className="recent-row">
              {recent.recent.map((n) => (
                <span key={n} className="recent-chip static">
                  {n}
                  <button className="recent-x" onClick={() => recent.remove(n)} title="Remove">
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="muted small">None yet.</p>
          )}
        </div>
        <div className="settings-sub">
          <div className="settings-sub-head">
            <strong>Declined quests ({declinedTotal})</strong>
            {declinedTotal > 0 && (
              <button className="link-btn small" onClick={declined.clearAll}>
                Restore all
              </button>
            )}
          </div>
          {declinedClasses.length ? (
            declinedClasses.map(([cls, ids]) => (
              <div key={cls} className="kbd-row">
                <span className="cap">{cls}</span>
                <span>
                  {ids.length} hidden{' '}
                  <button className="link-btn small" onClick={() => declined.clearClass(cls)}>
                    restore
                  </button>
                </span>
              </div>
            ))
          ) : (
            <p className="muted small">Goals you ✕ on a character card are listed here.</p>
          )}
        </div>
        <ConfirmButton label="Reset all preferences" confirmLabel="Click again to reset" onConfirm={resetPrefs} />
      </Panel>

      <Panel title="About" icon="info">
        <div className="kbd-list">
          <div className="kbd-row">
            <span>App version</span>
            <b>v{__APP_VERSION__}</b>
          </div>
          <div className="kbd-row">
            <span>Game data researched</span>
            <b>{meta.asOf}</b>
          </div>
          <div className="kbd-row">
            <span>Tracked</span>
            <span>
              {dungeons.length} dungeons · {Object.keys(exaltation.dungeons).length} exalt dungeons · {sets.length} ST sets ·{' '}
              {Object.keys(classMax).length} classes
            </span>
          </div>
        </div>
        <p className="muted small">
          Informational only — the app never reads or automates the game client (that would break DECA&apos;s ToS). All data
          comes from public RealmEye pages.
        </p>
        <div className="row-chips">
          <button className="btn btn-ghost btn-sm" onClick={() => void window.api.openExternal('https://www.realmeye.com/')}>
            RealmEye <Icon name="external" size={12} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void window.api.openExternal('https://github.com/pendragonzzz/rotmg-companion/releases')}
          >
            Releases <Icon name="external" size={12} />
          </button>
        </div>
      </Panel>
    </div>
  );
}

/** Two-step button for destructive actions. */
function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      className={`btn btn-sm ${armed ? 'btn-danger' : 'btn-ghost'}`}
      onClick={() => {
        if (armed) {
          onConfirm();
          setArmed(false);
        } else setArmed(true);
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
