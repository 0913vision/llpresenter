import {useEffect, useMemo, useState} from 'react';
import type {Screen} from '@shared/schema/screens';
import type {LooksFile} from '@shared/schema/looks';
import type {LiveState} from '@shared/live';
import type {MediaItem} from '@shared/schema/mediaList';
import type {PropsFile} from '@shared/schema/props';
import type {NoticesFile} from '@shared/schema/notices';
import type {StageLayoutsFile} from '@shared/schema/stageLayouts';
import type {Notice} from '@renderer/ui/notices';
import type {ServiceRow} from '@renderer/show/model';
import type {ShowLibrarySong} from '@shared/schema/showLibrarySong';
import {messageIdSchema, propIdSchema, type ScreenId} from '@shared/schema/ids';
import {parsePayload} from '@shared/schema/payload';
import {
  showsLayer,
  resolveScreenLook,
  type ScreenAppearance,
} from '@renderer/render/screenLook';
import {stageClockText} from '@renderer/render/stageLayout';
import {clearLayer} from '@renderer/state/clear';
import {sendLive, useLive} from '@renderer/state/live';
import {tilesOf, useShow} from '@renderer/state/show';
import {
  useSettingsDocument,
  type NamedDocument,
} from '@renderer/screens/useSettingsDocument';
import {MISSING_STILL_BACKGROUND_TIP} from '../problemReasons';

const EMPTY_SCREENS: readonly Screen[] = [];

export type ShowingKind =
  'text' | 'media' | 'msg' | 'prop' | 'notice' | 'stagemsg' | 'clock';

export type DismissDescriptor =
  | {readonly kind: 'slide'}
  | {readonly kind: 'media'}
  | {readonly kind: 'message'; readonly messageId: string}
  | {readonly kind: 'prop'; readonly propId: string}
  | {readonly kind: 'notice'}
  | {readonly kind: 'stage-message'};

export interface ShowingItem {
  readonly id: string;
  readonly kind: ShowingKind;
  readonly kindLabel: string;
  readonly icon: string;
  readonly iconTooltip?: string | undefined;
  readonly title: string;
  readonly time?: string | undefined;
  readonly dismiss?: DismissDescriptor | undefined;
}

export interface ShowingGroup {
  readonly screenId: ScreenId;
  readonly screenName: string;
  readonly items: readonly ShowingItem[];
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
}

export function dismissSlide(): void {
  clearLayer('slide');
}

export function dismissMedia(): void {
  clearLayer('media');
}

/** Dismisses an active message row, or falls back to whole-layer clear for legacy single-item layers. */
export function dismissMessage(messageId: string): void {
  const parsed = parsePayload(messageIdSchema, messageId);
  if (parsed.ok) {
    sendLive({
      type: 'overlay.clear',
      target: {kind: 'message', messageId: parsed.value},
    });
    return;
  }
  const currentMsgLayer = useLive.getState().state?.layers.message;
  const itemCount = currentMsgLayer?.items?.length ?? 0;
  if (itemCount <= 1) {
    clearLayer('message');
  }
}

