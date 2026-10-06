import { useMemo, useState } from 'react';
import { STAT_KEYS, type Character, type StatKey, type Stats } from '../../../shared/types';
import { evaluateReadiness, buildGoals, recommendSetFor, type STSet, type Goal } from '../../../shared/engine';
import { classMax, dungeonName, dungeons, effectiveTier, goalCtx, sets, statPriority, tierClass } from '../gameData';
import type { Nav } from '../pages';
import { STAT_LABEL } from '../labels';
import { Icon, StatIcon } from './Icon';
import { ClassSprite } from './ui';
import { beaconForBiome, biomeName } from '../beacons';

interface CardProps {
  character: Character;
  active: boolean;
  onActivate: () => void;
  declinedList: string[];
  onDecline: (id: string) => void;
  onRestore: (id: string) => void;
  nav: Nav;
}

export function CharacterCard({ character, active, onActivate, declinedList, onDecline, onRestore, nav }: CardProps) {
  const [open, setOpen] = useState(false);
  const [showAllReady, setShowAllReady] = useState(false);
  const [showNotReady, setShowNotReady] = useState(false);

  const declinedSet = useMemo(() => new Set(declinedList), [declinedList]);
  const report = useMemo(
    () => evaluateReadiness(character, dungeons, classMax, statPriority),
    [character],
  );
  const recommendedSet = useMemo(() => {
    const verdictById = new Map(report.verdicts.map((v) => [v.id, v.status]));
    return recommendSetFor(character, sets, verdictById);
  }, [character, report]);
  const goals = useMemo(
    () => buildGoals(character, dungeons, classMax, { ...goalCtx, declined: declinedSet }),
    [character, declinedSet],
  );
  const maxStats: Stats | undefined = classMax[character.className.toLowerCase()];
  // Plan for this character on another page: make it active first.
  const planOn = (page: 'potions' | 'gear') => {
    onActivate();
    nav.go(page);
  };

  const ready = report.verdicts.filter((v) => v.status === 'ready');
  const risky = report.verdicts.filter((v) => v.status === 'risky');
  const notReady = report.verdicts.filter((v) => v.status === 'notReady');

  // Trim "Ready" down to the meaningful content: only the top one or two tiers
  // the character is ready for. Everything easier is collapsed behind a toggle.
  const maxReadyTier = ready.reduce((m, v) => Math.max(m, v.tier), 0);
  const relevantReady = ready.filter((v) => v.tier >= maxReadyTier - 1);
  const easierReady = ready.filter((v) => v.tier < maxReadyTier - 1);
  const shownReady = showAllReady ? ready : relevantReady;

  return (
    <section className={`card ${open ? 'open' : ''} ${active ? 'active' : ''}`} data-class={character.className.toLowerCase()}>
      <header className="card-head" onClick={() => setOpen((o) => !o)}>
        <div className="card-id">
          <ClassSprite className={character.className} />
          <div className="card-id-text">
            <div className="card-id-top">
              <span className="class-name">{character.className}</span>
              <span className={`maxed-badge ${character.maxedCount === 8 ? 'full' : ''}`}>
                {character.statsMaxed}
              </span>
            </div>
            <span className="lv">
              Level {character.level} · {character.fame.toLocaleString()} fame
            </span>
          </div>
        </div>
        <div className="card-focus">
          {goals[0] ? (
            <span className="focus-line">{goals[0].title}</span>
          ) : (
            <span className="focus-line done">All caught up</span>
          )}
          <Icon name="chevron" size={18} className={`chev ${open ? 'up' : ''}`} />
        </div>
      </header>

      <div className="card-actions">
        {active ? (
          <span className="active-tag">
            <Icon name="star" size={12} /> Active
          </span>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={onActivate} title="Make this the active character (top bar + overlay)">
            Set active
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => planOn('potions')}>
          <Icon name="flask" size={13} /> Potions
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => planOn('gear')}>
          <Icon name="att" size={13} /> Gear
        </button>
      </div>

      <div className="goals">
        <div className="goals-title">Next Goals</div>
        {goals.length === 0 ? (
          <div className="goal-empty">All set — chase exaltations or help a friend!</div>
        ) : (
          goals.map((g) => <GoalRow key={g.id} goal={g} onDecline={onDecline} onOpenDungeon={nav.openDungeon} />)
        )}
        {recommendedSet && (
          <SetRecRow set={recommendedSet} onBrowse={() => nav.browseSets(character.className)} />
        )}
        <button className="link-btn sets-link" onClick={() => nav.browseSets(character.className)}>
          Browse all {character.className} sets ▸
        </button>
        {declinedList.length > 0 && (
          <details className="declined-box">
            <summary>Declined quests ({declinedList.length})</summary>
            {declinedList.map((id) => (
              <div key={id} className="declined-item">
                <span>{prettyDeclined(id)}</span>
                <button className="restore-btn" title="Restore this quest" onClick={() => onRestore(id)}>
                  ↩ restore
                </button>
              </div>
            ))}
          </details>
        )}
      </div>

      {open && (
        <div className="details">
          <div className="stat-grid">
            {STAT_KEYS.map((s: StatKey) => {
              const maxed = maxStats ? character.baseStats[s] >= maxStats[s] : false;
              return (
                <div
                  key={s}
                  className={`stat ${maxed ? 'maxed' : ''}`}
                  title={`${STAT_LABEL[s]} — ${maxStats ? `base ${character.baseStats[s]} / max ${maxStats[s]}` : character.stats[s]}`}
                >
                  <StatIcon stat={s} size={15} className="stat-ico" />
                  <span className="stat-value">{character.stats[s]}</span>
                </div>
              );
            })}
          </div>

          <div className="gear">
            {character.equipment.map((it) => {
              const tier = effectiveTier(it.slug, it.tier);
              return (
                <span key={it.slot} className="gear-item" title={it.tooltip}>
                  {tier && <span className={`tier tier-${tierClass(tier)}`}>{tier}</span>}
                  {it.name}
                </span>
              );
            })}
          </div>

          <div className="readiness">
            <div className="ready-block ok">
              <div className="ready-head">
                Ready now <span className="count">{ready.length}</span>
              </div>
              <div className="chips">
                {shownReady.map((v) => (
                  <button
                    key={v.id}
                    className={`chip ${v.obsolete ? 'obsolete' : ''}`}
                    title={v.obsolete ? 'Diminishing returns — farm greater-pot dungeons or biomes instead' : 'Open in Dungeons'}
                    onClick={() => nav.openDungeon(v.id)}
                  >
                    {v.name}
                  </button>
                ))}
                {easierReady.length > 0 && (
                  <button
                    className="chip more"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllReady((s) => !s);
                    }}
                  >
                    {showAllReady ? 'show less' : `+${easierReady.length} easier`}
                  </button>
                )}
              </div>
            </div>

            {risky.length > 0 && (
              <div className="ready-block warn">
                <div className="ready-head">
                  Risky <span className="count">{risky.length}</span>
                </div>
                <div className="chips">
                  {risky.map((v) => (
                    <button key={v.id} className="chip" title={v.reasons.join('; ')} onClick={() => nav.openDungeon(v.id)}>
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {notReady.length > 0 && (
              <div className="ready-block bad">
                <button
                  className="ready-head toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNotReady((s) => !s);
                  }}
                >
                  Not yet <span className="count">{notReady.length}</span>
                  <Icon name="chevron" size={13} className={`chev ${showNotReady ? 'up' : ''}`} />
                </button>
                {showNotReady && (
                  <div className="chips">
                    {notReady
                      .slice()
                      .sort((a, b) => a.tier - b.tier)
                      .map((v) => (
                        <button key={v.id} className="chip" title={v.reasons.join('; ')} onClick={() => nav.openDungeon(v.id)}>
                          {v.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function GoalRow({
  goal,
  onDecline,
  onOpenDungeon,
}: {
  goal: Goal;
  onDecline: (id: string) => void;
  onOpenDungeon: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const beacon = goal.biome ? beaconForBiome(goal.biome) : null;
  const sources = goal.sources ?? [];
  const alts = goal.alternatives ?? [];
  const expandable = sources.length > 0 || alts.length > 0 || !!goal.synopsis;
  const caret = expandable ? (open ? ' ▴' : ' ▾') : '';
  const toggle = () => expandable && setOpen((o) => !o);
  return (
    <div className={`goal goal-${goal.kind}`}>
      <div className="goal-main">
        <span className="goal-tag">{goal.tag}</span>
        <div className="goal-body" style={{ cursor: expandable ? 'pointer' : 'default' }} onClick={toggle}>
          <div className="goal-title">{goal.title}</div>
          <div className="goal-detail">{goal.detail}</div>
          {goal.biome && (
            <div className="goal-biome">
              {beacon && <span className="beacon-dot" style={{ background: beacon.color }} />}
              {biomeName(goal.biome)}
              {beacon ? ` · ${beacon.label} beacon` : ' biome'}
            </div>
          )}
        </div>
        <div className="goal-side">
          {sources.length > 0 ? (
            <button className="goal-where toggle" onClick={toggle}>
              {sources.length} spots{caret}
            </button>
          ) : alts.length > 1 ? (
            <button className="goal-where toggle" onClick={toggle}>
              {alts.length} options{caret}
            </button>
          ) : goal.where ? (
            <button className="goal-where toggle" onClick={toggle} disabled={!expandable}>
              📍 {goal.where}
              {caret}
            </button>
          ) : null}
          {goal.kind !== 'level' && (
            <button className="goal-decline" title="Decline / not interested" onClick={() => onDecline(goal.id)}>
              ✕
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="goal-expand">
          {sources.length > 0 && (
            <div className="pot-sources">
              {sources.map((s, i) => (
                <div key={`${s.id}-${i}`} className="pot-source">
                  <span className={`diff diff-${s.tier}`}>T{s.tier}</span>
                  <button className="pot-source-name dungeon-link" onClick={() => onOpenDungeon(s.id)}>
                    {s.name}
                  </button>
                  {s.guaranteed && <span className="guaranteed-badge">GUARANTEED</span>}
                  {s.greater && <span className="greater-badge">GREATER</span>}
                </div>
              ))}
            </div>
          )}
          {alts.length > 0 && (
            <div className="gear-options">
              {alts.map((o) => (
                <div key={o.slug} className="gear-option" title={o.description ?? ''}>
                  <span className={`tier tier-${tierClass(o.tier)}`}>{o.tier}</span>
                  <span className="gear-option-name">{o.name}</span>
                  {o.summary && <span className="gear-option-stats">{o.summary}</span>}
                  <span className="gear-option-where">📍 {o.dungeon}</span>
                </div>
              ))}
            </div>
          )}
          {goal.synopsis && <div className="synopsis">{goal.synopsis}</div>}
        </div>
      )}
    </div>
  );
}

function SetRecRow({ set, onBrowse }: { set: STSet; onBrowse: () => void }) {
  const where = set.sourceDungeonIds[0] ? dungeonName(set.sourceDungeonIds[0]) : null;
  const bonus = set.bonuses.four?.text ?? set.bonuses.two?.text ?? '';
  return (
    <div className="goal goal-set" onClick={onBrowse} style={{ cursor: 'pointer' }} title="View in the Sets browser">
      <div className="goal-main">
        <span className="goal-tag">SET</span>
        <div className="goal-body">
          <div className="goal-title">Farm {set.name}</div>
          <div className="goal-detail">{bonus ? `Full set: ${bonus}` : 'Set-tier gear for your class'}</div>
        </div>
        <div className="goal-side">{where && <span className="goal-where">📍 {where}</span>}</div>
      </div>
    </div>
  );
}

function titleCase(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function prettyDeclined(id: string): string {
  const [kind, key = ''] = id.split(':');
  if (kind === 'gear') return `Gear · ${titleCase(key)}`;
  if (kind === 'stat') return `Stat · ${(STAT_LABEL as Record<string, string>)[key] ?? key}`;
  if (kind === 'unlock') return `Unlock · ${titleCase(key)}`;
  if (kind === 'exalt') return `Exalt · ${titleCase(key)}`;
  return id;
}
