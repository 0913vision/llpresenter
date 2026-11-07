import type {SettingsReader} from '@core/schema/settingsReader';
import type {LabelColor} from '@core/labels/colors';
import type {SingleLiveCommand} from '@core/live/commands';
import type {ActiveMessage, LiveState} from '@core/live/state';
import type {ScreenId} from '@core/schema/ids';
import type {RecoverySummary} from '@core/schema/recovery';
import type {RecoveryRecord} from '@core/schema/recoveryRecord';
import type {Screen} from '@core/schema/screens';
import {
  isItemOfKind,
  type Service,
  type ServiceItemOf,
} from '@core/schema/service';
import type {ServiceId} from '@core/schema/ids';
import type {Song} from '@core/schema/song';
import {songTiles} from '../../store/showService';
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
  song(id: string): {readonly song: Song} | null;
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
 * it had left.
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

function outputsStep(
  {outputs}: LiveState,
  screens: readonly Screen[],
): RecoveryStep | null {
  const restored = screens.filter(({id}) => outputs[id] === true);
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
  const slideCount = songTiles(
    {...song, slides: item.slides},
    NO_LABEL_COLORS,
  ).length;
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
  const counts = {
    messages: messages.length,
    props: props.length,
    stageMessages: stage.length,
  };
  if (Object.values(counts).every(count => count === 0)) return null;
  return {
    row: {kind: 'showing', counts},
    commands: [...props, ...messages, ...stage],
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
