import type {JSX} from 'react';
import {lastBackupText} from '../lastBackupText';
import {PropertyGroup} from '@renderer/ui/panels/PropertyRow';
import {PREFERENCE_LIMITS} from '@core/schema/app/preferences';
import {
  CountRow,
  PathRow,
  CheckboxRow,
  ValueActionRow,
} from '../PreferenceRows';
import type {LibraryLocationsState} from '../useLibraryLocations';
import type {PageProps} from './pageProps';

const FOLDER_NOTE = '다음에 켤 때부터 씁니다. 있던 파일은 옮기지 않습니다.';

const AUTO_BACKUP_NOTE = '하루 한 번, 앱을 켤 때';

const PREVIOUS_VERSION_NOTE =
  '곡과 예배 파일을 저장할 때 바로 전 판을 남깁니다.';

/** 저장: 폴더, 백업, 이전 판. */
export function StoragePage({
  edits,
  locations,
}: PageProps & {
  readonly locations: LibraryLocationsState;
}): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  if (preferences === null) return null;
  const disabled = lockedReason !== undefined;
  const {view} = locations;
  const unavailable = disabled || view === null;
  return (
    <>
      <PropertyGroup title="폴더">
        <PathRow
          label="곡"
          path={view?.songs.path ?? ''}
          disabled={unavailable}
          title={locations.refusals.songsPath ?? lockedReason ?? FOLDER_NOTE}
          onChange={() => locations.choose('songsPath')}
        />
        <PathRow
          label="미디어"
          path={view?.media.path ?? ''}
          disabled={unavailable}
          title={locations.refusals.mediaPath ?? lockedReason ?? FOLDER_NOTE}
          onChange={() => locations.choose('mediaPath')}
        />
      </PropertyGroup>
      <PropertyGroup title="백업">
        <CheckboxRow
          label="자동 백업"
          disabled={disabled}
          title={lockedReason ?? AUTO_BACKUP_NOTE}
          checked={preferences.backup.auto}
          onChange={auto =>
            change(stored => ({...stored, backup: {...stored.backup, auto}}))
          }
        />
        <PathRow
          label="백업 폴더"
          path={view?.backup.path ?? ''}
          disabled={unavailable}
          title={locations.refusals.backupPath ?? lockedReason}
          onChange={() => locations.choose('backupPath')}
        />
        <CountRow
          label="보관"
          unit="개"
          disabled={disabled}
          title={lockedReason}
          value={preferences.backup.keep}
          {...PREFERENCE_LIMITS.backupKeep}
          onChange={keep =>
            change(stored => ({...stored, backup: {...stored.backup, keep}}))
          }
        />
        <ValueActionRow
          label="마지막 백업"
          value={lastBackupText(view?.lastBackup ?? null, new Date())}
          action="지금 백업"
          disabled={view === null || view.backingUp}
          title={view?.backingUp ? '백업 중' : undefined}
          onAction={locations.backUpNow}
        />
      </PropertyGroup>
      <PropertyGroup title="이전 판">
        <CountRow
          label="파일마다"
          unit="개"
          disabled={disabled}
          title={lockedReason ?? PREVIOUS_VERSION_NOTE}
          value={preferences.backupCopies}
          {...PREFERENCE_LIMITS.backupCopies}
          onChange={backupCopies =>
            change(stored => ({...stored, backupCopies}))
          }
        />
      </PropertyGroup>
    </>
  );
}
