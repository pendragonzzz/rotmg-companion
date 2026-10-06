import { PAGES, type PageId } from '../pages';
import { Icon } from './Icon';

/** Left navigation: grouped pages, live badges, collapse toggle. */
export function Sidebar({
  page,
  onGo,
  collapsed,
  onToggle,
  badges,
}: {
  page: PageId;
  onGo: (p: PageId) => void;
  collapsed: boolean;
  onToggle: () => void;
  badges: Partial<Record<PageId, { text: string; tone?: 'accent' | 'good' }>>;
}) {
  const groups = [...new Set(PAGES.map((p) => p.group))];
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">⚔</span>
        {!collapsed && (
          <span className="brand-text">
            <span className="brand-name">
              RotMG <b>Companion</b>
            </span>
            <span className="app-version" title="App version">
              v{__APP_VERSION__}
            </span>
          </span>
        )}
      </div>

      <nav className="side-nav">
        {groups.map((g) => (
          <div key={g} className="side-group">
            {!collapsed && <div className="side-group-label">{g}</div>}
            {PAGES.filter((p) => p.group === g).map((p) => {
              const n = PAGES.indexOf(p) + 1;
              const badge = badges[p.id];
              return (
                <button
                  key={p.id}
                  className={`side-item ${page === p.id ? 'active' : ''}`}
                  onClick={() => onGo(p.id)}
                  title={`${p.label} — ${p.blurb} (Ctrl+${n})`}
                >
                  <Icon name={p.icon} size={17} />
                  {!collapsed && <span className="side-label">{p.label}</span>}
                  {badge && <span className={`side-badge ${badge.tone ?? ''}`}>{badge.text}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <button className="side-collapse" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <Icon name="sidebar" size={16} />
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}
