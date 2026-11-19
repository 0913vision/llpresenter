import {useContext, useEffect, useState, type JSX} from 'react';
import {LoadReadinessContext} from '@renderer/ui/loadReadiness';
import type {PreferencePageId} from '@core/schema/preferencePages';
import {CLEAR_FADE_LIMIT_MS, DEFAULT_CLEAR_FADE} from '@core/schema/clearFade';
import {clearName} from '@renderer/ui/ClearButton';
import {UI_ZOOM} from '@core/schema/uiZoom';
import {lastBackupText} from '@core/ui/lastBackupText';
import {
  PropertyGroup,
  PropertyRow,
  PropertyValue,
} from '@renderer/ui/PropertyRow';
import {
  AUDIO_LIMITS,
  PREFERENCE_LIMITS,
  type TransitionDefaultKind,
} from '@core/schema/preferences';
import {
  SLIDE_TRANSITION_LIMITS,
  type SlideTransition,
} from '@core/schema/slideTransition';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {NumberField} from '@renderer/ui/NumberField';
import {
  SLIDE_DIRECTIONS,
  SLIDE_EFFECTS,
} from '@renderer/ui/slideTransitionChoices';
import type {PreferenceEdits} from './usePreferenceEdits';
import {
  ActionRow,
  CountRow,
  PathRow,
  SegmentedRow,
  CheckboxRow,
  SelectRow,
  ValueActionRow,
} from './PreferenceRows';
import {DeviceRow} from './DeviceRow';
import type {useAudioOutputs} from './useAudioOutputs';
import type {LibraryLocationsState} from './useLibraryLocations';
import {useUiZoom} from './useUiZoom';

/** The pages of the 환경설정 list, in the order it shows them. */
export const preferencePages = [
  {id: 'general', label: '일반', icon: 'gear'},
  {id: 'show', label: '진행', icon: 'mplay'},
  {id: 'prep', label: '준비', icon: 'listplus'},
  {id: 'output', label: '출력', icon: 'mplay'},
  {id: 'serviceOrder', label: '예배 순서', icon: 'listplus'},
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
        label="시작할 때 최대화"
        disabled={disabled}
        title={lockedReason}
        checked={preferences.general.startMaximized}
        onChange={startMaximized =>
          change(stored => ({
            ...stored,
            general: {...stored.general, startMaximized},
          }))
        }
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

const CLEAR_TARGETS = [
  'all',
  'slide',
  'media',
  'prop',
  'audio',
  'message',
] as const;

export function ShowPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  if (preferences === null) return null;
  return (
    <PropertyGroup title="지우기 페이드">
      {CLEAR_TARGETS.map(target => {
        const label = clearName(target);
        const value = preferences.clearKeys[target] ?? DEFAULT_CLEAR_FADE;
        const update = (next: typeof value): void =>
          change(stored => ({
            ...stored,
            clearKeys: {...stored.clearKeys, [target]: next},
          }));
        return (
          <PropertyRow key={target} label={label}>
            {({controlId}) => (
              <>
                <NumberField
                  id={controlId}
                  aria-label={`${label} 지우기 시간`}
                  value={value.fade ? value.durationMs / 1000 : 0}
                  min={0}
                  max={CLEAR_FADE_LIMIT_MS / 1000}
                  step={0.1}
                  unit="초"
                  disabled={lockedReason !== undefined}
                  updateOn="commit"
                  onChange={seconds =>
                    update({
                      fade: seconds > 0,
                      durationMs: Math.round(seconds * 1000),
                    })
                  }
                />
              </>
            )}
          </PropertyRow>
        );
      })}
    </PropertyGroup>
  );
}

const LAST_SLIDE_OPTIONS = [
  {value: 'stop', label: '멈춤'},
  {value: 'nextItem', label: '다음 항목으로'},
] as const;

