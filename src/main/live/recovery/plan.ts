import type {LabelColor} from '@shared/colors';
import type {SingleLiveCommand} from '@shared/commands';
import type {ActiveMessage, LiveState} from '@shared/live';
import {noticePosition} from '@shared/noticeClock';
import type {ScreenId} from '@shared/schema/ids';
import type {RecoverySummary} from '@shared/schema/recovery';
import type {RecoveryRecord} from '@shared/schema/recoveryRecord';
import type {Screen} from '@shared/schema/screens';
import {
  isItemOfKind,
  type Service,
  type ServiceItemOf,
} from '@shared/schema/service';
import type {ServiceId} from '@shared/schema/ids';
import type {GroupedSong} from '@shared/schema/groupedSong';
import type {SettingsReader} from '../../store/settingsStore';
import {songTiles} from '../../store/showService';
import {outputStateKeys} from '@shared/screens';
import {savedScreens, switchableScreens} from '../../outputs/savedScreens';

const MILLISECONDS_PER_SECOND = 1000;
const NO_LABEL_COLORS: ReadonlyMap<string, LabelColor> = new Map();

export type RecoveryRow = NonNullable<RecoverySummary>['rows'][number];

/** One row of the recovery dialog and the commands that restore it. */
export interface RecoveryStep {
  readonly row: RecoveryRow;
  readonly commands: readonly SingleLiveCommand[];
}

/** The documents of the content store that a recorded 슬라이드 is checked against. */
export interface RecoveryContent {
  serviceList(): ReadonlyArray<{readonly id: string}>;
  service(id: string): {readonly service: Pick<Service, 'id' | 'order'>} | null;
  song(id: string): {readonly song: GroupedSong} | null;
}

/** The current settings and content that a recorded state is checked against. */
export interface RecoverySources {
  readonly settings: Pick<SettingsReader, 'get'>;
  readonly content: RecoveryContent;
}

/**
 * The rows a recovery record can still restore, in the order spec 08 applies
 * them: outputs, then the live 슬라이드 as it was captured and its background,
 * then the items that were showing. A row with nothing left to restore is left
 * out. Clocks resume from the record's time: a message keeps the display time
 * it had left and a 공지 restarts from the image it showed.
 */
export function planRecovery(
  record: RecoveryRecord,
  {settings, content}: RecoverySources,
): readonly RecoveryStep[] {
  const steps = [
    outputsStep(record.state, switchableScreens(settings)),
    slideStep(record, content),
    showingStep(record, settings),
  ];
  return steps.filter(step => step !== null);
}

/** The record's Look, which restore applies while it still exists (spec 02). */
export function lookCommands(
  {lookId}: LiveState,
  settings: Pick<SettingsReader, 'get'>,
): readonly SingleLiveCommand[] {
  if (lookId == null) return [];
  const document = settings.get('looks');
  const exists =
    document.name === 'looks' &&
    document.value.looks.some(({id}) => id === lookId);
  return exists ? [{type: 'look.set', lookId}] : [];
}

function outputsStep(
  {outputs}: LiveState,
  screens: readonly Screen[],
): RecoveryStep | null {
  const restored = screens.filter(({id}) =>
    outputStateKeys(id).some(key => outputs[key] === true),
  );
  if (restored.length === 0) return null;
  return {
    row: {
      kind: 'outputs',
      screens: restored.map(({id, name}) => ({screenId: id, name})),
    },
    commands: restored.map(({id}) => ({
      type: 'output.set',
      screenId: id,
      on: true,
    })),
  };
}

interface SourceItem {
  readonly serviceId: ServiceId;
  readonly item: ServiceItemOf<'song'>;
}

// NOTE(0913vision): The record names the service open at its last write,
// which can differ from the one the live 슬라이드 came from, so every service
// is searched after the recorded one. Item ids are unique across services.
function sourceSongItem(
  content: RecoveryContent,
  serviceId: string | null,
  itemId: string,
): SourceItem | null {
  const others = content
    .serviceList()
    .map(({id}) => id)
    .filter(id => id !== serviceId);
  for (const id of serviceId === null ? others : [serviceId, ...others]) {
    const service = content.service(id)?.service;
    const item = service?.order.find(entry => entry.id === itemId);
    if (service === undefined || item === undefined) continue;
    return isItemOfKind(item, 'song') ? {serviceId: service.id, item} : null;
  }
  return null;
}

