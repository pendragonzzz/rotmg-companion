import { useEffect, useState } from 'react';
import { DEFAULT_DESKTOP_SETTINGS, type DesktopSettings } from '../../../shared/desktop';
import { HOTKEY_ACTIONS } from '../../../shared/overlay';
import { classMax, dataManifest, dataSource, dungeons, exaltation, meta, sets } from '../gameData';
import type { DataStatus } from '../../../shared/gameDataBundle';
import type { CleanupReport } from '../../../main/cleanupRules';
import { timeAgo } from '../hooks';
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
  dataStatus,
  onDataStatus,
  cleanup,
  onCleanup,
  nav,
}: {
  dataStatus: DataStatus | null;
  onDataStatus: (s: DataStatus) => void;
  cleanup: CleanupReport | null;
  onCleanup: (r: CleanupReport) => void;
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
        <DesktopRows />
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
          <div className="kbd-row">
            <span>Search everything — pages, dungeons, items, actions</span>
            <kbd>Ctrl+K</kbd>
          </div>
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

      <Panel title="Game data & updates" icon="refresh">
        <div className="kbd-list">
          <div className="kbd-row">
            <span>Game data in use</span>
            <b>
              rev {dataManifest.revision} · {dataManifest.updated} · {dataSource === 'downloaded' ? 'auto-updated' : 'bundled'}
            </b>
          </div>
          <div className="kbd-row">
            <span>Last checked</span>
            <span>{dataStatus?.lastCheck ? timeAgo(dataStatus.lastCheck, now) : 'not yet this session'}</span>
          </div>
        </div>
        {dataStatus?.error && <p className="muted small bad-text">{dataStatus.error}</p>}
        {dataStatus?.pending && (
          <p className="small">
            Revision {dataStatus.pending.revision} is downloaded —{' '}
            <button className="link-btn small" onClick={() => void window.api.data.apply()}>
              apply now
            </button>
          </p>
        )}
        <p className="ov-note">
          Drop tables, sets and the meta refresh weekly from RealmEye and arrive here on their own — no reinstall. The app
          itself auto-updates from GitHub Releases and installs on quit.
        </p>
        <div className="row-chips">
          <button className="btn btn-ghost btn-sm" onClick={() => void window.api.data.check().then(onDataStatus)}>
            <Icon name="refresh" size={12} /> Check for new game data
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => void window.api.app.tidyNow().then(onCleanup)}>
            <Icon name="trash" size={12} /> Tidy old copies off my Desktop
          </button>
        </div>
        {cleanup?.ran && (
          <p className="muted small">
            {cleanup.removed.length
              ? `Last tidy moved ${cleanup.removed.map((r) => r.name).join(', ')} to the Recycle Bin.`
              : 'Last tidy found no old copies on your Desktop.'}
            {cleanup.prunedInstallers ? ` Pruned ${cleanup.prunedInstallers} applied installer(s).` : ''}
          </p>
        )}
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

/** Tray + Windows-startup toggles (stored by the main process). */
function DesktopRows() {
  const [d, setD] = useState<DesktopSettings>(DEFAULT_DESKTOP_SETTINGS);
  useEffect(() => {
    window.api.app.getDesktop().then(setD).catch(() => {});
  }, []);
  const patch = (p: Partial<DesktopSettings>) => {
    setD((cur) => ({ ...cur, ...p }));
    window.api.app.setDesktop(p).then(setD).catch(() => {});
  };
  return (
    <>
      <ToggleRow
        title="Keep running in the tray"
        hint="Closing the window leaves the overlay, live sync and game detection running — quit from the tray icon"
        on={d.closeToTray}
        onChange={(closeToTray) => patch({ closeToTray })}
      />
      <ToggleRow
        title="Start with Windows"
        hint="Ready before you launch the game"
        on={d.startWithWindows}
        onChange={(startWithWindows) => patch({ startWithWindows })}
      />
      {d.startWithWindows && (
        <ToggleRow
          title="…quietly, in the tray"
          hint={d.closeToTray ? 'No window at sign-in — click the tray icon to open' : 'Needs “Keep running in the tray”'}
          on={d.startHidden && d.closeToTray}
          onChange={(startHidden) => patch({ startHidden, ...(startHidden ? { closeToTray: true } : {}) })}
        />
      )}
    </>
  );
}
