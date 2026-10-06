import type { DataStatus } from '../../../shared/gameDataBundle';
import type { CleanupReport } from '../../../main/cleanupRules';
import { Icon } from './Icon';

/**
 * Bottom-left app notices: fresh game data waiting to be applied, and the one-time
 * "old copies moved off your Desktop" report after an update.
 */
export function Notices({
  data,
  cleanup,
  onDismissCleanup,
}: {
  data: DataStatus | null;
  cleanup: CleanupReport | null;
  onDismissCleanup: () => void;
}) {
  const showCleanup = !!cleanup && cleanup.removed.length > 0;
  if (!data?.pending && !showCleanup) return null;
  return (
    <div className="notices">
      {data?.pending && (
        <div className="notice">
          <span className="notice-icon">
            <Icon name="refresh" size={16} />
          </span>
          <div className="notice-body">
            <strong>Fresh game intel downloaded</strong>
            <span>
              Data revision {data.pending.revision} ({data.pending.updated}) — drop tables, meta and sets. Applying reloads the
              app in a second.
            </span>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => void window.api.data.apply()}>
            Apply now
          </button>
        </div>
      )}
      {showCleanup && (
        <div className="notice">
          <span className="notice-icon good">
            <Icon name="trash" size={16} />
          </span>
          <div className="notice-body">
            <strong>
              Moved {cleanup!.removed.length} old cop{cleanup!.removed.length === 1 ? 'y' : 'ies'} off your Desktop
            </strong>
            <span>
              {cleanup!.removed.map((r) => r.name).join(' · ')} — they&apos;re in the Recycle Bin if you ever want them
              back. v{cleanup!.version} is the one on your Desktop now.
            </span>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onDismissCleanup}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