/** Dismisses an active prop row, or falls back to whole-layer clear for legacy single-item layers. */
export function dismissProp(propId: string): void {
  const parsed = parsePayload(propIdSchema, propId);
  if (parsed.ok) {
    sendLive({
      type: 'overlay.clear',
      target: {kind: 'prop', propId: parsed.value},
    });
    return;
  }
  const currentPropLayer = useLive.getState().state?.layers.prop;
  const itemCount = currentPropLayer?.items?.length ?? 0;
  if (itemCount <= 1) {
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

/** Executes the appropriate clear command for a dismiss descriptor. */
export function executeDismiss(descriptor: DismissDescriptor): void {
  switch (descriptor.kind) {
    case 'slide':
      dismissSlide();
      break;
    case 'media':
      dismissMedia();
      break;
    case 'message':
      dismissMessage(descriptor.messageId);
      break;
    case 'prop':
      dismissProp(descriptor.propId);
      break;
    case 'notice':
      dismissNotice();
      break;
    case 'stage-message':
      dismissStageMessage();
      break;
  }
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
    const elapsedSec = Math.max(
      0,
      Math.floor((options.now - media.startedAt) / 1000),
    );
    let currentSec = elapsedSec;
    if (media.loop) {
      currentSec = elapsedSec % Math.floor(duration);
    }
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

      items.push({
        id: `${screenId}-msg-${msg.messageId}`,
        kind: 'msg',
        kindLabel: '메시지',
        icon: 'msg',
        title: msg.text,
        time,
        dismiss: {kind: 'message', messageId: msg.messageId},
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
    for (const activeProp of propLayer.items) {
      if (!activeProp.targets.includes(screenId)) continue;
      const propDef = options.propsFile?.props.find(
        p => p.id === activeProp.propId,
      );
      const title =
        propDef?.name ??
        (activeProp.content.kind === 'text' ? activeProp.content.text : '소품');

      items.push({
        id: `${screenId}-prop-${activeProp.propId}`,
        kind: 'prop',
        kindLabel: '소품',
        icon: 'prop',
        title,
        dismiss: {kind: 'prop', propId: activeProp.propId},
      });
    }
    return items;
  }

  const propDef = options.propsFile?.props.find(p => p.id === propLayer.propId);
  const title = propDef?.name ?? '소품';
  return [
    {
      id: `${screenId}-prop-${propLayer.propId}`,
      kind: 'prop',
      kindLabel: '소품',
      icon: 'prop',
      title,
      dismiss: {kind: 'prop', propId: propLayer.propId},
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
    dismiss: {kind: 'notice'},
  };
}

function stageMessageRow(
  screenId: ScreenId,
  liveState: LiveState,
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
    dismiss: {kind: 'stage-message'},
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

function hasMovingSeconds(
  screens: readonly Screen[],
  looks: LooksFile | null,
  liveState: LiveState | null,
): boolean {
  if (liveState === null || screens.length === 0) return false;
  const hasMedia = liveState.layers.media !== null;
  const hasTimedMessage =
    liveState.layers.message?.items?.some(m => m.expiresAt !== null) === true;

  if (!hasMedia && !hasTimedMessage) return false;

  for (const screen of screens) {
    if (screen.kind !== 'audience') continue;
    const {appearance} = resolveScreenLook(looks, liveState.lookId, screen);
    if (hasMedia && showsLayer(appearance, 'media')) return true;
    if (hasTimedMessage && showsLayer(appearance, 'message')) return true;
  }
  return false;
}

function hasClockRow(
  screens: readonly Screen[],
  looks: LooksFile | null,
  liveState: LiveState | null,
): boolean {
  if (liveState === null || screens.length === 0) return false;
  for (const screen of screens) {
    if (screen.kind !== 'stage') continue;
    const {appearance} = resolveScreenLook(looks, liveState.lookId, screen);
    if (showsLayer(appearance, 'clock')) return true;
  }
  return false;
}

export interface ClockOptions {
  readonly screens: readonly Screen[];
  readonly looks: LooksFile | null;
  readonly liveState: LiveState | null;
  readonly externalNow?: number | undefined;
}

/** Ticks time only while a timed row exists: at 1 s for seconds, or at minute boundaries for the clock. */
export function useShowingClock(options: ClockOptions): number {
  const {screens, looks, liveState, externalNow} = options;
  const [internalNow, setInternalNow] = useState(() => Date.now());

  useEffect(() => {
    if (externalNow !== undefined) {
      return undefined;
    }

    if (hasMovingSeconds(screens, looks, liveState)) {
      const timer = setInterval(() => {
        setInternalNow(Date.now());
      }, 1000);
      return () => {
        clearInterval(timer);
      };
    }

    if (hasClockRow(screens, looks, liveState)) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const scheduleNext = () => {
        const current = Date.now();
        const seconds = new Date(current).getSeconds();
        const ms = Math.max(1000, (60 - seconds) * 1000);
        timeoutId = setTimeout(() => {
          setInternalNow(Date.now());
          scheduleNext();
        }, ms);
      };
      scheduleNext();
      return () => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      };
    }

    return undefined;
  }, [externalNow, screens, looks, liveState]);

  return externalNow ?? internalNow;
}

function countMessageRows(
  screenId: ScreenId,
  appearance: ScreenAppearance | null,
  options: ShowingCountOptions,
): number {
  const {liveState, now} = options;
  if (liveState?.layers.message == null || !showsLayer(appearance, 'message')) {
    return 0;
  }
  const msg = liveState.layers.message;
  if (msg.items === undefined || msg.items.length === 0) {
    return 1;
  }
  let count = 0;
  for (const item of msg.items) {
    const isTarget =
      (item.targets === 'all' || item.targets.includes(screenId)) &&
      !item.excludedTargets.includes(screenId);
    if (isTarget && (item.expiresAt === null || item.expiresAt > now)) {
      count++;
    }
  }
  return count;
}

function countPropRows(
  screenId: ScreenId,
  appearance: ScreenAppearance | null,
  liveState: LiveState,
): number {
  if (liveState.layers.prop === null || !showsLayer(appearance, 'prop')) {
    return 0;
  }
  const prop = liveState.layers.prop;
  if (prop.items === undefined || prop.items.length === 0) {
    return 1;
  }
  let count = 0;
  for (const item of prop.items) {
    if (item.targets.includes(screenId)) {
      count++;
    }
  }
  return count;
}

function countAudienceRows(
  screenId: ScreenId,
  appearance: ScreenAppearance | null,
  options: ShowingCountOptions,
): number {
  const {liveState} = options;
  if (liveState === null) {
    return 0;
  }
  let count = 0;
  if (liveState.layers.slide !== null && showsLayer(appearance, 'slide')) {
    count++;
  }
  if (liveState.layers.media !== null && showsLayer(appearance, 'media')) {
    count++;
  }
  count += countMessageRows(screenId, appearance, options);
  count += countPropRows(screenId, appearance, liveState);
  if (liveState.layers.notice !== null && showsLayer(appearance, 'notice')) {
    const notice = liveState.layers.notice;
    const isTarget =
      notice.playback !== undefined
        ? notice.playback.targets.includes(screenId)
        : true;
    if (isTarget) count++;
  }
  return count;
}

function countStageRows(
  appearance: ScreenAppearance | null,
  liveState: LiveState,
): number {
  let count = 0;
  if (
    liveState.stageMessage !== null &&
    liveState.stageMessage !== undefined &&
    liveState.stageMessage.trim().length > 0 &&
    showsLayer(appearance, 'stageMessage')
  ) {
    count++;
  }
  if (showsLayer(appearance, 'clock')) {
    count++;
  }
  return count;
}

export interface ShowingCountOptions {
  readonly screens: readonly Screen[];
  readonly looks: LooksFile | null;
  readonly liveState: LiveState | null;
  readonly now: number;
}

/** Computes the total row count across all screens for the tab header badge. */
export function computeShowingCount(options: ShowingCountOptions): number {
  const {screens, looks, liveState} = options;
  if (liveState === null || screens.length === 0) return 0;
  let count = 0;

  for (const screen of screens) {
    const {appearance} = resolveScreenLook(looks, liveState.lookId, screen);
    if (screen.kind === 'audience') {
      count += countAudienceRows(screen.id, appearance, options);
    } else {
      count += countStageRows(appearance, liveState);
    }
  }

  return count;
}

/** Hook for ShowToolsPanel to get the showing tab badge count without depending on ShowingTab. */
export function useShowingCount(
  externalScreens?: readonly Screen[],
  externalLooks?: LooksFile | null,
): number {
  const liveState = useLive(view => view.state);
  const [screens, setScreens] = useState<readonly Screen[]>(
    externalScreens ?? EMPTY_SCREENS,
  );
  const [looks, setLooks] = useState<LooksFile | null>(externalLooks ?? null);

  useEffect(() => {
    if (externalScreens !== undefined && externalLooks !== undefined) {
      return undefined;
    }
    const api = window.llp;
    if (!api) return undefined;
    let active = true;
    api.settings
      .get({name: 'screens'})
      .then(res => {
        if (active && res.name === 'screens') {
          setScreens(res.value.screens);
        }
      })
      .catch(() => undefined);
    api.settings
      .get({name: 'looks'})
      .then(res => {
        if (active && res.name === 'looks') {
          setLooks(res.value);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [externalScreens, externalLooks, liveState?.lookId]);

  const effectiveScreens = externalScreens ?? screens;
  const effectiveLooks = externalLooks !== undefined ? externalLooks : looks;
  const now = useShowingClock({
    screens: effectiveScreens,
    looks: effectiveLooks,
    liveState,
  });
  return useMemo(
    () =>
      computeShowingCount({
        screens: effectiveScreens,
        looks: effectiveLooks,
        liveState,
        now,
      }),
    [effectiveScreens, effectiveLooks, liveState, now],
  );
}

export interface ShowingGroupsResult {
  readonly groups: readonly ShowingGroup[];
  readonly count: number;
}

export interface ShowingGroupsOptions {
  readonly screensDoc?: NamedDocument<'screens'> | null | undefined;
  readonly looksDoc?: NamedDocument<'looks'> | null | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly externalNow?: number | undefined;
}

/** Reads documents and live state to calculate showing tab groups and total count. */
export function useShowingGroups(
  options: ShowingGroupsOptions = {},
): ShowingGroupsResult {
  const {screensDoc, looksDoc, onProblem, externalNow} = options;

  const fallbackScreens = useSettingsDocument(
    screensDoc !== undefined ? null : 'screens',
    '화면',
    onProblem,
  );
  const fallbackLooks = useSettingsDocument(
    looksDoc !== undefined ? null : 'looks',
    'Look',
    onProblem,
  );
  const effectiveScreensDoc = screensDoc ?? fallbackScreens;
  const effectiveLooksDoc = looksDoc ?? fallbackLooks;

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

  const screens = effectiveScreensDoc?.value.screens ?? EMPTY_SCREENS;
  const looks = effectiveLooksDoc?.value ?? null;
  const propsFile = propsDoc?.value ?? null;
  const noticesFile = noticesDoc?.value ?? null;
  const stageLayoutsFile = stageLayoutsDoc?.value ?? null;

  const now = useShowingClock({screens, looks, liveState, externalNow});

  const groups = useMemo(
    () =>
      computeShowingGroups({
        screens,
        looks,
        liveState,
        now,
        rows,
        openItemId,
        librarySong,
        mediaItems,
        missingMediaIds,
        propsFile,
        noticesFile,
        stageLayoutsFile,
      }),
    [
      screens,
      looks,
      liveState,
      now,
      rows,
      openItemId,
      librarySong,
      mediaItems,
      missingMediaIds,
      propsFile,
      noticesFile,
      stageLayoutsFile,
    ],
  );

  const count = useMemo(
    () => groups.reduce((acc, g) => acc + g.items.length, 0),
    [groups],
  );

  return {groups, count};
}
