import type { ReactNode } from 'react';
import type { StatKey } from '../../../shared/types';
import type { SourceStatus } from '../../../shared/planner';
import { POT_LABEL, STAT_LABEL } from '../labels';
import { beaconForBiome, biomeName } from '../beacons';
import { classIcon } from '../classIcons';
import { tierClass } from '../gameData';
import { Icon, StatIcon, type IconName } from './Icon';

/** Titled card section used across pages. */
export function Panel({
  title,
  icon,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {(title || actions) && (
        <header className="panel-head">
          {title && (
            <h2 className="panel-title">
              {icon && <Icon name={icon} size={15} />} {title}
            </h2>
          )}
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'good' | 'warn' | 'bad' | 'accent';
}) {
  return (
    <div className={`stat-tile ${tone ? `tone-${tone}` : ''}`}>
      <span className="stat-tile-label">{label}</span>
      <span className="stat-tile-value">{value}</span>
      {sub && <span className="stat-tile-sub">{sub}</span>}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      className={`switch ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
      aria-pressed={on}
      aria-label={label}
    >
      <span className="knob" />
    </button>
  );
}

/** A labelled on/off row: title + hint on the left, switch on the right. */
export function ToggleRow({
  title,
  hint,
  on,
  onChange,
}: {
  title: ReactNode;
  hint?: ReactNode;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <span className="toggle-text">
        <strong>{title}</strong>
        {hint && <em>{hint}</em>}
      </span>
      <Switch on={on} onChange={onChange} label={typeof title === 'string' ? title : undefined} />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function TierBadge({ tier }: { tier: string | null | undefined }) {
  if (!tier) return null;
  return <span className={`tier tier-${tierClass(tier)}`}>{tier}</span>;
}

const STATUS_LABEL: Record<SourceStatus, string> = { ready: 'Ready', risky: 'Risky', notReady: 'Locked', unknown: '—' };

export function StatusPill({ status, needs }: { status: SourceStatus; needs?: number }) {
  return (
    <span className={`status-pill st-${status}`} title={needs != null ? `Recommended ${needs}/8 stats maxed` : undefined}>
      {status === 'notReady' && <Icon name="lock" size={10} />}
      {STATUS_LABEL[status]}
      {status === 'notReady' && needs != null ? ` · ${needs}/8` : ''}
    </span>
  );
}

export function BeaconTag({ biome, showTier = true }: { biome: string; showTier?: boolean }) {
  const b = beaconForBiome(biome);
  return (
    <span className="beacon-tag" title={b ? `${b.label} beacon` : undefined}>
      <span className="beacon-dot" style={{ background: b?.color ?? 'var(--muted)' }} />
      {biomeName(biome)}
      {showTier && b && <span className="beacon-tier">{b.label}</span>}
    </span>
  );
}

export function StatChip({ stat, greater, guaranteed }: { stat: StatKey; greater?: boolean; guaranteed?: boolean }) {
  return (
    <span
      className={`stat-chip stat-${stat} ${greater ? 'greater' : ''} ${guaranteed ? 'guaranteed' : ''}`}
      title={`${greater ? 'Greater ' : ''}Potion of ${POT_LABEL[stat]}${guaranteed ? ' — guaranteed' : ''}`}
    >
      <StatIcon stat={stat} size={11} />
      {STAT_LABEL[stat]}
      {greater && <b>G</b>}
    </span>
  );
}

export function ClassSprite({ className, size = 34 }: { className: string; size?: number }) {
  const icon = classIcon(className);
  return icon ? (
    <img className="class-sprite" src={icon} alt="" width={size} height={size} style={{ width: size, height: size }} />
  ) : (
    <span className="class-sprite mono" style={{ width: size, height: size }}>
      {className.slice(0, 2)}
    </span>
  );
}

/** Progress bar (0–1) with an optional "maxed" state. */
export function Bar({ value, maxed }: { value: number; maxed?: boolean }) {
  return (
    <span className={`bar ${maxed ? 'maxed' : ''}`}>
      <span className="bar-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </span>
  );
}

/** A clickable dungeon name that opens its page in the Dungeons encyclopedia. */
export function DungeonLink({ id, name, onOpen }: { id: string; name: string; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="dungeon-link" onClick={() => onOpen(id)} title="Open in Dungeons">
      {name}
    </button>
  );
}
