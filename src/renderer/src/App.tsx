import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Character, PlayerProfile } from '../../shared/types';
import { gearPlan, potionPlan } from '../../shared/planner';
import { carryCharacter, type LiveEvent, type LiveState } from '../../shared/live';
import { charKey, pickActive, rememberActive } from './activeChar';
import { plannerData } from './gameData';
import { PAGES, pageDef, type Nav, type PageId } from './pages';
import { timeAgo, useDeclined, useNow, useOverlaySettings, usePrefs, useRecentPlayers } from './hooks';
import { Sidebar } from './components/Sidebar';
import { CharacterSwitcher } from './components/CharacterSwitcher';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Icon } from './components/Icon';
import { CharactersPage } from './components/CharactersPage';
import { PotionsPage } from './components/PotionsPage';
import { GearPage } from './components/GearPage';
import { DungeonsPage } from './components/DungeonsPage';
import { SetsPage } from './components/SetsPage';
import { MetaPage } from './components/MetaPage';
import { PetsPage } from './components/PetsPage';
import { OverlayPage } from './components/OverlayPage';
import { SettingsPage } from './components/SettingsPage';
import { NeedCharacter } from './components/NeedCharacter';
import { LiveBadge, Toasts } from './components/Live';
import { Notices } from './components/Notices';
import type { DataStatus } from '../../shared/gameDataBundle';
import type { CleanupReport } from '../../main/cleanupRules';

/** How long a live-change toast stays in the corner. */
const TOAST_MS = 7000;

export type Phase =
  | { kind: 'idle' }
  | { kind: 'loading'; name: string }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; profile: PlayerProfile; loadedAt: number };

/** Most-progressed characters first so the useful ones are at the top. */
export function sortCharacters(chars: Character[]): Character[] {
  return [...chars].sort((a, b) => b.maxedCount - a.maxedCount || b.level - a.level || b.fame - a.fame);
}

