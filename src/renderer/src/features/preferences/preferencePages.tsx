import {useContext, useEffect, useState, type JSX} from 'react';
import {LoadReadinessContext} from '@renderer/ui/loadReadiness';
import type {PreferencePageId} from '@core/schema/preferencePages';
import {UI_ZOOM} from '@core/schema/uiZoom';
import {lastBackupText} from '@core/ui/lastBackupText';
import type {Notice} from '@renderer/ui/notices';
import {PropertyGroup, PropertyValue} from '@renderer/ui/PropertyRow';
import {
  AUDIO_LIMITS,
  PREFERENCE_LIMITS,
  TRANSITION_LIMITS,
  withPreferenceDefaults,
} from '@core/schema/preferences';
import type {PreferencesFile} from '@core/schema/preferences';
import type {PreferenceEdits} from './usePreferenceEdits';
import {
  ActionRow,
  CountRow,
  PathRow,
  SegmentedRow,
  CheckboxRow,
  SelectRow,
  TransitionRow,
  ValueActionRow,
} from './PreferenceRows';
import {DeviceRow} from './DeviceRow';
import {useAudioOutputs} from './useAudioOutputs';
import {useLibraryLocations} from './useLibraryLocations';
import {useUiZoom} from './useUiZoom';
import {SlideTransitionRow} from './SlideTransitionRow';

/** The pages of the 환경설정 list, in the order it shows them. */
export const preferencePages = [
  {id: 'general', label: '일반', icon: 'gear'},
  {id: 'output', label: '출력', icon: 'mplay'},
  {id: 'storage', label: '저장', icon: 'folder'},
  {id: 'labels', label: '이름표', icon: 'bookmark'},
  {id: 'media', label: '미디어', icon: 'audio'},
  {id: 'bible', label: '성경', icon: 'book'},
  {id: 'shortcuts', label: '단축키', icon: 'keyboard'},
  {id: 'about', label: '정보', icon: 'info'},
] as const satisfies ReadonlyArray<{
  id: PreferencePageId;
  label: string;
  icon: string;
}>;

export type {PreferencePageId};

const ZOOM_OPTIONS = Array.from(
  {length: (UI_ZOOM.max - UI_ZOOM.min) / UI_ZOOM.step + 1},
  (_, index) => {
    const percent = UI_ZOOM.min + index * UI_ZOOM.step;
    return {value: String(percent), label: `${percent}%`};
  },
);
const FOLDER_NOTE = '다음에 켤 때부터 씁니다. 있던 파일은 옮기지 않습니다';
const AUTO_BACKUP_NOTE = '하루 한 번, 앱을 켤 때';
const PREVIOUS_VERSION_NOTE =
  '곡과 예배 파일을 저장할 때 바로 전 판을 남깁니다';

type TransitionPart = 'media';

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

/** 일반: 화면 확대, Windows 시작할 때 실행. */
export function GeneralPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  const zoom = useUiZoom();
  if (preferences === null) return null;
  const disabled = lockedReason !== undefined;
  return (
    <PropertyGroup>
      <SelectRow
        label="화면 확대"
        disabled={zoom.percent === null}
        options={ZOOM_OPTIONS}
        value={String(zoom.percent ?? UI_ZOOM.defaultPercent)}
        onChange={percent => zoom.setPercent(Number(percent))}
      />
      <CheckboxRow
        label="Windows 시작할 때 실행"
        disabled={disabled}
        title={lockedReason}
        checked={preferences.general.launchAtLogin}
        onChange={launchAtLogin =>
          change(stored => ({
            ...stored,
            general: {...stored.general, launchAtLogin},
          }))
        }
      />
    </PropertyGroup>
  );
}

/** 출력: 켤 때 출력, 모니터, 전환. */
export function OutputPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  if (preferences === null) return null;
  const disabled = lockedReason !== undefined;
  const {transition} = preferences.output;
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
      <PropertyGroup title="전환">
        {(['between', 'within'] as const).map(part => (
          <SlideTransitionRow
            key={part}
            label={part === 'between' ? '곡이 바뀔 때' : '곡 안에서 넘길 때'}
            value={transition[part]}
            disabled={disabled}
            onChange={update =>
              change(stored => ({
                ...stored,
                output: {
                  ...stored.output,
                  transition: {
                    ...stored.output?.transition,
                    [part]: update(
                      withPreferenceDefaults(stored).output.transition[part],
                    ),
                  },
                },
              }))
            }
          />
        ))}
        <TransitionRow
          label="배경"
          disabled={disabled}
          title={lockedReason}
          kind={transition.media.kind}
          seconds={transition.media.seconds}
          limits={TRANSITION_LIMITS.media}
          onKind={kind =>
            change(stored => changedTransition(stored, 'media', {kind}))
          }
          onSeconds={seconds =>
            change(stored => changedTransition(stored, 'media', {seconds}))
          }
        />
      </PropertyGroup>
    </>
  );
}

