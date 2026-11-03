import {useEffect, useState, type JSX} from 'react';
import type {PreferencePageId} from '@core/schema/preferencePages';
import {UI_ZOOM} from '@core/schema/uiZoom';
import {lastBackupText} from '@core/ui/lastBackupText';
import type {Notice} from '@renderer/ui/notices';
import {PropertyGroup, PropertyValue} from '@renderer/ui/PropertyRow';
import {
  AUDIO_LIMITS,
  PREFERENCE_LIMITS,
  previewFpsChoices,
  TRANSITION_LIMITS,
} from '@core/schema/preferences';
import type {PreferencesFile} from '@core/schema/preferences';
import type {PreferenceEdits} from './usePreferenceEdits';
import {
  CountRow,
  PathRow,
  SelectRow,
  SegmentedRow,
  CheckboxRow,
  ValueActionRow,
} from './PreferenceRows';
import {DeviceRow} from './DeviceRow';
import {useAudioOutputs} from './useAudioOutputs';
import {useLibraryLocations} from './useLibraryLocations';
import {useUiZoom} from './useUiZoom';

/** The pages of the 환경설정 list, in the order it shows them. */
export const preferencePages = [
  {id: 'general', label: '일반', icon: 'gear'},
  {id: 'output', label: '출력', icon: 'mplay'},
  {id: 'library', label: '라이브러리', icon: 'folder'},
  {id: 'media', label: '미디어', icon: 'audio'},
  {id: 'bible', label: '성경', icon: 'book'},
  {id: 'import', label: '가져오기', icon: 'download'},
  {id: 'shortcuts', label: '단축키', icon: 'keyboard'},
  {id: 'about', label: '정보', icon: 'info'},
] as const satisfies ReadonlyArray<{
  id: PreferencePageId;
  label: string;
  icon: string;
}>;

export type {PreferencePageId};

const HARDWARE_ACCELERATION_NOTE = '다음에 켤 때 적용됩니다';
const LANGUAGE_OPTIONS = [{value: 'ko', label: '한국어'}] as const;
const LAUNCH_OPTIONS = [
  {value: 'lastService', label: '마지막 예배 열기'},
] as const;
const AT_LAST_SLIDE_OPTIONS = [
  {value: 'stop', label: '정지'},
  {value: 'nextItem', label: '다음 항목'},
] as const;
const DISCONNECT_OPTIONS = [
  {value: 'window', label: '창으로 바꾸기'},
  {value: 'off', label: '출력 끄기'},
] as const;
const TRANSITION_OPTIONS = [
  {value: 'none', label: '없음'},
  {value: 'dissolve', label: '디졸브'},
] as const;
const FPS_OPTIONS = previewFpsChoices.map(fps => ({
  value: String(fps),
  label: `${fps}fps`,
}));

const ZOOM_OPTIONS = Array.from(
  {length: (UI_ZOOM.max - UI_ZOOM.min) / UI_ZOOM.step + 1},
  (_, index) => {
    const percent = UI_ZOOM.min + index * UI_ZOOM.step;
    return {value: String(percent), label: `${percent}%`};
  },
);
const TRANSITION_NOTE = '다음 슬라이드나 다음 배경부터 적용됩니다';
const NEXT_TRACK_NOTE = '다음 곡부터 적용됩니다';
const NEXT_LAUNCH_NOTE = '다음에 켤 때 적용됩니다';
const BACKUP_NOTE = '다음 백업부터 적용됩니다';

type TransitionPart = 'slide' | 'media';

/** The stored file with one part of a 전환 changed, the rest kept as stored. */
function changedTransition(
  stored: PreferencesFile,
  part: TransitionPart,
  change: {readonly kind?: 'none' | 'dissolve'; readonly seconds?: number},
): PreferencesFile {
  const transition = stored.output?.transition;
  return {
    ...stored,
    output: {
      ...stored.output,
      transition: {
        ...transition,
        [part]: {...transition?.[part], ...change},
      },
    },
  };
}

interface PageProps {
  readonly edits: PreferenceEdits;
}

