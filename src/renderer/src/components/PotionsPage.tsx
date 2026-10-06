import { Fragment, useMemo, useState } from 'react';
import type { Character, StatKey } from '../../../shared/types';
import { exaltPlan, potionPlan, type StatPlan } from '../../../shared/planner';
import { biomes, dungeonName, plannerData } from '../gameData';
import { POT_LABEL } from '../labels';
import type { Nav } from '../pages';
import { Icon, StatIcon } from './Icon';
import { Bar, BeaconTag, DungeonLink, Panel, StatChip, StatTile, StatusPill } from './ui';

export function PotionsPage({ character, nav }: { character: Character; nav: Nav }) {
  const plan = useMemo(() => potionPlan(character, plannerData), [character]);
  const exalts = useMemo(() => (character.maxedCount === 8 ? exaltPlan(character, plannerData) : []), [character]);
  const [open, setOpen] = useState<StatKey | null>(null);
  const maxedCount = plan.stats.filter((s) => s.maxed).length;

  return (
    <>
      <div className="tiles">
        <StatTile
          label={`${character.className} · maxed`}
          value={`${maxedCount}/8`}
          sub={<Bar value={maxedCount / 8} maxed={maxedCount === 8} />}
          tone={maxedCount === 8 ? 'good' : 'accent'}
        />
        <StatTile label="Stat pots left" value={plan.mainPots} sub="ATT · DEF · SPD · DEX · VIT · WIS" />
        <StatTile label="Life pots" value={plan.lifePots} sub="+5 HP each" />
        <StatTile label="Mana pots" value={plan.manaPots} sub="+5 MP each" />
        <StatTile label="…or Greaters" value={plan.greaterTotal} sub="each = 2 regular" tone="good" />
      </div>

      {!plan.hasClassMax && (
        <div className="error-box">
          No max-stat data for {character.className} yet — run <code>npm run refresh</code> to pull it from RealmEye.
        </div>
      )}

      <div className="split">
        <div className="split-main">
          {plan.todo.length === 0 && plan.hasClassMax ? (
            <Panel title="All 8 stats maxed — time to exalt" icon="exalt">
              <p className="muted">
                Every 5 clears of an exalt dungeon (up to 25) is a permanent +1 for {character.className} (Life/Mana +5).
                Most grindable first:
              </p>
              <div className="rows">
                {exalts.map((e) => (
                  <div key={e.id} className="row">
                    <DungeonLink id={e.id} name={e.name} onOpen={nav.openDungeon} />
                    <span className="row-chips">
                      {e.stats.map((s) => (
                        <StatChip key={s} stat={s} />
                      ))}
                    </span>
                    <span className={`eff-tag eff-${e.efficiency}`}>{e.efficiency}</span>
                    <StatusPill status={e.status} />
                  </div>
                ))}
              </div>
            </Panel>
          ) : (
            <Panel
              title="Maxing order"
              icon="flask"
              actions={<span className="muted small">Your class priority · click a stat for every source</span>}
            >
              <div className="pot-table">
                {plan.stats.map((s) => (
                  <Fragment key={s.stat}>
                    <StatRow s={s} open={open === s.stat} onToggle={() => setOpen(open === s.stat ? null : s.stat)} nav={nav} />
                    {open === s.stat && <StatDetail s={s} nav={nav} />}
                  </Fragment>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="split-side">
          {plan.route.length > 0 && (
            <Panel title="Farm route" icon="route">
              <p className="muted small">The fewest biomes whose enemies drop everything you still need — Adept first.</p>
              <ol className="route">
                {plan.route.map((r, i) => {
                  const guardian = biomes.biomes[r.biome]?.guardian;
                  return (
                    <li key={r.biome} className="route-stop">
                      <span className="route-n">{i + 1}</span>
                      <div className="route-body">
                        <BeaconTag biome={r.biome} />
                        <div className="row-chips">
                          {r.covers.map((s) => (
                            <StatChip key={s} stat={s} />
                          ))}
                        </div>
                        {r.dungeons.length > 0 && (
                          <div className="route-portals">
                            Portals here:{' '}
                            {r.dungeons.map((d, j) => (
                              <Fragment key={d}>
                                {j > 0 && ', '}
                                <DungeonLink id={d} name={dungeonName(d)} onOpen={nav.openDungeon} />
                              </Fragment>
                            ))}
                          </div>
                        )}
                        {guardian && <div className="route-guardian">Beacon guardian: {guardian}</div>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Panel>
          )}
          <Panel title="How potions work" icon="info">
            <ul className="tips">
              <li>
                A <b>Greater</b> potion is worth two regular ones (+2, or +10 Life/Mana).
              </li>
              <li>
                <b>Life & Mana</b> pots give +5 each and come from Veteran biomes and mid-tier dungeons (Woodland
                Labyrinth → Life, Crawling Depths / Ocean Trench → Mana).
              </li>
              <li>
                <b>Guaranteed</b> sources always drop that pot (soulbound) — the safest early farm.
              </li>
              <li>
                Struck-through sources are past their “stop farming here” point for you — greater-pot dungeons pay better.
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

function StatRow({ s, open, onToggle, nav }: { s: StatPlan; open: boolean; onToggle: () => void; nav: Nav }) {
  return (
    <div className={`pot-row ${s.maxed ? 'maxed' : ''} ${open ? 'open' : ''}`}>
      <span className="pot-rank">{s.maxed ? <Icon name="up" size={12} /> : `#${s.rank + 1}`}</span>
      <button className="pot-stat" onClick={onToggle} disabled={s.maxed}>
        <StatIcon stat={s.stat} size={15} /> {POT_LABEL[s.stat]}
      </button>
      <span className="pot-progress">
        <Bar value={s.max ? s.base / s.max : 1} maxed={s.maxed} />
        <span className="pot-nums">
          {s.base}/{s.max}
        </span>
      </span>
      {s.maxed ? (
        <span className="pot-need done">Maxed</span>
      ) : (
        <span className="pot-need">
          <b>{s.pots}</b> pots <span className="muted">· or {s.greaters} G</span>
        </span>
      )}
      <span className="pot-best">
        {s.maxed ? null : s.bestNow ? (
          <>
            <DungeonLink id={s.bestNow.id} name={s.bestNow.name} onOpen={nav.openDungeon} />
            {s.bestNow.guaranteed && <span className="guaranteed-badge">GUARANTEED</span>}
            {s.bestNow.greater && <span className="greater-badge">GREATER</span>}
            {s.bestNow.status === 'risky' && <StatusPill status="risky" />}
          </>
        ) : s.nextUnlock ? (
          <span className="muted">
            <Icon name="lock" size={11} /> {s.nextUnlock.name} at {s.nextUnlock.needs}/8
          </span>
        ) : (
          <span className="muted">No tracked source</span>
        )}
      </span>
      <span className="pot-biome">{!s.maxed && s.biomes[0] && <BeaconTag biome={s.biomes[0].id} showTier={false} />}</span>
      {!s.maxed && (
        <button className="pot-caret" onClick={onToggle} aria-label="Show all sources">
          <Icon name="chevron" size={14} className={`chev ${open ? 'up' : ''}`} />
        </button>
      )}
    </div>
  );
}

function StatDetail({ s, nav }: { s: StatPlan; nav: Nav }) {
  return (
    <div className="pot-detail">
      <div className="pot-detail-col">
        <div className="mini-head">Dungeons ({s.sources.length})</div>
        {s.sources.map((src) => (
          <div key={src.id} className={`pot-source ${src.obsolete ? 'obsolete' : ''}`}>
            <span className={`diff diff-${src.tier}`}>T{src.tier}</span>
            <DungeonLink id={src.id} name={src.name} onOpen={nav.openDungeon} />
            {src.guaranteed && <span className="guaranteed-badge">GUARANTEED</span>}
            {src.greater && <span className="greater-badge">GREATER</span>}
            <span className="spacer" />
            <StatusPill status={src.status} needs={src.needs} />
          </div>
        ))}
      </div>
      <div className="pot-detail-col">
        <div className="mini-head">Biomes ({s.biomes.length})</div>
        {s.biomes.map((b) => (
          <div key={b.id} className="pot-source">
            <BeaconTag biome={b.id} />
          </div>
        ))}
        {!s.biomes.length && <div className="muted small">No biome drops this pot.</div>}
      </div>
    </div>
  );
}
