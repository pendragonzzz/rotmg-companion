import { useEffect, useState } from 'react';
import type { Character, PlayerProfile } from '../../shared/types';
import { pickActive } from './activeChar';
import { CharacterCard } from './components/CharacterCard';
import { SetsPage } from './components/SetsPage';
import { OverlayPage } from './components/OverlayPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dropdown } from './components/Dropdown';
import { Icon } from './components/Icon';
import { THEMES, useTheme, useDeclined, type DeclinedApi } from './hooks';

/** Most-progressed characters first so the useful ones are at the top. */
function sortCharacters(chars: Character[]): Character[] {
  return [...chars].sort(
    (a, b) => b.maxedCount - a.maxedCount || b.level - a.level || b.fame - a.fame,
  );
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; profile: PlayerProfile };

type View = { kind: 'characters' } | { kind: 'sets'; className?: string } | { kind: 'overlay' };

export function App() {
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [view, setView] = useState<View>({ kind: 'characters' });
  const [theme, setTheme] = useTheme();
  const declined = useDeclined();

  async function load(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setView({ kind: 'characters' });
    setPhase({ kind: 'loading' });
    const res = await window.api.getPlayer(trimmed);
    if (!res.ok) {
      setPhase({ kind: 'error', message: res.error });
    } else if (!res.profile) {
      setPhase({ kind: 'error', message: `No RealmEye player found named "${trimmed}".` });
    } else {
      setPhase({ kind: 'loaded', profile: res.profile });
    }
  }

  const browseSets = (className?: string) => setView({ kind: 'sets', className });

  // When a profile loads, push the remembered (or top) character to the overlay so the
  // hotkey works without first visiting the Overlay tab.
  useEffect(() => {
    if (phase.kind !== 'loaded') return;
    window.api.overlay.setCharacter(pickActive(sortCharacters(phase.profile.characters))).catch(() => {});
  }, [phase]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⚔</span>
          <span className="brand-name">RotMG <b>Companion</b></span>
        </div>
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${view.kind === 'characters' ? 'active' : ''}`}
            onClick={() => setView({ kind: 'characters' })}
          >
            <Icon name="user" size={15} /> Characters
          </button>
          <button
            className={`nav-tab ${view.kind === 'sets' ? 'active' : ''}`}
            onClick={() => browseSets()}
          >
            <Icon name="sets" size={15} /> Sets
          </button>
          <button
            className={`nav-tab ${view.kind === 'overlay' ? 'active' : ''}`}
            onClick={() => setView({ kind: 'overlay' })}
          >
            <Icon name="layout" size={15} /> Overlay
          </button>
        </nav>
        <div className="topbar-right">
          <form className="search" onSubmit={load}>
            <span className="search-field">
              <Icon name="search" size={15} className="search-ico" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="RealmEye username…"
                spellCheck={false}
                autoFocus
              />
            </span>
            <button type="submit" disabled={phase.kind === 'loading'}>
              {phase.kind === 'loading' ? 'Loading…' : 'Load'}
            </button>
          </form>
          <Dropdown label="Theme" value={theme} options={THEMES} onChange={setTheme} />
        </div>
      </header>

      <main className="content">
        {view.kind === 'overlay' ? (
          <OverlayPage characters={phase.kind === 'loaded' ? sortCharacters(phase.profile.characters) : []} />
        ) : view.kind === 'sets' ? (
          <SetsPage initialClass={view.className} />
        ) : (
          <>
            {phase.kind === 'idle' && (
              <div className="hint">
                <p>Enter a RealmEye username to import characters and see which dungeons each one is ready for.</p>
                <p className="muted">
                  Or browse the <button className="link-btn" onClick={() => browseSets()}>Set-Tier item</button> catalog
                  by class and difficulty. Profiles must be public on RealmEye.
                </p>
              </div>
            )}

            {phase.kind === 'error' && <div className="error-box">{phase.message}</div>}

            {phase.kind === 'loaded' && (
              <ProfileView profile={phase.profile} declined={declined} onBrowseSets={browseSets} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ProfileView({
  profile,
  declined,
  onBrowseSets,
}: {
  profile: PlayerProfile;
  declined: DeclinedApi;
  onBrowseSets: (className?: string) => void;
}) {
  if (profile.isPrivate) {
    return <div className="error-box">{profile.name}&apos;s profile is set to private on RealmEye.</div>;
  }
  if (profile.characters.length === 0) {
    return (
      <div className="hint">
        <p>
          <strong>{profile.name}</strong> has no active characters on RealmEye right now.
        </p>
        <p className="muted">New accounts often aren&apos;t indexed until linked — manual entry is coming.</p>
      </div>
    );
  }
  const s = profile.summary;
  return (
    <>
      <div className="profile-head">
        <h1>{profile.name}</h1>
        <div className="profile-meta">
          {s.guild && <span>Guild: {s.guild}</span>}
          {s.accountFame != null && <span>Account fame: {s.accountFame.toLocaleString()}</span>}
          {s.exaltations != null && <span>Exaltations: {s.exaltations}</span>}
          <span className="char-count">{profile.characters.length} characters loaded</span>
        </div>
      </div>
      <div className="cards">
        {sortCharacters(profile.characters).map((c, i) => (
          <ErrorBoundary key={`${c.className}-${i}`} label={`${c.className} (Lv ${c.level})`}>
            <CharacterCard
              character={c}
              declinedList={declined.listFor(c.className)}
              onDecline={(id) => declined.decline(c.className, id)}
              onRestore={(id) => declined.restore(c.className, id)}
              onBrowseSets={onBrowseSets}
            />
          </ErrorBoundary>
        ))}
      </div>
    </>
  );
}