/** 저장: 폴더, 백업, 이전 판. */
export function StoragePage({
  edits,
  onProblem,
  onDismiss,
}: PageProps & {
  readonly onProblem: (notice: Notice) => void;
  readonly onDismiss?: ((key: string) => void) | undefined;
}): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  const locations = useLibraryLocations(onProblem, onDismiss);
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
  const [devicesRequested, setDevicesRequested] = useState(false);
  const devices = useAudioOutputs(
    undefined,
    devicesRequested ||
      (preferences !== null &&
        (preferences.media.audioOutput.id !== '' ||
          preferences.media.previewOutput.id !== '')),
  );
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
  const setAudio = (changed: {
    readonly transitionSeconds?: number;
    readonly fadeOutSeconds?: number;
  }): void =>
    change(stored => ({
      ...stored,
      show: {...stored.show, audio: {...stored.show?.audio, ...changed}},
    }));
  return (
    <>
      <PropertyGroup title="새 미디어">
        <SegmentedRow
          label="영상 끝나면"
          disabled={disabled}
          title={lockedReason}
          options={END_OPTIONS}
          value={defaults.end}
          onChange={end => setDefaults({end})}
        />
        <SegmentedRow
          label="맞춤"
          disabled={disabled}
          title={lockedReason}
          options={FIT_OPTIONS}
          value={defaults.fit}
          onChange={fit => setDefaults({fit})}
        />
        <CheckboxRow
          label="영상 소리"
          disabled={disabled}
          title={lockedReason}
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
          onOpen={() => setDevicesRequested(true)}
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
          onOpen={() => setDevicesRequested(true)}
          devices={devices}
          onChange={previewOutput =>
            change(stored => ({
              ...stored,
              media: {...stored.media, previewOutput},
            }))
          }
        />
        <CountRow
          label="오디오 겹치기"
          unit="초"
          disabled={disabled}
          title={lockedReason}
          value={preferences.show.audio.transitionSeconds}
          {...AUDIO_LIMITS.transition}
          onChange={transitionSeconds => setAudio({transitionSeconds})}
        />
        <CountRow
          label="페이드 아웃"
          unit="초"
          disabled={disabled}
          title={lockedReason}
          value={preferences.show.audio.fadeOutSeconds}
          {...AUDIO_LIMITS.fadeOut}
          onChange={fadeOutSeconds => setAudio({fadeOutSeconds})}
        />
      </PropertyGroup>
    </>
  );
}

const VERSION_LOADING = '확인 중';

/** 정보: 버전, 문제 해결. */
export function AboutPage(): JSX.Element {
  const readiness = useContext(LoadReadinessContext);
  const [version, setVersion] = useState(VERSION_LOADING);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const [verbose, setVerbose] = useState(false);
  useEffect(() => {
    const api = window.llp?.window;
    if (api === undefined) return undefined;
    const readyLogging = readiness?.begin();
    const readyInfo = readiness?.begin();
    let alive = true;
    api.verboseLogging().then(
      value => {
        if (alive) setVerbose(value);
        readyLogging?.();
      },
      () => readyLogging?.(),
    );
    api.appInfo().then(
      info => {
        if (alive) setVersion(info.version);
        readyInfo?.();
      },
      () => {
        if (alive) setVersion('');
        readyInfo?.();
      },
    );
    return () => {
      alive = false;
      readyLogging?.();
      readyInfo?.();
    };
  }, [readiness]);
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
      <PropertyGroup>
        <PropertyValue label="버전" value={version} />
      </PropertyGroup>
      <PropertyGroup title="문제 해결">
        <ActionRow
          label="기록 폴더"
          action="폴더 열기"
          onAction={() => window.llp?.window.openLogFolder()}
        />
        <ActionRow
          label="진단 정보"
          action="복사"
          result={
            copied === 'done'
              ? '복사했습니다'
              : copied === 'failed'
                ? '복사하지 못했습니다'
                : undefined
          }
          onAction={copy}
        />
        <CheckboxRow
          label="자세한 기록"
          title="앱을 다시 켜면 꺼집니다"
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
