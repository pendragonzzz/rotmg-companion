import { useEffect, useRef, useState } from 'react';
import type { Character } from '../../../shared/types';
import { LIVE_INTERVALS, type LiveEvent, type LiveEventKind, type LiveState } from '../../../shared/live';
import { charKey } from '../activeChar';
import { timeAgo } from '../hooks';
import { Icon, type IconName } from './Icon';
import { ClassSprite, Panel, Segmented, Switch } from './ui';

const KIND_ICON: Record<LiveEventKind, IconName> = {
  maxed: 'up',
  gear: 'att',
  level: 'star',
  pots: 'flask',
  new: 'user',
  gone: 'info',
  exalts: 'exalt',
};

const intervalLabel = (s: number) => (s < 60 ? `${s}s` : `${Math.round(s / 60)} min`);

/** Status line for the live feed, e.g. "Checked 40s ago · last change 3m ago". */
function statusText(live: LiveState, now: number): string {
  if (!live.player) return 'Load a player to start live sync';
  if (live.status === 'syncing') return 'Checking RealmEye…';
  if (live.status === 'error') return live.error ?? 'RealmEye check failed — retrying';
  const parts = [live.syncedAt ? `Checked ${timeAgo(live.syncedAt, now)}` : 'Not checked yet'];
  if (live.lastChanged) parts.push(`last change ${timeAgo(live.lastChanged, now)}`);
  return parts.join(' · ');
}

/** Top-bar "● Live" badge with a popover of controls. */
export function LiveBadge({ live, now, onOpenFeed }: { live: LiveState | null; now: number; onOpenFeed: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  if (!live) return null;

  const on = live.settings.enabled;
  const label = !on ? 'Paused' : live.status === 'syncing' ? 'Syncing' : live.status === 'error' ? 'Retrying' : 'Live';
  return (
    <div className={`live ${open ? 'open' : ''}`} ref={ref}>
      <button
        className={`live-badge st-${on ? live.status : 'paused'}`}
        onClick={() => setOpen((o) => !o)}
        title={`Live sync — ${statusText(live, now)}`}
      >
        <span className="live-dot" />
        {label}
      </button>
      {open && (
        <div className="live-pop">
          <div className="live-pop-row">
            <span>
              <strong>Live sync</strong>
              <em>Re-reads your RealmEye profile in the background</em>
            </span>
            <Switch on={on} onChange={(enabled) => void window.api.live.configure({ enabled })} label="Live sync" />
          </div>
          <div className="live-pop-row">
            <span className="muted small">Check every</span>
            <Segmented<string>
              value={String(live.settings.intervalSec)}
              onChange={(v) => void window.api.live.configure({ intervalSec: Number(v) })}
              options={LIVE_INTERVALS.map((s) => ({ value: String(s), label: intervalLabel(s) }))}
            />
          </div>
          <div className={`live-pop-status ${live.status === 'error' ? 'bad' : ''}`}>{statusText(live, now)}</div>
          <div className="live-pop-actions">
            <button className="btn btn-sm btn-primary" disabled={!live.player || live.status === 'syncing'} onClick={() => void window.api.live.syncNow()}>
              <Icon name="refresh" size={13} /> Check now
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                onOpenFeed();
                setOpen(false);
              }}
            >
              Activity ({live.feed.length})
            </button>
          </div>
          <p className="ov-note">
            Reads only your <b>public RealmEye page</b> (characters, stats, equipped items, exalts). It never touches the
            game client — that breaks DECA&apos;s ToS. RealmEye updates on its own schedule, so changes land when RealmEye
            has them.
          </p>
        </div>
      )}
    </div>
  );
}

/** Bottom-right toast stack for new live events. */
export function Toasts({ toasts, onDismiss }: { toasts: LiveEvent[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast kind-${t.kind}`}>
          <span className="toast-icon">
            <Icon name={KIND_ICON[t.kind]} size={15} />
          </span>
          <div className="toast-body">
            <strong>{t.title}</strong>
            {t.detail && <span>{t.detail}</span>}
          </div>
          <button className="toast-x" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/** Characters-page panel: what changed, newest first. Click a character event to make it active. */
export function ActivityFeed({
  live,
  now,
  characters,
  onSelect,
}: {
  live: LiveState;
  now: number;
  characters: Character[];
  onSelect: (c: Character) => void;
}) {
  const byKey = new Map(characters.map((c) => [charKey(c), c]));
  return (
    <Panel
      title="Live activity"
      icon="refresh"
      className="activity"
      actions={
        <>
          <span className={`muted small ${live.status === 'error' ? 'bad-text' : ''}`}>{statusText(live, now)}</span>
          {live.feed.length > 0 && (
            <button className="link-btn small" onClick={() => void window.api.live.clearFeed()}>
              Clear
            </button>
          )}
        </>
      }
    >
      {live.feed.length === 0 ? (
        <p className="muted small">
          {live.settings.enabled
            ? `Watching RealmEye every ${intervalLabel(live.settings.intervalSec)}. Drink a pot or swap gear and it shows up here — and every plan updates.`
            : 'Live sync is paused — turn it on from the ● badge in the top bar.'}
        </p>
      ) : (
        <div className="feed">
          {live.feed.slice(0, 8).map((e) => {
            const c = byKey.get(e.charKey);
            return (
              <button key={e.id} className={`feed-row kind-${e.kind}`} onClick={() => c && onSelect(c)} disabled={!c} title={c ? 'Make this the active character' : undefined}>
                {e.className ? <ClassSprite className={e.className} size={22} /> : <span className="feed-icon"><Icon name={KIND_ICON[e.kind]} size={13} /></span>}
                <span className="feed-text">
                  <strong>{e.title}</strong>
                  {e.detail && <span className="muted small">{e.detail}</span>}
                </span>
                <span className="feed-time muted small">{timeAgo(e.at, now)}</span>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/** Settings-page panel for live sync. */
export function LiveSettingsPanel({ live, now }: { live: LiveState | null; now: number }) {
  if (!live) return null;
  return (
    <Panel title="Live sync" icon="refresh">
      <div className="toggle-row">
        <span className="toggle-text">
          <strong>Keep my characters in sync</strong>
          <em>Re-reads your public RealmEye page in the background and re-plans everything that changed</em>
        </span>
        <Switch on={live.settings.enabled} onChange={(enabled) => void window.api.live.configure({ enabled })} label="Live sync" />
      </div>
      <div className="settings-row">
        <span className="settings-label">
          <strong>Check every</strong>
          <em>RealmEye asks for polite polling — 1 minute minimum</em>
        </span>
        <Segmented<string>
          value={String(live.settings.intervalSec)}
          onChange={(v) => void window.api.live.configure({ intervalSec: Number(v) })}
          options={LIVE_INTERVALS.map((s) => ({ value: String(s), label: intervalLabel(s) }))}
        />
      </div>
      <p className="muted small">{statusText(live, now)}</p>
      <p className="ov-note">
        What it can see: characters, levels, fame, base stats (so every pot you drink), the 4 equipped items, pets and
        account exaltations — exactly what RealmEye shows publicly. Inventory and vault aren&apos;t public, and the app
        never reads the game client (DECA bans for that).
      </p>
    </Panel>
  );
}
