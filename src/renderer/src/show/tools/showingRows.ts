import {useEffect, useState} from 'react';
import {create} from 'zustand';
import type {Screen} from '@shared/schema/screens';
import type {LooksFile} from '@shared/schema/looks';
import type {LiveState} from '@shared/live';
import type {MediaItem} from '@shared/schema/mediaList';
import type {PropsFile} from '@shared/schema/props';
import type {NoticesFile} from '@shared/schema/notices';
import type {StageLayoutsFile} from '@shared/schema/stageLayouts';
import type {Notice} from '@renderer/ui/notices';
import {isItemRow, type ServiceRow} from '@renderer/show/model';
import type {ShowLibrarySong} from '@shared/schema/showLibrarySong';
import type {MessageId, PropId, ScreenId} from '@shared/schema/ids';
import {
  showsLayer,
  resolveScreenLook,
  type ScreenAppearance,
} from '@renderer/render/screenLook';
import {stageClockText} from '@renderer/render/stageLayout';
import {clearLayer} from '@renderer/state/clear';
import {sendLive, useLive} from '@renderer/state/live';
import {tilesOf, useShow} from '@renderer/state/show';
import {useSettingsDocument} from '@renderer/screens/useSettingsDocument';
import {MISSING_STILL_BACKGROUND_TIP} from '../problemReasons';

export type ShowingKind =
  'text' | 'media' | 'msg' | 'prop' | 'notice' | 'stagemsg' | 'clock';

export interface ShowingItem {
  readonly id: string;
  readonly kind: ShowingKind;
  readonly kindLabel: string;
  readonly icon: string;
  readonly iconTooltip?: string | undefined;
  readonly title: string;
  readonly time?: string | undefined;
  readonly canDismiss: boolean;
  readonly onDismiss?: (() => void) | undefined;
}

export interface ShowingGroup {
  readonly screenId: ScreenId;
  readonly screenName: string;
  readonly items: readonly ShowingItem[];
}

export const useShowingCountStore = create<{
  readonly count: number;
  readonly setCount: (count: number) => void;
}>(set => ({
  count: 0,
  setCount: count => set({count}),
}));

/** The current row count for the 표시 중 tab header badge. */
export function useShowingCount(): number {
  return useShowingCountStore(state => state.count);
}

export interface DismissHandlers {
  readonly onDismissSlide?: () => void;
  readonly onDismissMedia?: () => void;
  readonly onDismissMessage?: (messageId: string) => void;
  readonly onDismissProp?: (propId: string) => void;
  readonly onDismissNotice?: () => void;
  readonly onDismissStageMessage?: () => void;
}

export interface ComputeShowingOptions {
  readonly screens: readonly Screen[];
  readonly looks: LooksFile | null;
  readonly liveState: LiveState | null;
  readonly now: number;
  readonly rows?: readonly ServiceRow[];
  readonly openItemId?: string | null;
  readonly librarySong?: ShowLibrarySong | null;
  readonly mediaItems?: readonly MediaItem[];
  readonly missingMediaIds?: ReadonlySet<string>;
  readonly propsFile?: PropsFile | null;
  readonly noticesFile?: NoticesFile | null;
  readonly stageLayoutsFile?: StageLayoutsFile | null;
  readonly handlers?: DismissHandlers;
}

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Whether an identifier is a standard lowercase UUID v4. */
export function isUuidV4(value: string): value is MessageId & PropId {
  return UUID_V4.test(value);
}

export function dismissSlide(): void {
  clearLayer('slide');
}

export function dismissMedia(): void {
  clearLayer('media');
}

export function dismissMessage(messageId: string): void {
  if (isUuidV4(messageId)) {
    sendLive({
      type: 'overlay.clear',
      target: {kind: 'message', messageId},
    });
  } else {
    clearLayer('message');
  }
}

export function dismissProp(propId: string): void {
  if (isUuidV4(propId)) {
    sendLive({
      type: 'overlay.clear',
      target: {kind: 'prop', propId},
    });
  } else {
    clearLayer('prop');
  }
}

export function dismissNotice(): void {
  clearLayer('notice');
}

