import { Fragment, useEffect, useMemo, useState } from 'react';
import { STAT_KEYS, type Character, type StatKey } from '../../../shared/types';
import { isStatFarmObsolete, type DungeonCategory } from '../../../shared/engine';
import { dungeonInfo, verdictMap, type DungeonInfo, type SourceStatus } from '../../../shared/planner';
import { dungeonWikiUrl, dungeons, plannerData } from '../gameData';
import type { OverlayApi } from '../hooks';
import { POT_LABEL, STAT_LABEL } from '../labels';
import type { Nav } from '../pages';
import { Icon } from './Icon';
import { BeaconTag, EmptyState, Panel, Segmented, StatChip, StatusPill, TierBadge } from './ui';

const CATS: { value: DungeonCategory; label: string }[] = [
  { value: 'starter', label: 'Starter' },
  { value: 'low', label: 'Low' },
  { value: 'mid', label: 'Mid' },
  { value: 'high', label: 'High' },
  { value: 'endgame', label: 'Endgame' },
];
const CAT_LABEL = Object.fromEntries(CATS.map((c) => [c.value, c.label])) as Record<DungeonCategory, string>;

// Precompute details once — the data is static.
const INFO = new Map(dungeons.map((d) => [d.id, dungeonInfo(d.id, plannerData)!]));

type Flag = 'exalt' | 'greater' | 'ready' | 'fav';

export function DungeonsPage({
  character,
  selected,
  onSelect,
  overlay,
  nav,
}: {
  character: Character | null;
  selected: string;
  onSelect: (id: string) => void;
  overlay: OverlayApi;
  nav: Nav;
}) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<DungeonCategory | 'all'>('all');
  const [stat, setStat] = useState<StatKey | 'any'>('any');
  const [flags, setFlags] = useState<Set<Flag>>(new Set());
  const verdicts = useMemo(() => (character ? verdictMap(character, plannerData) : null), [character]);
  const favs = useMemo(() => new Set(overlay.settings.favorites), [overlay.settings.favorites]);

  const toggleFlag = (f: Flag) =>
    setFlags((s) => {
      const n = new Set(s);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return dungeons.filter((d) => {
      const info = INFO.get(d.id)!;
      if (ql && !d.name.toLowerCase().includes(ql) && !(d.biome ?? '').includes(ql)) return false;
      if (cat !== 'all' && d.category !== cat) return false;
      if (stat !== 'any' && !info.potions.includes(stat) && !info.greater.includes(stat) && !info.exalt?.stats.includes(stat)) return false;
      if (flags.has('exalt') && !info.exalt) return false;
      if (flags.has('greater') && !info.greater.length) return false;
      if (flags.has('ready') && verdicts && verdicts.get(d.id) !== 'ready') return false;
      if (flags.has('fav') && !favs.has(d.id)) return false;
      return true;
    });
  }, [q, cat, stat, flags, verdicts, favs]);

  // Keep a valid selection.
  useEffect(() => {
    if ((!selected || !INFO.has(selected)) && list[0]) onSelect(list[0].id);
  }, [selected, list, onSelect]);

  const info = INFO.get(selected) ?? null;

  return (
    <div className="dungeons">
      <div className="dungeon-list-pane">
        <div className="dungeon-filters">
          <span className="search-field">
            <Icon name="search" size={14} className="search-ico" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dungeons or biomes…" spellCheck={false} />
          </span>
          <Segmented<DungeonCategory | 'all'>
            value={cat}
            onChange={setCat}
            options={[{ value: 'all', label: 'All' }, ...CATS]}
          />
          <div className="flag-row">
            <FlagChip on={flags.has('exalt')} onClick={() => toggleFlag('exalt')} label="Exalt" />
            <FlagChip on={flags.has('greater')} onClick={() => toggleFlag('greater')} label="Greater pots" />
            {character && <FlagChip on={flags.has('ready')} onClick={() => toggleFlag('ready')} label="Ready for me" />}
            <FlagChip on={flags.has('fav')} onClick={() => toggleFlag('fav')} label="★ Favorites" />
          </div>
          <div className="flag-row">
            <span className="muted small">Drops / exalts:</span>
            <select className="select" value={stat} onChange={(e) => setStat(e.target.value as StatKey | 'any')}>
              <option value="any">Any stat</option>
              {STAT_KEYS.map((s) => (
                <option key={s} value={s}>
                  {POT_LABEL[s]}
                </option>
              ))}
            </select>
            <span className="muted small">{list.length} shown</span>
          </div>
        </div>
        <div className="dungeon-list">
          {CATS.map((c) => {
            const rows = list.filter((d) => d.category === c.value);
            if (!rows.length) return null;
            return (
              <Fragment key={c.value}>
                <div className="dungeon-list-hdr">{c.label}</div>
                {rows.map((d) => {
                  const inf = INFO.get(d.id)!;
                  const status: SourceStatus = verdicts?.get(d.id) ?? 'unknown';
                  return (
                    <button
                      key={d.id}
                      className={`dungeon-row ${selected === d.id ? 'active' : ''}`}
                      onClick={() => onSelect(d.id)}
                    >
                      <span className={`status-dot st-${status}`} title={status === 'unknown' ? undefined : status} />
                      <span className="dungeon-row-name">{d.name}</span>
                      {favs.has(d.id) && <span className="fav-on">★</span>}
                      {inf.exalt && (
                        <span className="exalt-mini" title={`Exalt: ${inf.exalt.stats.map((s) => STAT_LABEL[s]).join('/')}`}>
                          {inf.exalt.stats.map((s) => STAT_LABEL[s]).join('/')}
                        </span>
                      )}
                      {inf.greater.length > 0 && <span className="greater-mini" title="Drops Greater potions">G</span>}
                    </button>
                  );
                })}
              </Fragment>
            );
          })}
          {!list.length && <div className="muted small pad">No dungeon matches those filters.</div>}
        </div>
      </div>

      <div className="dungeon-detail-pane">
        {info ? (
          <DungeonDetail info={info} character={character} status={verdicts?.get(info.gate.id) ?? 'unknown'} overlay={overlay} favs={favs} nav={nav} />
        ) : (
          <EmptyState icon="castle" title="Pick a dungeon" />
        )}
      </div>
    </div>
  );
}

