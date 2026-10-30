import type {
  OutputScreenStatus,
  OutputStatuses,
} from '@core/schema/outputStatus';
import type {Notice, NoticeAction} from '@renderer/ui/notices';

/** How the cards name one screen, such as 무대 and 무대 화면. */
export interface ScreenNames {
  /** Before 모니터, such as 무대 in 무대 모니터 연결 끊김. */
  readonly monitor: string;
  /** Before 출력 창, such as 본 화면 in 본 화면 출력 창 다시 띄움. */
  readonly window: string;
}

/** What the card buttons ask the main process to do. */
export interface OutputNoticeActions {
  readonly findMonitors: () => void;
  readonly showWindow: (screenId: string) => void;
  readonly retry: (screenId: string) => void;
}

type CardChange =
  | {readonly kind: 'show' | 'update'; readonly notice: Notice}
  | {readonly kind: 'dismiss'; readonly key: string};

/**
 * A card to show for a screen, a card to change only if it is showing (the
 * warning still holds, but nothing new happened to report), or a card to
 * close.
 */
export type NoticeChange =
  | {
      readonly kind: 'show' | 'update';
      readonly screenId: string;
      readonly notice: Notice;
    }
  | {readonly kind: 'dismiss'; readonly key: string};

export interface OutputNoticeInput {
  readonly previous: OutputStatuses;
  readonly next: OutputStatuses;
  /** The screens that get cards, with their names. */
  readonly screens: ReadonlyMap<string, ScreenNames>;
  readonly actions: OutputNoticeActions;
  /** The time the cards show, such as 11:24. */
  readonly time: string;
}

interface ScreenTransition {
  readonly screenId: string;
  readonly names: ScreenNames;
  readonly before: OutputScreenStatus | undefined;
  readonly after: OutputScreenStatus;
  readonly actions: OutputNoticeActions;
  readonly time: string;
}

const SHOWING_IN_WINDOW = '창으로 표시 중';
const OUTPUT_OFF = '출력 꺼짐';
const SHOWING_EMPTY = '빈 화면으로 표시 중';

export function monitorNoticeKey(screenId: string): string {
  return `screen:${screenId}`;
}

export function windowNoticeKey(screenId: string): string {
  return `output-window:${screenId}`;
}

function monitorLabel({monitor}: OutputScreenStatus): readonly string[] {
  return monitor === undefined ? [] : [`모니터 ${monitor}`];
}

function lostCard(
  {screenId, names, after, actions, time}: ScreenTransition,
  outputOn: boolean,
): Notice {
  const findMonitors: NoticeAction = {
    icon: 'refresh',
    label: '모니터 다시 찾기',
    onSelect: actions.findMonitors,
  };
  const showWindow: NoticeAction = {
    icon: 'open',
    label: '창 보기',
    onSelect: () => actions.showWindow(screenId),
  };
  return {
    key: monitorNoticeKey(screenId),
    kind: 'warning',
    icon: 'plug',
    title: `${names.monitor} 모니터 연결 끊김`,
    time,
    meta: [...monitorLabel(after), outputOn ? SHOWING_IN_WINDOW : OUTPUT_OFF],
    actions: outputOn ? [findMonitors, showWindow] : [findMonitors],
  };
}

function reconnectedCard({
  screenId,
  names,
  after,
  time,
}: ScreenTransition): Notice {
  const monitor = monitorLabel(after);
  return {
    key: monitorNoticeKey(screenId),
    kind: 'info',
    icon: 'monitor',
    title: `${names.monitor} 모니터 다시 연결됨`,
    time,
    ...(monitor.length === 0 ? {} : {meta: monitor}),
  };
}

// NOTE(0913vision): A lost monitor warns until the screen is full screen
// again, which turns the card into information. Turning the output off while
// the monitor is missing is the operator's own action (or 연결이 끊기면 set to
// off), so it only changes a card that is showing to say 출력 꺼짐. A later
// full screen from off, or a switch to window or capture mode, makes the
// warning obsolete, so its card closes.
function monitorChange(transition: ScreenTransition): CardChange | null {
  const was = transition.before?.placement;
  const now = transition.after.placement;
  if (now === was) return null;
  const key = monitorNoticeKey(transition.screenId);
  switch (now) {
    case 'monitorMissing':
      return {kind: 'show', notice: lostCard(transition, true)};
    case 'off':
      return was === 'monitorMissing'
        ? {kind: 'update', notice: lostCard(transition, false)}
        : null;
    case 'fullscreen':
      return was === 'monitorMissing'
        ? {kind: 'show', notice: reconnectedCard(transition)}
        : {kind: 'dismiss', key};
    case 'window':
      return {kind: 'dismiss', key};
  }
}

// NOTE(0913vision): The restart limit warns with 다시 시도 and turns into
// information when it ends.
function windowChange({
  screenId,
  names,
  before,
  after,
  actions,
  time,
}: ScreenTransition): CardChange | null {
  const wasLimited = before?.renderer === 'limited';
  const isLimited = after.renderer === 'limited';
  if (wasLimited === isLimited) return null;
  const key = windowNoticeKey(screenId);
  if (isLimited) {
    return {
      kind: 'show',
      notice: {
        key,
        kind: 'warning',
        icon: 'warning',
        title: `${names.window} 출력 창을 다시 띄울 수 없음`,
        time,
        meta: [SHOWING_EMPTY],
        actions: [
          {
            icon: 'refresh',
            label: '다시 시도',
            onSelect: () => actions.retry(screenId),
          },
        ],
      },
    };
  }
  return {
    kind: 'show',
    notice: {
      key,
      kind: 'info',
      icon: 'monitor',
      title: `${names.window} 출력 창 다시 띄움`,
      time,
    },
  };
}

/**
 * The notification changes for one output status update (spec 08, "Lost
 * monitor" and "The restart limit"). A screen seen for the first time counts
 * as having had no problem, so a problem already present at launch warns; a
 * screen that leaves the status closes its cards.
 */
export function outputNoticeChanges({
  previous,
  next,
  screens,
  actions,
  time,
}: OutputNoticeInput): readonly NoticeChange[] {
  return [...screens].flatMap(([screenId, names]): NoticeChange[] => {
    const after = next[screenId];
    if (after === undefined) {
      return previous[screenId] === undefined
        ? []
        : [
            {kind: 'dismiss', key: monitorNoticeKey(screenId)},
            {kind: 'dismiss', key: windowNoticeKey(screenId)},
          ];
    }
    const transition: ScreenTransition = {
      screenId,
      names,
      before: previous[screenId],
      after,
      actions,
      time,
    };
    return [monitorChange(transition), windowChange(transition)].flatMap(
      (change): NoticeChange[] => {
        if (change === null) return [];
        return change.kind === 'dismiss' ? [change] : [{...change, screenId}];
      },
    );
  });
}
