import type {JSX} from 'react';
import {PropertyGroup} from '@renderer/ui/panels/PropertyRow';
import {ActionRow, CheckboxRow} from '../PreferenceRows';
import type {PageProps} from './pageProps';

/** 출력: 켤 때 출력, 모니터, 전환. */
export function OutputPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  if (preferences === null) return null;
  const disabled = lockedReason !== undefined;
  return (
    <>
      <PropertyGroup>
        <CheckboxRow
          label="앱을 켤 때 출력"
          disabled={disabled}
          title={lockedReason}
          checked={preferences.showOnLaunch}
          onChange={showOnLaunch =>
            change(stored => ({...stored, showOnLaunch}))
          }
        />
        <ActionRow
          label="모니터"
          action="화면 설정…"
          onAction={() => window.llp?.window.openScreens()}
        />
      </PropertyGroup>
    </>
  );
}
