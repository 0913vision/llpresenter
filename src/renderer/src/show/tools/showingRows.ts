import type {Screen} from '@core/schema/screens';
import type {LiveState, SlideLayer} from '@core/live/state';
import type {ScreenId} from '@core/schema/ids';
import {
  showsLayer,
  resolveScreenLook,
  type ScreenAppearance,
} from '@renderer/render/screenLook';
import {stageClockText} from '@renderer/render/stageLayout';
import {tilesOf} from '@renderer/state/show';
import {passageBook} from '../bible/adjacentVerses';
import type {BibleSource} from '../bible/source';
import {MISSING_STILL_BACKGROUND_TIP} from '../problemReasons';
import type {
  ShowingItem,
  ShowingGroup,
  ComputeShowingOptions,
} from './showingTypes';

export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function songTileCount(itemId: string): number {
  try {
    return tilesOf(itemId).length;
  } catch {
    return 0;
  }
}

function bibleSlideTitle(
  slide: SlideLayer,
  source: BibleSource | null | undefined,
): string | undefined {
  if (source?.id !== slide.itemId || slide.label === null) return undefined;
  const book = passageBook(source.passage);
  return book === undefined ? undefined : `${book.korean} ${slide.label}`;
}

function songSlideTitle(
  slide: SlideLayer,
  options: ComputeShowingOptions,
): string {
  const row = options.rows?.find(r => r.id === slide.itemId);
  const songTitle =
    row?.title ??
    (options.openItemId === slide.itemId
      ? options.librarySong?.title
      : undefined) ??
    '가사';
  const total = songTileCount(slide.itemId);
  if (total > 0) return `${songTitle} ${slide.position + 1} / ${total}`;
  return slide.label === null ? songTitle : `${songTitle} ${slide.label}`;
}

function slideRow(
  screenId: ScreenId,
  liveState: LiveState,
  options: ComputeShowingOptions,
): ShowingItem | null {
  const slide = liveState.layers.slide;
  if (slide === null) return null;
  return {
    id: `${screenId}-slide-${slide.itemId}-${slide.position}`,
    kind: 'text',
    kindLabel: '가사',
    icon: 'text',
    title:
      bibleSlideTitle(slide, options.liveBibleSource) ??
      songSlideTitle(slide, options),
    dismiss: {kind: 'slide'},
  };
}

function mediaRow(
  screenId: ScreenId,
  liveState: LiveState,
  options: ComputeShowingOptions,
): ShowingItem | null {
  const media = liveState.layers.media;
  if (media === null) return null;

  const mediaItem = options.mediaItems?.find(m => m.id === media.mediaId);
  const isVideo = mediaItem?.kind === 'video';
  const isMissing = options.missingMediaIds?.has(media.mediaId) === true;
  const isStillMissingVideo = isMissing && isVideo;

  const title = mediaItem?.name ?? '배경';
  let time: string | undefined;

  const duration = mediaItem?.duration;
  if (isVideo && duration !== undefined && duration > 0) {
    const totalSec = Math.max(1, Math.floor(duration));
    const elapsedSec = Math.max(
      0,
      Math.floor((options.now - media.startedAt) / 1000),
    );
    const currentSec = media.loop
      ? elapsedSec % totalSec
      : Math.min(elapsedSec, totalSec);
    time = formatSeconds(currentSec);
  }

  return {
    id: `${screenId}-media-${media.mediaId}`,
    kind: 'media',
    kindLabel: '배경',
    icon: isStillMissingVideo ? 'pause' : 'image',
    iconTooltip: isStillMissingVideo ? MISSING_STILL_BACKGROUND_TIP : undefined,
    title,
    time,
    dismiss: {kind: 'media'},
  };
}

function messageRows(
  screenId: ScreenId,
  liveState: LiveState,
  options: ComputeShowingOptions,
): readonly ShowingItem[] {
  const msgLayer = liveState.layers.message;
  if (msgLayer === null) return [];

  if (msgLayer.items !== undefined && msgLayer.items.length > 0) {
    const items: ShowingItem[] = [];
    for (const msg of msgLayer.items) {
      const isTarget =
        (msg.targets === 'all' || msg.targets.includes(screenId)) &&
        !msg.excludedTargets.includes(screenId);
      if (!isTarget) continue;
      if (msg.expiresAt !== null && msg.expiresAt <= options.now) continue;

      let time: string | undefined;
      if (msg.expiresAt !== null) {
        const remainingSec = Math.max(
          0,
          Math.ceil((msg.expiresAt - options.now) / 1000),
        );
        time = formatSeconds(remainingSec);
      }

      const messageId = msg.messageId;
      items.push({
        id: `${screenId}-msg-${messageId}`,
        kind: 'msg',
        kindLabel: '메시지',
        icon: 'msg',
        title: msg.text,
        time,
        dismiss: {kind: 'message', messageId},
      });
    }
    return items;
  }

  return [
    {
      id: `${screenId}-msg-${msgLayer.messageId}`,
      kind: 'msg',
      kindLabel: '메시지',
      icon: 'msg',
      title: msgLayer.text,
      dismiss: {kind: 'message', messageId: msgLayer.messageId},
    },
  ];
}