function FlagChip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`flag-chip ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      {label}
    </button>
  );
}

function DungeonDetail({
  info,
  character,
  status,
  overlay,
  favs,
  nav,
}: {
  info: DungeonInfo;
  character: Character | null;
  status: SourceStatus;
  overlay: OverlayApi;
  favs: Set<string>;
  nav: Nav;
}) {
  const d = info.gate;
  const [mineOnly, setMineOnly] = useState(true);
  const fav = favs.has(d.id);
  const tracking = overlay.settings.currentDungeon === d.id;
  const cls = character?.className.toLowerCase();
  const gear = cls && mineOnly ? info.gear.filter((g) => g.classes.some((c) => c.toLowerCase() === cls)) : info.gear;
  const obsolete = character ? isStatFarmObsolete(d, character.maxedCount) : false;

  const toggleFav = () =>
    overlay.patch({ favorites: fav ? overlay.settings.favorites.filter((f) => f !== d.id) : [...overlay.settings.favorites, d.id] });

  return (
    <div className="dungeon-detail">
      <header className="dd-head">
        <div>
          <h2>{d.name}</h2>
          <div className="dd-badges">
            <span className={`set-badge diff diff-cat-${d.category}`}>{CAT_LABEL[d.category]}</span>
            <span className={`diff diff-${d.tier}`}>T{d.tier}</span>
            <span className="muted small">
              Recommended {d.recommendedMaxed}/8 · ~{d.minHp} HP
            </span>
          </div>
        </div>
        <div className="dd-actions">
          <button className={`btn btn-ghost btn-sm ${fav ? 'on' : ''}`} onClick={toggleFav} title="Favorites are pinned in the overlay's quick-pick">
            {fav ? '★ Favorite' : '☆ Favorite'}
          </button>
          <button
            className={`btn btn-sm ${tracking ? 'btn-ghost on' : 'btn-primary'}`}
            onClick={() => overlay.patch({ currentDungeon: tracking ? '' : d.id })}
            title="Show this dungeon's card on the in-game overlay"
          >
            <Icon name="layout" size={13} /> {tracking ? 'On overlay ✓' : 'Show on overlay'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => void window.api.openExternal(dungeonWikiUrl(d.id))}>
            RealmEye <Icon name="external" size={12} />
          </button>
        </div>
      </header>

      {character && (
        <div className={`dd-ready st-${status}`}>
          <StatusPill status={status} needs={d.recommendedMaxed} />
          <span>
            {status === 'ready'
              ? `${character.className} (${character.statsMaxed}) is ready.`
              : status === 'risky'
                ? `${character.className} is one stat short of the ${d.recommendedMaxed}/8 recommendation — doable with care.`
                : `${character.className} needs ${d.recommendedMaxed - character.maxedCount} more maxed stats first.`}
            {obsolete && ' Past its stat-farming sweet spot for you — run it for loot, not pots.'}
          </span>
        </div>
      )}

      <div className="dd-grid">
        <Panel title="Strategy" icon="info" className="dd-wide">
          <p className="dd-note">{d.note}</p>
        </Panel>

        <Panel title="Potions" icon="flask">
          {info.potions.length + info.greater.length === 0 ? (
            <p className="muted small">No stat potions tracked.</p>
          ) : (
            <div className="row-chips">
              {info.potions.map((s) => (
                <StatChip key={s} stat={s} guaranteed={info.guaranteed.includes(s)} />
              ))}
              {info.greater.map((s) => (
                <StatChip key={`g-${s}`} stat={s} greater />
              ))}
            </div>
          )}
          {info.guaranteed.length > 0 && (
            <p className="muted small">
              Guaranteed: {info.guaranteed.map((s) => POT_LABEL[s]).join(', ')} (soulbound boss drop).
            </p>
          )}
        </Panel>

        <Panel title="Exaltation" icon="exalt">
          {info.exalt ? (
            <>
              <div className="row-chips">
                {info.exalt.stats.map((s) => (
                  <StatChip key={s} stat={s} />
                ))}
                <span className={`eff-tag eff-${info.exalt.efficiency}`}>{info.exalt.efficiency} efficiency</span>
              </div>
              {info.exalt.note && <p className="muted small">{info.exalt.note}</p>}
            </>
          ) : (
            <p className="muted small">Not an exaltation dungeon.</p>
          )}
        </Panel>

        <Panel title="Where" icon="pin">
          {info.biome ? (
            <>
              <BeaconTag biome={info.biome.id} />
              {info.biome.guardian && <p className="muted small">Beacon guardian: {info.biome.guardian}</p>}
              {info.biome.encounters.length > 0 && <p className="muted small">Encounters: {info.biome.encounters.join(', ')}</p>}
              {info.biome.statPots.length > 0 && (
                <p className="muted small">Biome enemies drop: {info.biome.statPots.map((s) => STAT_LABEL[s]).join(' · ')}</p>
              )}
            </>
          ) : (
            <p className="muted small">Portal source not tracked (event, key, or another dungeon).</p>
          )}
        </Panel>

        {info.keyItems.length > 0 && (
          <Panel title="Key items" icon="chest">
            <div className="row-chips">
              {info.keyItems.map((k) => (
                <span key={k} className="key-chip">
                  {k}
                </span>
              ))}
            </div>
            <p className="muted small">Runes open O3; incantations unlock the Wine Cellar (O2).</p>
          </Panel>
        )}

        <Panel
          title={`UT / ST drops (${gear.length})`}
          icon="att"
          className="dd-wide"
          actions={
            character && (
              <Segmented<'mine' | 'all'>
                value={mineOnly ? 'mine' : 'all'}
                onChange={(v) => setMineOnly(v === 'mine')}
                options={[
                  { value: 'mine', label: `${character.className} only` },
                  { value: 'all', label: 'All classes' },
                ]}
              />
            )
          }
        >
          {!info.hasDropData ? (
            <p className="muted small">
              No scraped drop data yet for this dungeon — run <code>npm run refresh</code> to pull it from RealmEye.
            </p>
          ) : gear.length === 0 ? (
            <p className="muted small">Nothing here for {character?.className ?? 'this filter'}.</p>
          ) : (
            <div className="drop-list">
              {gear.map((g) => (
                <div key={g.slug} className="drop-row" title={g.description ?? ''}>
                  <span className="set-slot">{g.slot.toUpperCase()}</span>
                  <TierBadge tier={g.tier} />
                  <button className="dungeon-link" onClick={() => void window.api.openExternal(`https://www.realmeye.com/wiki/${g.slug}`)}>
                    {g.name}
                  </button>
                  {g.summary && <span className="muted small">{g.summary}</span>}
                  <span className="spacer" />
                  {g.score != null && <span className="score">{g.score}</span>}
                  <span className="drop-classes muted small">{g.classes.length > 3 ? `${g.classes.length} classes` : g.classes.join(', ')}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <button className="link-btn small" onClick={() => nav.go('meta')}>
        How dungeons fit the current meta ▸
      </button>
    </div>
  );
}