export function dismissStageMessage(): void {
  sendLive({
    type: 'overlay.clear',
    target: {kind: 'stage-message'},
  });
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function songTileCount(itemId: string): number {
  try {
    return tilesOf(itemId).length;
  } catch {
    return 0;
  }
}

function slideRow(
  screenId: ScreenId,
  liveState: LiveState,
  options: ComputeShowingOptions,
): ShowingItem | null {
  const slide = liveState.layers.slide;
  if (slide === null) return null;

  const row = options.rows?.find(r => r.id === slide.itemId);
  const songTitle =
    row?.title ??
    (options.openItemId === slide.itemId
      ? options.librarySong?.title
      : undefined) ??
    '가사';

  const total = songTileCount(slide.itemId);
  let title = songTitle;
  if (total > 0) {
    title = `${songTitle} ${slide.position + 1} / ${total}`;
  } else if (slide.label !== null) {
    title = `${songTitle} ${slide.label}`;
  }

  return {
    id: `${screenId}-slide-${slide.itemId}-${slide.position}`,
    kind: 'text',
    kindLabel: '가사',
    icon: 'text',
    title,
    canDismiss: true,
    onDismiss: options.handlers?.onDismissSlide ?? dismissSlide,
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
  const liveRow = options.rows?.find(
    r => r.id === liveState.layers.slide?.itemId,
  );
  const rowMissing =
    liveRow !== undefined &&
    isItemRow(liveRow) &&
    liveRow.problem === 'missing-background';
  const isMissing =
    (options.missingMediaIds?.has(media.mediaId) ?? false) ||
    rowMissing ||
    (mediaItem !== undefined &&
      (options.missingMediaIds?.has(mediaItem.id) ?? false));

  const title = mediaItem?.name ?? media.mediaId;
  const elapsedSec = Math.max(
    0,
    Math.floor((options.now - media.startedAt) / 1000),
  );
  let currentSec = elapsedSec;
  if (
    mediaItem?.duration !== undefined &&
    mediaItem.duration > 0 &&
    media.loop
  ) {
    currentSec = elapsedSec % Math.floor(mediaItem.duration);
  }

  return {
    id: `${screenId}-media-${media.mediaId}`,
    kind: 'media',
    kindLabel: '배경',
    icon: isMissing ? 'pause' : 'image',
    iconTooltip: isMissing ? MISSING_STILL_BACKGROUND_TIP : undefined,
    title,
    time: formatSeconds(currentSec),
    canDismiss: true,
    onDismiss: options.handlers?.onDismissMedia ?? dismissMedia,
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

      items.push({
        id: `${screenId}-msg-${msg.messageId}`,
        kind: 'msg',
        kindLabel: '메시지',
        icon: 'msg',
        title: msg.text,
        time,
        canDismiss: true,
        onDismiss: () =>
          (options.handlers?.onDismissMessage ?? dismissMessage)(msg.messageId),
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
      canDismiss: true,
      onDismiss: () =>
        (options.handlers?.onDismissMessage ?? dismissMessage)(
          msgLayer.messageId,
        ),
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
    for (const activeProp of propLayer.items) {
      if (!activeProp.targets.includes(screenId)) continue;
      const propDef = options.propsFile?.props.find(
        p => p.id === activeProp.propId,
      );
      const title =
        propDef?.name ??
        (activeProp.content.kind === 'text'
          ? activeProp.content.text
          : activeProp.propId);

      items.push({
        id: `${screenId}-prop-${activeProp.propId}`,
        kind: 'prop',
        kindLabel: '소품',
        icon: 'prop',
        title,
        canDismiss: true,
        onDismiss: () =>
          (options.handlers?.onDismissProp ?? dismissProp)(activeProp.propId),
      });
    }
    return items;
  }

  const propDef = options.propsFile?.props.find(p => p.id === propLayer.propId);
  const title = propDef?.name ?? propLayer.propId;
  return [
    {
      id: `${screenId}-prop-${propLayer.propId}`,
      kind: 'prop',
      kindLabel: '소품',
      icon: 'prop',
      title,
      canDismiss: true,
      onDismiss: () =>
        (options.handlers?.onDismissProp ?? dismissProp)(propLayer.propId),
    },
  ];
}

function noticeRow(
  screenId: ScreenId,
  liveState: LiveState,
  options: ComputeShowingOptions,
): ShowingItem | null {
  const noticeLayer = liveState.layers.notice;
  if (noticeLayer === null) return null;

  const playback = noticeLayer.playback;
  const isTarget =
    playback !== undefined ? playback.targets.includes(screenId) : true;
  if (!isTarget) return null;

  const noticeSet = options.noticesFile?.sets.find(
    s => s.id === noticeLayer.noticeId,
  );
  const setName = noticeSet?.name ?? '공지';
  let title = setName;
  if (playback !== undefined && playback.media.length > 0) {
    title = `${setName} ${playback.position + 1} / ${playback.media.length}`;
  }

  return {
    id: `${screenId}-notice-${noticeLayer.noticeId}`,
    kind: 'notice',
    kindLabel: '공지',
    icon: 'notice',
    title,
    canDismiss: true,
    onDismiss: options.handlers?.onDismissNotice ?? dismissNotice,
  };
}

function stageMessageRow(
  screenId: ScreenId,
  liveState: LiveState,
  options: ComputeShowingOptions,
): ShowingItem | null {
  if (
    liveState.stageMessage === null ||
    liveState.stageMessage === undefined ||
    liveState.stageMessage.trim().length === 0
  ) {
    return null;
  }

  return {
    id: `${screenId}-stagemsg`,
    kind: 'stagemsg',
    kindLabel: '무대',
    icon: 'monitor',
    title: liveState.stageMessage,
    canDismiss: true,
    onDismiss: options.handlers?.onDismissStageMessage ?? dismissStageMessage,
  };
}

function clockRow(
  screen: Screen,
  appearance: ScreenAppearance | null,
  options: ComputeShowingOptions,
): ShowingItem {
  const layoutId =
    options.liveState?.stageLayouts?.[screen.id] ?? appearance?.stageLayout;
  const layout = options.stageLayoutsFile?.layouts.find(l => l.id === layoutId);
  const clockEl = layout?.elements.find(e => e.kind === 'clock');
  const format = clockEl?.clockFormat ?? '24h';
  const title = stageClockText(options.now, format);

  return {
    id: `${screen.id}-clock`,
    kind: 'clock',
    kindLabel: '시계',
    icon: 'clock',
    title,
    canDismiss: false,
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
    const item = stageMessageRow(screen.id, liveState, options);
    if (item !== null) items.push(item);
  }

  if (showsLayer(appearance, 'clock')) {
    items.push(clockRow(screen, appearance, options));
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

function useCurrentTime(externalNow?: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (externalNow !== undefined) return undefined;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, [externalNow]);

  return externalNow ?? now;
}

/** Reads documents and live state to calculate showing tab groups and total count. */
export function useShowingGroups(
  onProblem?: (notice: Notice) => void,
  externalNow?: number,
): {readonly groups: readonly ShowingGroup[]; readonly count: number} {
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const looks = useSettingsDocument('looks', 'Look', onProblem);
  const propsDoc = useSettingsDocument('props', '소품', onProblem);
  const noticesDoc = useSettingsDocument('notices', '공지', onProblem);
  const stageLayoutsDoc = useSettingsDocument(
    'stage-layouts',
    '무대 배치',
    onProblem,
  );
  const liveState = useLive(view => view.state);
  const rows = useShow(view => view.rows);
  const openItemId = useShow(view => view.openItemId);
  const librarySong = useShow(view => view.librarySong);

  const [mediaItems, setMediaItems] = useState<readonly MediaItem[]>([]);
  const [missingMediaIds, setMissingMediaIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  useEffect(() => {
    const api = window.llp;
    if (api?.media === undefined) return undefined;
    let active = true;

    api.media
      .get()
      .then(doc => {
        if (active) {
          setMediaItems(doc.value.items);
        }
      })
      .catch(() => undefined);

    const unsubMedia = api.media.subscribe(doc => {
      if (active) {
        setMediaItems(doc.value.items);
      }
    });

    api.media
      .missing()
      .then(missing => {
        if (active) {
          setMissingMediaIds(new Set(missing));
        }
      })
      .catch(() => undefined);

    const unsubMissing = api.media.subscribeMissing(missing => {
      if (active) {
        setMissingMediaIds(new Set(missing));
      }
    });

    return () => {
      active = false;
      unsubMedia();
      unsubMissing();
    };
  }, []);

  const now = useCurrentTime(externalNow);

  const groups = computeShowingGroups({
    screens: screens?.value.screens ?? [],
    looks: looks?.value ?? null,
    liveState,
    now,
    rows,
    openItemId,
    librarySong,
    mediaItems,
    missingMediaIds,
    propsFile: propsDoc?.value ?? null,
    noticesFile: noticesDoc?.value ?? null,
    stageLayoutsFile: stageLayoutsDoc?.value ?? null,
  });

  const count = groups.reduce((acc, g) => acc + g.items.length, 0);

  useEffect(() => {
    useShowingCountStore.getState().setCount(count);
  }, [count]);

  return {groups, count};
}
