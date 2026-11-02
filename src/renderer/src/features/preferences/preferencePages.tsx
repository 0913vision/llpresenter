import type {JSX} from 'react';
import {PropertyGroup} from '@renderer/ui/PropertyRow';
import {PREFERENCE_LIMITS, previewFpsChoices} from '@core/schema/preferences';
import type {PreferenceEdits} from './usePreferenceEdits';
import {CountRow, SelectRow, SwitchRow} from './PreferenceRows';

/** The pages of the 환경설정 list, in the order it shows them. */
export const preferencePages = [
  {id: 'general', label: '일반', icon: 'gear'},
  {id: 'output', label: '출력', icon: 'mplay'},
  {id: 'library', label: '라이브러리', icon: 'folder'},
  {id: 'bible', label: '성경', icon: 'book'},
  {id: 'import', label: '가져오기', icon: 'download'},
  {id: 'shortcuts', label: '단축키', icon: 'keyboard'},
] as const;

export type PreferencePageId = (typeof preferencePages)[number]['id'];

const HARDWARE_ACCELERATION_NOTE = '다음에 켤 때 적용됩니다';
const LANGUAGE_OPTIONS = [{value: 'ko', label: '한국어'}] as const;
const LAUNCH_OPTIONS = [
  {value: 'lastService', label: '마지막 예배 열기'},
] as const;
const DISCONNECT_OPTIONS = [
  {value: 'window', label: '창으로 바꾸기'},
  {value: 'off', label: '출력 끄기'},
] as const;
const FPS_OPTIONS = previewFpsChoices.map(fps => ({
  value: String(fps),
  label: `${fps}fps`,
}));

interface PageProps {
  readonly edits: PreferenceEdits;
}

/** 일반: 앱, 저장, 지우기. */
export function GeneralPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  if (preferences === null) return null;
  const disabled = lockedReason !== undefined;
  return (
    <>
      <PropertyGroup title="앱">
        <SelectRow
          label="언어"
          disabled={disabled}
          title={lockedReason}
          options={LANGUAGE_OPTIONS}
          value={preferences.language}
          onChange={language => change(stored => ({...stored, language}))}
        />
        <SelectRow
          label="시작할 때"
          disabled={disabled}
          title={lockedReason}
          options={LAUNCH_OPTIONS}
          value={preferences.onLaunch}
          onChange={onLaunch => change(stored => ({...stored, onLaunch}))}
        />
      </PropertyGroup>
      <PropertyGroup title="저장">
        <CountRow
          label="복구 사본"
          unit="개"
          disabled={disabled}
          title={lockedReason}
          value={preferences.backupCopies}
          {...PREFERENCE_LIMITS.backupCopies}
          onChange={backupCopies =>
            change(stored => ({...stored, backupCopies}))
          }
        />
      </PropertyGroup>
      <PropertyGroup title="지우기">
        <SwitchRow
          label="지우기 되돌리기 단추 보이기"
          disabled={disabled}
          title={lockedReason}
          checked={preferences.show.showClearUndoButton}
          onChange={showClearUndoButton =>
            change(stored => ({
              ...stored,
              show: {...stored.show, showClearUndoButton},
            }))
          }
        />
      </PropertyGroup>
    </>
  );
}

/** 출력: 시작, 안정성, 성능. */
export function OutputPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  if (preferences === null) return null;
  const disabled = lockedReason !== undefined;
  return (
    <>
      <PropertyGroup title="시작">
        <SwitchRow
          label="켤 때 화면 출력"
          disabled={disabled}
          title={lockedReason}
          checked={preferences.showOnLaunch}
          onChange={showOnLaunch =>
            change(stored => ({...stored, showOnLaunch}))
          }
        />
      </PropertyGroup>
      <PropertyGroup title="안정성">
        <SwitchRow
          label="출력 중 절전 막기"
          disabled={disabled}
          title={lockedReason}
          checked={preferences.preventSleep}
          onChange={preventSleep =>
            change(stored => ({...stored, preventSleep}))
          }
        />
        <SwitchRow
          label="출력 창 항상 위"
          disabled={disabled}
          title={lockedReason}
          checked={preferences.alwaysOnTop}
          onChange={alwaysOnTop => change(stored => ({...stored, alwaysOnTop}))}
        />
        <SelectRow
          label="화면 연결이 끊기면"
          disabled={disabled}
          title={lockedReason}
          options={DISCONNECT_OPTIONS}
          value={preferences.onDisconnect}
          onChange={onDisconnect =>
            change(stored => ({...stored, onDisconnect}))
          }
        />
      </PropertyGroup>
      <PropertyGroup title="성능">
        <SwitchRow
          label="하드웨어 가속"
          disabled={disabled}
          title={lockedReason ?? HARDWARE_ACCELERATION_NOTE}
          checked={preferences.hardwareAcceleration}
          onChange={hardwareAcceleration =>
            change(stored => ({...stored, hardwareAcceleration}))
          }
        />
        <SelectRow
          label="미리보기"
          disabled={disabled}
          title={lockedReason}
          options={FPS_OPTIONS}
          value={String(preferences.previewFps)}
          onChange={fps => {
            const previewFps = previewFpsChoices.find(
              choice => String(choice) === fps,
            );
            if (previewFps !== undefined) {
              change(stored => ({...stored, previewFps}));
            }
          }}
        />
      </PropertyGroup>
    </>
  );
}

/** 라이브러리: 백업. */
export function LibraryPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  if (preferences === null) return null;
  const disabled = lockedReason !== undefined;
  return (
    <PropertyGroup title="백업">
      <SwitchRow
        label="자동 백업"
        disabled={disabled}
        title={lockedReason}
        checked={preferences.backup.auto}
        onChange={auto =>
          change(stored => ({...stored, backup: {...stored.backup, auto}}))
        }
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
    </PropertyGroup>
  );
}