/** 일반: 앱, 저장, 지우기. */
export function GeneralPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  const zoom = useUiZoom();
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
        <SelectRow
          label="화면 확대"
          disabled={zoom.percent === null}
          options={ZOOM_OPTIONS}
          value={String(zoom.percent ?? UI_ZOOM.defaultPercent)}
          onChange={percent => zoom.setPercent(Number(percent))}
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
      <PropertyGroup title="슬라이드 넘기기">
        <SelectRow
          label="마지막 슬라이드에서 다음 슬라이드"
          disabled={disabled}
          title={lockedReason}
          options={AT_LAST_SLIDE_OPTIONS}
          value={preferences.show.atLastSlide}
          onChange={atLastSlide =>
            change(stored => ({
              ...stored,
              show: {...stored.show, atLastSlide},
            }))
          }
        />
      </PropertyGroup>
      <PropertyGroup title="오디오">
        <CountRow
          label="오디오 전환"
          unit="초"
          disabled={disabled}
          title={lockedReason ?? NEXT_TRACK_NOTE}
          value={preferences.show.audio.transitionSeconds}
          {...AUDIO_LIMITS.transition}
          onChange={transitionSeconds =>
            change(stored => ({
              ...stored,
              show: {
                ...stored.show,
                audio: {...stored.show?.audio, transitionSeconds},
              },
            }))
          }
        />
        <CountRow
          label="페이드 아웃 시간"
          unit="초"
          disabled={disabled}
          title={lockedReason}
          value={preferences.show.audio.fadeOutSeconds}
          {...AUDIO_LIMITS.fadeOut}
          onChange={fadeOutSeconds =>
            change(stored => ({
              ...stored,
              show: {
                ...stored.show,
                audio: {...stored.show?.audio, fadeOutSeconds},
              },
            }))
          }
        />
      </PropertyGroup>
      <PropertyGroup title="지우기">
        <CheckboxRow
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
        <CheckboxRow
          label="켤 때 화면 출력"
          disabled={disabled}
          title={lockedReason}
          checked={preferences.showOnLaunch}
          onChange={showOnLaunch =>
            change(stored => ({...stored, showOnLaunch}))
          }
        />
      </PropertyGroup>
      <PropertyGroup title="전환">
        <SegmentedRow
          label="슬라이드 전환"
          disabled={disabled}
          title={lockedReason ?? TRANSITION_NOTE}
          options={TRANSITION_OPTIONS}
          value={preferences.output.transition.slide.kind}
          onChange={kind =>
            change(stored => changedTransition(stored, 'slide', {kind}))
          }
        />
        {preferences.output.transition.slide.kind === 'none' ? null : (
          <CountRow
            label="슬라이드 전환 시간"
            unit="초"
            disabled={disabled}
            title={lockedReason ?? TRANSITION_NOTE}
            value={preferences.output.transition.slide.seconds}
            {...TRANSITION_LIMITS.slide}
            onChange={seconds =>
              change(stored => changedTransition(stored, 'slide', {seconds}))
            }
          />
        )}
        <SegmentedRow
          label="배경 전환"
          disabled={disabled}
          title={lockedReason ?? TRANSITION_NOTE}
          options={TRANSITION_OPTIONS}
          value={preferences.output.transition.media.kind}
          onChange={kind =>
            change(stored => changedTransition(stored, 'media', {kind}))
          }
        />
        {preferences.output.transition.media.kind === 'none' ? null : (
          <CountRow
            label="배경 전환 시간"
            unit="초"
            disabled={disabled}
            title={lockedReason ?? TRANSITION_NOTE}
            value={preferences.output.transition.media.seconds}
            {...TRANSITION_LIMITS.media}
            onChange={seconds =>
              change(stored => changedTransition(stored, 'media', {seconds}))
            }
          />
        )}
      </PropertyGroup>
      <PropertyGroup title="안정성">
        <CheckboxRow
          label="출력 중 절전 막기"
          disabled={disabled}
          title={lockedReason}
          checked={preferences.preventSleep}
          onChange={preventSleep =>
            change(stored => ({...stored, preventSleep}))
          }
        />
        <CheckboxRow
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
        <CheckboxRow
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