export function App() {
  const { prefs, set: setPrefs, reset: resetPrefs } = usePrefs();
  const recent = useRecentPlayers();
  const declined = useDeclined();
  const overlay = useOverlaySettings();
  const now = useNow();

  const [query, setQuery] = useState(prefs.lastPlayer);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [activeKey, setActiveKey] = useState('');
  const [page, setPage] = useState<PageId>(prefs.startPage === 'last' ? prefs.lastPage : prefs.startPage);
  const [setsClass, setSetsClass] = useState<string | undefined>();
  const [dungeonId, setDungeonId] = useState('');
  const [live, setLive] = useState<LiveState | null>(null);
  const [toasts, setToasts] = useState<LiveEvent[]>([]);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [cleanup, setCleanup] = useState<CleanupReport | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const profile = phase.kind === 'loaded' ? phase.profile : null;
  const characters = useMemo(() => (profile ? sortCharacters(profile.characters) : []), [profile]);
  const active = characters.find((c) => charKey(c) === activeKey) ?? null;

  // The live subscription is registered once, so it reads current values through refs.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const activeRef = useRef(active);
  activeRef.current = active;
  const seenEvents = useRef<Set<string> | null>(null);

  const { add: addRecent } = recent;
  const load = useCallback(
    async (raw: string, force = false) => {
      const name = raw.trim();
      if (!name) return;
      setQuery(name);
      setPhase({ kind: 'loading', name });
      const res = await window.api.live.load(name, force);
      if (!res.ok) return setPhase({ kind: 'error', message: res.error });
      if (!res.profile) return setPhase({ kind: 'error', message: `No RealmEye player found named "${name}".` });
      setPhase({ kind: 'loaded', profile: res.profile, loadedAt: Date.now() });
      addRecent(name);
      setPrefs({ lastPlayer: name });
      // Keep the current pick on a refresh; otherwise the remembered (or top) character.
      const sorted = sortCharacters(res.profile.characters);
      setActiveKey((k) => {
        if (sorted.some((c) => charKey(c) === k)) return k;
        const p = pickActive(sorted);
        return p ? charKey(p) : '';
      });
    },
    [addRecent, setPrefs],
  );

  // Startup: re-open the last player.
  useEffect(() => {
    if (prefs.autoLoad && prefs.lastPlayer) void load(prefs.lastPlayer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live sync: the main process re-reads RealmEye in the background and pushes every
  // change. Adopt newer snapshots of the loaded player (keeping the same active
  // character — its key changes as fame grows) and toast the new events.
  useEffect(() => {
    const onLive = (s: LiveState) => {
      setLive(s);
      const ph = phaseRef.current;
      if (
        s.profile &&
        s.syncedAt &&
        ph.kind === 'loaded' &&
        s.player.toLowerCase() === ph.profile.name.toLowerCase() &&
        s.syncedAt !== ph.loadedAt
      ) {
        const cur = activeRef.current;
        const next = cur ? carryCharacter(cur, ph.profile.characters, s.profile.characters) : null;
        if (next) {
          setActiveKey(charKey(next));
          rememberActive(next);
        }
        setPhase({ kind: 'loaded', profile: s.profile, loadedAt: s.syncedAt });
      }
      // Toast only events we haven't seen (the first state just marks history as seen).
      if (!seenEvents.current) {
        seenEvents.current = new Set(s.feed.map((e) => e.id));
        return;
      }
      const fresh = s.feed.filter((e) => !seenEvents.current!.has(e.id));
      if (!fresh.length) return;
      fresh.forEach((e) => seenEvents.current!.add(e.id));
      setToasts((t) => [...fresh.slice(0, 4), ...t].slice(0, 4));
      const ids = new Set(fresh.map((e) => e.id));
      setTimeout(() => setToasts((t) => t.filter((x) => !ids.has(x.id))), TOAST_MS);
    };
    window.api.live.getState().then(onLive).catch(() => {});
    return window.api.live.onState(onLive);
  }, []);

  // Self-updating game data: show "Apply" when a newer revision has been downloaded.
  useEffect(() => {
    window.api.data.status().then(setDataStatus).catch(() => {});
    return window.api.data.onStatus(setDataStatus);
  }, []);
  // One-time report after an update moved old copies off the Desktop.
  useEffect(() => {
    window.api.app.cleanupReport().then(setCleanup).catch(() => {});
  }, []);

  // Remember the open page.
  useEffect(() => setPrefs({ lastPage: page }), [page, setPrefs]);

  // The overlay follows the active character and the app theme.
  useEffect(() => {
    window.api.overlay.setCharacter(active).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, profile]);
  useEffect(() => {
    window.api.overlay.setSettings({ theme: prefs.theme }).catch(() => {});
  }, [prefs.theme]);

  const selectCharacter = useCallback((c: Character) => {
    setActiveKey(charKey(c));
    rememberActive(c);
  }, []);

  const nav: Nav = useMemo(
    () => ({
      go: setPage,
      openDungeon: (id: string) => {
        setDungeonId(id);
        setPage('dungeons');
      },
      browseSets: (cls?: string) => {
        setSetsClass(cls);
        setPage('sets');
      },
    }),
    [],
  );

  // Keyboard: Ctrl+1…9 pages · "/" or Ctrl+L search · F5 refresh the profile.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && /^[1-9]$/.test(e.key)) {
        const p = PAGES[Number(e.key) - 1];
        if (p) {
          e.preventDefault();
          setPage(p.id);
        }
      } else if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l')) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === 'F5' && profile) {
        e.preventDefault();
        void window.api.live.syncNow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [profile, load]);

  // Sidebar badges: pots left + gear upgrades for the active character.
  const badges = useMemo(() => {
    if (!active) return {};
    const pots = potionPlan(active, plannerData);
    const gear = gearPlan(active, plannerData);
    const left = pots.mainPots + pots.lifePots + pots.manaPots;
    return {
      potions: left ? { text: String(left) } : { text: '✓', tone: 'good' as const },
      gear: gear.upgradesNow ? { text: `+${gear.upgradesNow}`, tone: 'accent' as const } : undefined,
    };
  }, [active]);

  const def = pageDef(page);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void load(query);
  };

  const renderPage = () => {
    if (def.needsCharacter && !active) {
      return <NeedCharacter page={def} phase={phase} recent={recent} onLoad={(n) => void load(n)} />;
    }
    switch (page) {
      case 'characters':
        return (
          <CharactersPage
            phase={phase}
            characters={characters}
            active={active}
            onSelect={selectCharacter}
            declined={declined}
            recent={recent}
            onLoad={(n) => void load(n)}
            nav={nav}
            live={live}
            now={now}
          />
        );
      case 'potions':
        return <PotionsPage character={active!} nav={nav} />;
      case 'gear':
        return <GearPage character={active!} nav={nav} />;
      case 'dungeons':
        return (
          <DungeonsPage character={active} selected={dungeonId} onSelect={setDungeonId} overlay={overlay} nav={nav} />
        );
      case 'sets':
        return <SetsPage key={setsClass ?? 'all'} initialClass={setsClass} />;
      case 'meta':
        return <MetaPage nav={nav} />;
      case 'pets':
        return <PetsPage />;
      case 'overlay':
        return <OverlayPage character={active} overlay={overlay} nav={nav} />;
      case 'settings':
        return (
          <SettingsPage
            prefs={prefs}
            setPrefs={setPrefs}
            resetPrefs={resetPrefs}
            recent={recent}
            declined={declined}
            overlay={overlay}
            live={live}
            now={now}
            dataStatus={dataStatus}
            onDataStatus={setDataStatus}
            cleanup={cleanup}
            onCleanup={setCleanup}
            nav={nav}
          />
        );
    }
  };

  return (
    <div className={`shell ${prefs.sidebarCollapsed ? 'collapsed' : ''}`}>
      <Sidebar
        page={page}
        onGo={setPage}
        collapsed={prefs.sidebarCollapsed}
        onToggle={() => setPrefs({ sidebarCollapsed: !prefs.sidebarCollapsed })}
        badges={badges}
      />
      <div className="main">
        <header className="topbar">
          <div className="page-title">
            <h1>{def.label}</h1>
            <span>{def.blurb}</span>
          </div>
          <form className="search" onSubmit={onSubmit}>
            <span className="search-field">
              <Icon name="search" size={15} className="search-ico" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="RealmEye player…  ( / )"
                spellCheck={false}
                list="recent-players"
                autoComplete="off"
              />
              <datalist id="recent-players">
                {recent.recent.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </span>
            <button type="submit" className="btn btn-primary" disabled={phase.kind === 'loading'}>
              {phase.kind === 'loading' ? 'Loading…' : 'Load'}
            </button>
          </form>
          {phase.kind === 'loaded' && (
            <>
              <LiveBadge live={live} now={now} onOpenFeed={() => setPage('characters')} />
              <button
                className={`btn btn-icon ${live?.status === 'syncing' ? 'spinning' : ''}`}
                onClick={() => void window.api.live.syncNow()}
                title={`Check RealmEye now (F5) · updated ${timeAgo(phase.loadedAt, now)}`}
              >
                <Icon name="refresh" size={15} />
              </button>
            </>
          )}
          <CharacterSwitcher characters={characters} active={active} onSelect={selectCharacter} />
        </header>

        {/* Load errors are visible on every page (Characters / empty states show their own). */}
        {phase.kind === 'error' && page !== 'characters' && !(def.needsCharacter && !active) && (
          <div className="load-error" role="alert">
            <Icon name="info" size={14} />
            <span>{phase.message}</span>
            <button className="toast-x" onClick={() => setPhase({ kind: 'idle' })} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}
        <main className="content">
          <ErrorBoundary key={page} label={def.label}>
            {renderPage()}
          </ErrorBoundary>
        </main>
      </div>
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      <Notices
        data={dataStatus}
        cleanup={cleanup}
        onDismissCleanup={() => setCleanup((c) => (c ? { ...c, removed: [] } : c))}
      />
    </div>
  );
}