function propRows(
  screenId: ScreenId,
  liveState: LiveState,
  options: ComputeShowingOptions,
): readonly ShowingItem[] {
  const propLayer = liveState.layers.prop;
  if (propLayer === null) return [];

  if (propLayer.items !== undefined && propLayer.items.length > 0) {
    const items: ShowingItem[] = [];
    for (const prop of propLayer.items) {
      if (!prop.targets.includes(screenId)) continue;
      const propId = prop.propId;
      const propDef = options.propsFile?.props.find(p => p.id === propId);
      const title =
        propDef?.name ??
        (prop.content.kind === 'text' ? prop.content.text : undefined) ??
        '소품';

      items.push({
        id: `${screenId}-prop-${propId}`,
        kind: 'prop',
        kindLabel: '소품',
        icon: 'component',
        title,
        dismiss: {kind: 'prop', propId},
      });
    }
    return items;
  }

  const propDef = options.propsFile?.props.find(p => p.id === propLayer.propId);
  return [
    {
      id: `${screenId}-prop-${propLayer.propId}`,
      kind: 'prop',
      kindLabel: '소품',
      icon: 'component',
      title: propDef?.name ?? '소품',
      dismiss: {kind: 'prop', propId: propLayer.propId},
    },
  ];
}

function noticeRow(
  screenId: ScreenId,
  liveState: LiveState,
  options: ComputeShowingOptions,
): ShowingItem | null {
  const notice = liveState.layers.notice;
  if (notice === null) return null;

  const isTarget =
    notice.playback !== undefined
      ? notice.playback.targets.includes(screenId)
      : true;
  if (!isTarget) return null;

  const noticeSet = options.noticesFile?.sets.find(
    s => s.id === notice.noticeId,
  );
  let title = noticeSet?.name ?? '공지';
  if (notice.playback !== undefined && notice.playback.media.length > 0) {
    title = `${title} ${notice.playback.position + 1} / ${notice.playback.media.length}`;
  }

  return {
    id: `${screenId}-notice-${notice.noticeId}`,
    kind: 'notice',
    kindLabel: '공지',
    icon: 'bell',
    title,
    dismiss: {kind: 'notice'},
  };
}

function stageMessageRow(
  screenId: ScreenId,
  liveState: LiveState,
): ShowingItem | null {
  const stageMsg = liveState.stageMessage;
  if (
    stageMsg === null ||
    stageMsg === undefined ||
    stageMsg.trim().length === 0
  ) {
    return null;
  }

  return {
    id: `${screenId}-stagemsg`,
    kind: 'stagemsg',
    kindLabel: '무대',
    icon: 'display',
    title: stageMsg,
    dismiss: {kind: 'stage-message'},
  };
}

function clockRow(
  screen: Screen,
  appearance: ScreenAppearance | null,
  options: ComputeShowingOptions,
): ShowingItem | null {
  const layoutId =
    options.liveState?.stageLayouts?.[screen.id] ?? appearance?.stageLayout;
  const layout = options.stageLayoutsFile?.layouts.find(l => l.id === layoutId);
  const clockEl = layout?.elements.find(e => e.kind === 'clock');
  if (!clockEl) return null;
  const format = clockEl.clockFormat ?? '24h';
  const clockText = stageClockText(options.now, format);

  return {
    id: `${screen.id}-clock`,
    kind: 'clock',
    kindLabel: '시계',
    icon: 'clock',
    title: clockText,
  };
}

function computeAudienceItems(
  screen: Screen,
  appearance: ScreenAppearance | null,
  options: ComputeShowingOptions,
): readonly ShowingItem[] {
  const liveState = options.liveState;
  if (liveState === null) return [];

  const items: ShowingItem[] = [];

  if (showsLayer(appearance, 'slide')) {
    const item = slideRow(screen.id, liveState, options);
    if (item !== null) items.push(item);
  }

  if (showsLayer(appearance, 'media')) {
    const item = mediaRow(screen.id, liveState, options);
    if (item !== null) items.push(item);
  }

  if (showsLayer(appearance, 'message')) {
    items.push(...messageRows(screen.id, liveState, options));
  }

  if (showsLayer(appearance, 'prop')) {
    items.push(...propRows(screen.id, liveState, options));
  }

  if (showsLayer(appearance, 'notice')) {
    const item = noticeRow(screen.id, liveState, options);
    if (item !== null) items.push(item);
  }

  return items;
}

function computeStageItems(
  screen: Screen,
  appearance: ScreenAppearance | null,
  options: ComputeShowingOptions,
): readonly ShowingItem[] {
  const liveState = options.liveState;
  if (liveState === null) return [];

  const items: ShowingItem[] = [];

  if (showsLayer(appearance, 'stageMessage')) {
    const item = stageMessageRow(screen.id, liveState);
    if (item !== null) items.push(item);
  }

  if (showsLayer(appearance, 'clock')) {
    const clock = clockRow(screen, appearance, options);
    if (clock !== null) items.push(clock);
  }

  return items;
}

/** Computes the rows displayed in the 표시 중 tab grouped by screen. */
export function computeShowingGroups(
  options: ComputeShowingOptions,
): readonly ShowingGroup[] {
  const {screens, looks, liveState} = options;
  if (liveState === null || screens.length === 0) return [];

  const groups: ShowingGroup[] = [];

  for (const screen of screens) {
    const {appearance} = resolveScreenLook(looks, liveState.lookId, screen);
    const items =
      screen.kind === 'audience'
        ? computeAudienceItems(screen, appearance, options)
        : computeStageItems(screen, appearance, options);

    if (items.length > 0) {
      groups.push({
        screenId: screen.id,
        screenName: screen.name || '화면',
        items,
      });
    }
  }

  return groups;
}

/** Computes the total row count across all screens for the tab header badge. */
export function computeShowingCount(options: ComputeShowingOptions): number {
  return computeShowingGroups(options).reduce(
    (acc, group) => acc + group.items.length,
    0,
  );
}