/** Service order appearance and navigation. */
export function ServiceOrderPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  if (preferences === null) return null;
  return (
    <PropertyGroup>
      <SegmentedRow
        label="마지막 슬라이드에서"
        disabled={lockedReason !== undefined}
        title={lockedReason}
        options={LAST_SLIDE_OPTIONS}
        value={preferences.show.atLastSlide}
        onChange={atLastSlide =>
          change(stored => ({
            ...stored,
            show: {...stored.show, atLastSlide},
          }))
        }
      />
      <CheckboxRow
        label="이어서 보여 주기"
        disabled={lockedReason !== undefined}
        title={lockedReason}
        checked={preferences.show.continuousGrid}
        onChange={continuousGrid =>
          change(stored => ({
            ...stored,
            show: {...stored.show, continuousGrid},
          }))
        }
      />
      <CheckboxRow
        label="지난 순서 흐리게"
        disabled={lockedReason !== undefined}
        title={lockedReason}
        checked={preferences.show.dimPastItems}
        onChange={dimPastItems =>
          change(stored => ({
            ...stored,
            show: {...stored.show, dimPastItems},
          }))
        }
      />
    </PropertyGroup>
  );
}

const STAGE_LABEL_OPTIONS = [
  {value: 'line', label: '가사 위 한 줄'},
  {value: 'inline', label: '가사 앞에 붙이기'},
  {value: 'off', label: '표시 안 함'},
] as const;

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
        <SelectRow
          label="무대 가사 이름표"
          disabled={disabled}
          title={lockedReason}
          options={STAGE_LABEL_OPTIONS}
          value={preferences.output.stageLyricLabelPosition}
          onChange={stageLyricLabelPosition =>
            change(stored => ({
              ...stored,
              output: {...stored.output, stageLyricLabelPosition},
            }))
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

/** 준비: defaults for newly created slides. */
export function PrepPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  if (preferences === null) return null;
  const disabled = lockedReason !== undefined;
  return (
    <PropertyGroup title="새 슬라이드 기본 전환">
      {(
        [
          ['songTitle', '곡 제목'],
          ['song', '곡'],
          ['blank', '빈 슬라이드'],
          ['ad', '광고'],
          ['section', '구역 이름'],
          ['sermonTitle', '설교 제목'],
          ['creed', '사도신경'],
          ['prayer', '주기도문'],
          ['bible', '성경 말씀'],
        ] as const satisfies ReadonlyArray<
          readonly [TransitionDefaultKind, string]
        >
      ).map(([key, label]) => {
        const value = preferences.show.slideDefaults[key];
        const update = (next: SlideTransition): void =>
          change(stored => ({
            ...stored,
            show: {
              ...stored.show,
              slideDefaults: {...stored.show?.slideDefaults, [key]: next},
            },
          }));
        return (
          <PropertyRow key={key} label={label}>
            {({controlId}) => (
              <>
                <SelectMenu
                  id={controlId}
                  aria-label={`${label} 효과`}
                  value={value.kind}
                  options={SLIDE_EFFECTS.map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  disabled={disabled}
                  onChange={kind =>
                    update({
                      kind,
                      sec: value.sec,
                      ...(kind === 'push' || kind === 'wipe'
                        ? {dir: value.dir ?? 'left'}
                        : {}),
                    })
                  }
                />
                <SelectMenu
                  aria-label={`${label} 방향`}
                  value={value.dir ?? 'left'}
                  options={SLIDE_DIRECTIONS.map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  disabled={
                    disabled || (value.kind !== 'push' && value.kind !== 'wipe')
                  }
                  onChange={dir => update({...value, dir})}
                />
                <NumberField
                  aria-label={`${label} 시간`}
                  value={value.sec}
                  {...SLIDE_TRANSITION_LIMITS}
                  unit="초"
                  disabled={disabled || value.kind === 'none'}
                  updateOn="commit"
                  onChange={sec => update({...value, sec})}
                />
              </>
            )}
          </PropertyRow>
        );
      })}
    </PropertyGroup>
  );
}

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
export function MediaPage({
  edits,
  audioOutputs,
}: PageProps & {
  readonly audioOutputs: ReturnType<typeof useAudioOutputs>;
}): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  const {devices, loading} = audioOutputs;
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
          loading={loading}
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
          loading={loading}
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
