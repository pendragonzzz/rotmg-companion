import { useMemo, useState } from 'react';
import type { Character } from '../../../shared/types';
import type { STSet } from '../../../shared/engine';
import { gearPlan, type GearChoice, type SetProgress, type SlotPlan } from '../../../shared/planner';
import { dungeonName, plannerData } from '../gameData';
import type { Nav } from '../pages';
import { Icon } from './Icon';
import { Bar, DungeonLink, Panel, Segmented, StatTile, StatusPill, TierBadge } from './ui';

type Scope = 'now' | 'all';

const SLOT_LABEL: Record<string, string> = { weapon: 'Weapon', ability: 'Ability', armor: 'Armor', ring: 'Ring' };

export function GearPage({ character, nav }: { character: Character; nav: Nav }) {
  const plan = useMemo(() => gearPlan(character, plannerData), [character]);
  const [scope, setScope] = useState<Scope>('now');
  const bisCount = plan.slots.filter((s) => s.isBis).length;
  const bestSet = plan.setProgress[0];

  return (
    <>
      <div className="tiles">
        <StatTile label="UT / ST equipped" value={`${plan.specialized}/4`} sub={<Bar value={plan.specialized / 4} maxed={plan.specialized === 4} />} />
        <StatTile
          label="Upgrades you can farm now"
          value={plan.upgradesNow}
          tone={plan.upgradesNow ? 'accent' : 'good'}
          sub={plan.upgradesNow ? 'marked ⬆ below' : 'nothing stronger is reachable'}
        />
        <StatTile label="Best-in-slot" value={`${bisCount}/4`} sub="vs every tracked drop" tone={bisCount === 4 ? 'good' : undefined} />
        <StatTile
          label="Set bonus"
          value={bestSet ? `${bestSet.owned.length}/${bestSet.set.members.length}` : '—'}
          sub={bestSet ? bestSet.set.name : 'no ST set pieces equipped'}
        />
      </div>

      <div className="toolbar">
        <Segmented<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'now', label: 'Farmable now', title: 'Only drops from dungeons you are ready (or risky) for' },
            { value: 'all', label: 'All tracked drops', title: 'Include drops from dungeons you are not ready for yet' },
          ]}
        />
        <span className="toolbar-hint muted">Scores: weapons = RealmEye Power Level · others = weighted stats + effect</span>
      </div>

      <div className="split">
        <div className="split-main gear-grid">
          {plan.slots.map((s) => (
            <SlotCard key={s.slot} s={s} scope={scope} nav={nav} />
          ))}
        </div>
        <div className="split-side">
          <Panel title="Set progress" icon="sets">
            {plan.setProgress.length === 0 ? (
              <p className="muted small">No Set-Tier pieces equipped. Four pieces of one set unlock its full bonus.</p>
            ) : (
              plan.setProgress.map((p) => <SetProgressRow key={p.set.slug} p={p} nav={nav} />)
            )}
          </Panel>
          {plan.recommended && <RecommendedSet set={plan.recommended} className={character.className} nav={nav} />}
        </div>
      </div>
    </>
  );
}