/** 라이브러리: 위치, 백업. */
export function LibraryPage({
  edits,
  onProblem,
}: PageProps & {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  const locations = useLibraryLocations(onProblem);
  if (preferences === null) return null;
  const disabled = lockedReason !== undefined;
  const {view} = locations;
  const unavailable = disabled || view === null;
  return (
    <>
      <PropertyGroup title="위치">
        <PathRow
          label="곡"
          path={view?.songs.path ?? ''}
          disabled={unavailable}
          title={
            locations.refusals.songsPath ??
            (view?.songs.pending ? NEXT_LAUNCH_NOTE : lockedReason)
          }
          onChange={() => locations.choose('songsPath')}
        />
        <PathRow
          label="미디어"
          path={view?.media.path ?? ''}
          disabled={unavailable}
          title={
            locations.refusals.mediaPath ??
            (view?.media.pending ? NEXT_LAUNCH_NOTE : lockedReason)
          }
          onChange={() => locations.choose('mediaPath')}
        />
      </PropertyGroup>
      <PropertyGroup title="백업">
        <CheckboxRow
          label="자동 백업"
          disabled={disabled}
          title={lockedReason}
          checked={preferences.backup.auto}
          onChange={auto =>
            change(stored => ({...stored, backup: {...stored.backup, auto}}))
          }
        />
        <PathRow
          label="백업 위치"
          path={view?.backup.path ?? ''}
          disabled={unavailable}
          title={locations.refusals.backupPath ?? lockedReason ?? BACKUP_NOTE}
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
    </>
  );
}

const NEW_MEDIA_NOTE = '다음에 가져오는 미디어부터 적용됩니다';
const END_OPTIONS = [
  {value: 'loop', label: '반복'},
  {value: 'stop', label: '정지'},
] as const;
const FIT_OPTIONS = [
  {value: 'fit', label: '맞추기'},
  {value: 'fill', label: '채우기'},
  {value: 'stretch', label: '늘리기'},
] as const;

/** 미디어: 새 미디어, 소리. */
export function MediaPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  const devices = useAudioOutputs();
  if (preferences === null) return null;
  const disabled = lockedReason !== undefined;
  const {defaults} = preferences.media;
  const setDefaults = (changed: Partial<typeof defaults>): void =>
    change(stored => ({
      ...stored,
      media: {
        ...stored.media,
        defaults: {...stored.media?.defaults, ...changed},
      },
    }));
  return (
    <>
      <PropertyGroup title="새 미디어">
        <SegmentedRow
          label="영상 끝나면"
          disabled={disabled}
          title={lockedReason ?? NEW_MEDIA_NOTE}
          options={END_OPTIONS}
          value={defaults.end}
          onChange={end => setDefaults({end})}
        />
        <SegmentedRow
          label="맞춤"
          disabled={disabled}
          title={lockedReason ?? NEW_MEDIA_NOTE}
          options={FIT_OPTIONS}
          value={defaults.fit}
          onChange={fit => setDefaults({fit})}
        />
        <CheckboxRow
          label="영상 소리"
          disabled={disabled}
          title={lockedReason ?? NEW_MEDIA_NOTE}
          checked={defaults.audio}
          onChange={audio => setDefaults({audio})}
        />
      </PropertyGroup>
      <PropertyGroup title="소리">
        <DeviceRow
          label="출력 장치"
          disabled={disabled}
          title={lockedReason}
          choice={preferences.media.audioOutput}
          devices={devices}
          onChange={audioOutput =>
            change(stored => ({
              ...stored,
              media: {...stored.media, audioOutput},
            }))
          }
        />
        <DeviceRow
          label="미리 듣기 장치"
          disabled={disabled}
          title={lockedReason}
          choice={preferences.media.previewOutput}
          devices={devices}
          onChange={previewOutput =>
            change(stored => ({
              ...stored,
              media: {...stored.media, previewOutput},
            }))
          }
        />
      </PropertyGroup>
    </>
  );
}

const VERSION_LOADING = '확인 중';

/** 정보: 현재 버전, 문제 해결. */
export function AboutPage(): JSX.Element {
  const [version, setVersion] = useState(VERSION_LOADING);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const [verbose, setVerbose] = useState(false);
  useEffect(() => {
    window.llp?.window.verboseLogging().then(setVerbose, () => undefined);
    window.llp?.window.appInfo().then(
      info => setVersion(info.version),
      () => setVersion(''),
    );
  }, []);
  const copy = (): void => {
    const api = window.llp;
    if (api === undefined) return;
    api.window
      .diagnostics()
      .then(text => navigator.clipboard.writeText(text))
      .then(
        () => setCopied('done'),
        () => setCopied('failed'),
      );
  };
  return (
    <>
      <PropertyGroup title="버전">
        <PropertyValue label="현재 버전" value={version} />
      </PropertyGroup>
      <PropertyGroup title="문제 해결">
        <ValueActionRow
          label="기록 폴더"
          value=""
          action="폴더 열기"
          onAction={() => window.llp?.window.openLogFolder()}
        />
        <ValueActionRow
          label="진단 정보"
          value={
            copied === 'done'
              ? '복사했습니다'
              : copied === 'failed'
                ? '복사하지 못했습니다'
                : ''
          }
          action="복사"
          onAction={copy}
        />
        <CheckboxRow
          label="자세한 기록"
          title="다음에 켤 때는 꺼집니다"
          checked={verbose}
          onChange={on => {
            setVerbose(on);
            window.llp?.window.setVerboseLogging(on);
          }}
        />
      </PropertyGroup>
    </>
  );
}
