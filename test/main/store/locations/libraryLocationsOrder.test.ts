import {describe, expect, it, vi} from 'vitest';
import type {LocationsView} from '@core/schema/app/libraryLocations';
import {defaultPreferences} from '@core/schema/app/preferences';
import type {Result} from '@core/common/result';
import type {WriteProblem} from '@main/base/files/atomicWrite';
import {BackupGate} from '@main/store/files/backup';
import {LibraryLocations} from '@main/store/locations/libraryLocations';
import {resolveLocations} from '@main/store/locations/locations';

type BackupTime = Result<Date | null, WriteProblem>;

/** The pending reads of the last backup, in the order they were asked. */
const reads: Array<(value: BackupTime) => void> = [];

vi.mock(import('@main/store/files/backup'), async importOriginal => ({
  ...(await importOriginal()),
  // NOTE(0913vision): Each read of the last backup waits until the test
  // answers it, so the test decides which disk read finishes first.
  lastBackupTime: () =>
    new Promise<BackupTime>(resolve => {
      reads.push(resolve);
    }),
}));

const NO_BACKUP: BackupTime = {ok: true, value: null};

function watched() {
  const context = {documents: 'C:/unused', developmentFolder: 'C:/data'};
  const gate = new BackupGate();
  const onChange = vi.fn<(view: LocationsView) => void>();
  const locations = new LibraryLocations({
    config: {
      libraryLocations: {},
      isReadOnly: false,
      setLibraryLocation: () => undefined,
    },
    inUse: resolveLocations({}, context).locations,
    context: () => context,
    backupPreferences: () => Promise.resolve(defaultPreferences.backup),
    isAnyOutputOn: () => false,
    onChange,
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      flush: () => Promise.resolve(),
    },
    gate,
  });
  const stop = locations.watchBackups();
  return {gate, onChange, stop};
}

describe('the folders published while a backup starts and ends', () => {
  it('shows a short backup and ends on its end, whichever disk read finishes first', async () => {
    reads.length = 0;
    const {gate, onChange, stop} = watched();

    gate.enter();
    gate.leave();
    expect(reads).toHaveLength(2);
    reads[1]?.(NO_BACKUP);
    reads[0]?.(NO_BACKUP);

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    expect(onChange.mock.calls.map(([view]) => view.backingUp)).toEqual([
      true,
      false,
    ]);
    stop();
  });
});