function SlotCard({ s, scope, nav }: { s: SlotPlan; scope: Scope; nav: Nav }) {
  const [open, setOpen] = useState(false);
  const options = scope === 'now' ? s.options.filter((o) => o.status === 'ready' || o.status === 'risky') : s.options;
  const showBis = s.bis && s.bis.slug !== s.bestNow?.slug;
  return (
    <Panel
      className={`slot-card ${s.upgradeNow ? 'has-upgrade' : ''}`}
      title={
        <>
          {SLOT_LABEL[s.slot]} {s.upgradeNow && <span className="upgrade-tag">⬆ upgrade</span>}
          {s.isBis && <span className="bis-tag">★ BiS</span>}
        </>
      }
    >
      <div className="slot-line">
        <span className="slot-key">Equipped</span>
        {s.equipped ? (
          <span className="slot-item">
            <TierBadge tier={s.equipped.tier} />
            <b>{s.equipped.name}</b>
            <span className="muted small">{s.equipped.score != null ? `score ${s.equipped.score}` : 'not in tracked drops'}</span>
          </span>
        ) : (
          <span className="muted">Empty</span>
        )}
      </div>

      <div className="slot-line">
        <span className="slot-key">Best now</span>
        {s.bestNow ? (
          s.bestNow.slug === s.equipped?.slug ? (
            <span className="slot-item good">✓ You already have the best you can farm now</span>
          ) : (
            <ChoiceLine c={s.bestNow} delta={s.delta} nav={nav} />
          )
        ) : (
          <span className="muted small">Nothing class-usable is farmable yet</span>
        )}
      </div>

      {showBis && s.bis && (
        <div className="slot-line">
          <span className="slot-key">Endgame</span>
          <ChoiceLine c={s.bis} nav={nav} />
        </div>
      )}

      {options.length > 0 && (
        <>
          <button className="link-btn slot-more" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide' : 'Show'} {options.length === 1 ? 'the 1 option' : `all ${options.length} options`} <Icon name="chevron" size={12} className={`chev ${open ? 'up' : ''}`} />
          </button>
          {open && (
            <div className="slot-options">
              {options.map((o, i) => (
                <div key={o.slug} className={`slot-option ${o.slug === s.equipped?.slug ? 'equipped' : ''}`} title={o.description ?? ''}>
                  <span className="slot-rank">{i + 1}</span>
                  <TierBadge tier={o.tier} />
                  <span className="slot-option-name">{o.name}</span>
                  {o.summary && <span className="muted small">{o.summary}</span>}
                  <span className="spacer" />
                  <span className="score">{o.score}</span>
                  <DungeonLink id={o.dungeonId} name={o.dungeon} onOpen={nav.openDungeon} />
                  <StatusPill status={o.status} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function ChoiceLine({ c, delta, nav }: { c: GearChoice; delta?: number | null; nav: Nav }) {
  return (
    <span className="slot-item" title={c.description ?? ''}>
      <TierBadge tier={c.tier} />
      <b>{c.name}</b>
      <span className="score">{c.score}</span>
      {delta != null && delta !== 0 && <span className={`delta ${delta > 0 ? 'up' : 'down'}`}>{delta > 0 ? `+${delta}` : delta}</span>}
      <span className="muted small">from</span>
      <DungeonLink id={c.dungeonId} name={c.dungeon} onOpen={nav.openDungeon} />
      {c.status !== 'ready' && <StatusPill status={c.status} />}
    </span>
  );
}

function SetProgressRow({ p, nav }: { p: SetProgress; nav: Nav }) {
  const total = p.set.members.length || 4;
  const bonus = p.owned.length >= 4 ? p.set.bonuses.four : p.owned.length >= 3 ? p.set.bonuses.three : p.set.bonuses.two;
  return (
    <div className="set-progress">
      <div className="set-progress-head">
        <b>{p.set.name}</b>
        <span className="muted small">
          {p.owned.length}/{total}
        </span>
      </div>
      <Bar value={p.owned.length / total} maxed={p.owned.length === total} />
      {bonus && p.owned.length >= 2 && <div className="muted small">Active: {bonus.text}</div>}
      {p.missing.map((m) => (
        <div key={m.slug} className="set-missing">
          <span className="set-slot">{m.slot.toUpperCase()}</span>
          <span>{m.name}</span>
          <span className="spacer" />
          {m.dungeonId ? (
            <DungeonLink id={m.dungeonId} name={dungeonName(m.dungeonId)} onOpen={nav.openDungeon} />
          ) : (
            <span className="muted small">{p.set.sources[0] ?? 'event / chest'}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function RecommendedSet({ set, className, nav }: { set: STSet; className: string; nav: Nav }) {
  return (
    <Panel
      title="Recommended set"
      icon="star"
      actions={
        <button className="link-btn small" onClick={() => nav.browseSets(className)}>
          All {className} sets ▸
        </button>
      }
    >
      <div className="set-progress-head">
        <b>{set.name}</b>
        {set.generation && <span className="muted small">{set.generation}</span>}
      </div>
      {set.bonuses.four && <div className="small">Full set: {set.bonuses.four.text}</div>}
      {set.members.map((m) => (
        <div key={m.slug} className="set-missing">
          <span className="set-slot">{m.slot.toUpperCase()}</span>
          <span>{m.name}</span>
          <span className="spacer" />
          {m.dungeonId && <DungeonLink id={m.dungeonId} name={dungeonName(m.dungeonId)} onOpen={nav.openDungeon} />}
        </div>
      ))}
    </Panel>
  );
}