function slideStep(
  {serviceId: recordedServiceId, state}: RecoveryRecord,
  content: RecoveryContent,
): RecoveryStep | null {
  const slide = state.layers.slide;
  if (slide === null) return null;
  const source = sourceSongItem(content, recordedServiceId, slide.itemId);
  if (source === null) return null;
  const {serviceId, item} = source;
  const song = content.song(item.song)?.song;
  if (song === undefined) return null;
  const slideCount = songTiles(song, NO_LABEL_COLORS, item.arrangement).length;
  if (slide.position >= slideCount) return null;
  const media = state.layers.media;
  const commands: SingleLiveCommand[] = [{type: 'slide.show', slide}];
  if (media !== null) {
    commands.push({
      type: 'media.show',
      media: {mediaId: media.mediaId, loop: media.loop},
    });
  }
  return {
    row: {
      kind: 'slide',
      slide: {
        serviceId,
        itemId: item.id,
        title: song.title,
        position: slide.position,
        slideCount,
      },
    },
    commands,
  };
}

function showingStep(
  {state, savedAt}: RecoveryRecord,
  settings: Pick<SettingsReader, 'get'>,
): RecoveryStep | null {
  const savedAtMs = Date.parse(savedAt);
  const props = propCommands(state, settings);
  const messages = messageCommands(
    state,
    savedScreens(settings).map(({id}) => id),
    savedAtMs,
  );
  const stage = stageMessageCommands(state);
  const notice = noticeCommands(state, settings, savedAtMs);
  const counts = {
    messages: messages.length,
    props: props.length,
    stageMessages: stage.length,
    notices: notice.length === 0 ? 0 : 1,
    // TODO(0913vision): Count and restore the stage layouts once the live
    // state holds them (spec 08, proposal).
    stageLayouts: 0,
  };
  if (Object.values(counts).every(count => count === 0)) return null;
  return {
    row: {kind: 'showing', counts},
    commands: [...props, ...messages, ...stage, ...notice],
  };
}

function propCommands(
  {layers: {prop}}: LiveState,
  settings: Pick<SettingsReader, 'get'>,
): SingleLiveCommand[] {
  if (prop === null) return [];
  const document = settings.get('props');
  const saved = document.name === 'props' ? document.value.props : [];
  const recorded = prop.items?.map(({propId}) => propId) ?? [prop.propId];
  return recorded.flatMap(id => {
    const found = saved.find(item => item.id === id);
    return found === undefined
      ? []
      : [{type: 'prop.set', propId: found.id, on: true}];
  });
}

function messageCommands(
  {layers: {message}}: LiveState,
  screens: readonly ScreenId[],
  savedAt: number,
): SingleLiveCommand[] {
  if (message === null) return [];
  if (message.items === undefined) return [{type: 'message.show', message}];
  return message.items.flatMap(item => {
    if (item.expiresAt !== null && item.expiresAt <= savedAt) return [];
    const targets = messageTargets(item, screens);
    if (targets === null) return [];
    return [
      {
        type: 'message.send',
        text: item.text,
        targets,
        duration:
          item.expiresAt === null
            ? null
            : (item.expiresAt - savedAt) / MILLISECONDS_PER_SECOND,
      },
    ];
  });
}

function messageTargets(
  {targets, excludedTargets}: ActiveMessage,
  screens: readonly ScreenId[],
): 'all' | readonly ScreenId[] | null {
  if (targets === 'all' && excludedTargets.length === 0) return 'all';
  const wanted = targets === 'all' ? screens : targets;
  const kept = wanted.filter(
    id => screens.includes(id) && !excludedTargets.includes(id),
  );
  return kept.length === 0 ? null : kept;
}

function stageMessageCommands({stageMessage}: LiveState): SingleLiveCommand[] {
  return stageMessage == null
    ? []
    : [{type: 'stage.message.set', text: stageMessage}];
}

function noticeCommands(
  {layers: {notice}}: LiveState,
  settings: Pick<SettingsReader, 'get'>,
  savedAt: number,
): SingleLiveCommand[] {
  if (notice === null) return [];
  const document = settings.get('notices');
  const set =
    document.name === 'notices'
      ? document.value.sets.find(({id}) => id === notice.noticeId)
      : undefined;
  if (set === undefined || set.media.length === 0) return [];
  const {playback} = notice;
  const shown =
    playback === undefined
      ? undefined
      : playback.media[noticePosition(playback, savedAt)];
  const start: SingleLiveCommand = {
    type: 'notice.start',
    noticeId: set.id,
    position: shown === undefined ? 0 : Math.max(0, set.media.indexOf(shown)),
  };
  return playback?.pausedAt == null ? [start] : [start, {type: 'notice.pause'}];
}
