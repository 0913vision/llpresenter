import {useMemo, useState, useEffect, useLayoutEffect, useRef} from 'react';
import type {Screen} from '@core/schema/screens';
import type {MediaItem} from '@core/schema/mediaList';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useLive} from '@renderer/platform/live';
import {useShow} from '@renderer/state/show';
import {bibleSourceFor} from '@renderer/state/showLibrary';
import {useShowingClock} from './showingClock';
import {computeShowingCount, computeShowingGroups} from './showingRows';
import type {ShowingGroup} from './showingTypes';

const EMPTY_SCREENS: readonly Screen[] = [];
const MAX_TIMEOUT_MS = 2_147_483_647;

function useExpiryClock(
  liveState: ReturnType<typeof useLive.getState>['state'],
): number {
  const [now, setNow] = useState(() => Date.now());
  const messages = liveState?.layers.message?.items;
  useEffect(() => {
    const wall = Date.now();
    const expiries =
      messages?.flatMap(message =>
        message.expiresAt === null ? [] : [message.expiresAt],
      ) ?? [];
    const overdue = expiries.some(expiry => expiry > now && expiry <= wall);
    const next = expiries.reduce<number | undefined>(
      (first, expiry) =>
        expiry > wall && (first === undefined || expiry < first)
          ? expiry
          : first,
      undefined,
    );
    if (!overdue && next === undefined) return undefined;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = overdue ? 0 : Math.max(0, (next ?? wall) - Date.now());
      timer = setTimeout(
        () => {
          if (delay > MAX_TIMEOUT_MS) schedule();
          else setNow(Date.now());
        },
        Math.min(delay, MAX_TIMEOUT_MS),
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [messages, now]);
  return now;
}

export interface ShowingGroupsResult {
  readonly groups: readonly ShowingGroup[];
  readonly count: number;
}

/** Hook for ShowToolsPanel to get the showing tab badge count without depending on ShowingTab. */
export function useShowingCount(onProblem?: (notice: Notice) => void): number {
  const screensDoc = useSettingsDocument('screens', '화면', onProblem);
  const looksDoc = useSettingsDocument('looks', 'Look', onProblem);
  const layoutsDoc = useSettingsDocument(
    'stage-layouts',
    '무대 배치',
    onProblem,
  );
  const screens = screensDoc?.value.screens ?? EMPTY_SCREENS;
  const looks = looksDoc?.value ?? null;
  const liveState = useLive(view => view.state);
  const now = useExpiryClock(liveState);
  return useMemo(
    () =>
      computeShowingCount({
        screens,
        looks,
        liveState,
        now,
        stageLayoutsFile: layoutsDoc?.value ?? null,
      }),
    [screens, looks, liveState, now, layoutsDoc],
  );
}

/** Reads documents and live state to calculate showing tab groups and total count. */
export function useShowingGroups(
  onProblem?: (notice: Notice) => void,
): ShowingGroupsResult {
  const screensDoc = useSettingsDocument('screens', '화면', onProblem);
  const looksDoc = useSettingsDocument('looks', 'Look', onProblem);
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
  const liveBibleSource = useShow(view =>
    bibleSourceFor(view, liveState?.layers.slide?.itemId ?? null),
  );

  const [mediaItems, setMediaItems] = useState<readonly MediaItem[]>([]);
  const [missingMediaIds, setMissingMediaIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const report = useRef(onProblem);
  useLayoutEffect(() => {
    report.current = onProblem;
  });

  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let active = true;
    let revision = -1;
    let missingPushed = false;
    const accept = (doc: MediaDocument): void => {
      if (!active || doc.revision <= revision) return;
      revision = doc.revision;
      setMediaItems(doc.value.items);
    };
    const failure = (key: string, message: string, cause: unknown): void => {
      if (!active) return;
      api.log.write({
        level: 'error',
        message,
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      report.current?.({
        key: `showing:${key}`,
        kind: 'warning',
        icon: 'warning',
        title: '미디어 정보 불러오기 실패',
        time: noticeTime(),
      });
    };
    const stopMedia = api.media.subscribe(accept);
    const stopMissing = api.media.subscribeMissing(missing => {
      if (!active) return;
      missingPushed = true;
      setMissingMediaIds(new Set(missing));
    });
    api.media.get().then(accept, (cause: unknown) => {
      if (revision < 0) failure('media', 'Could not load showing media', cause);
    });
    api.media.missing().then(
      missing => {
        if (active && !missingPushed) setMissingMediaIds(new Set(missing));
      },
      (cause: unknown) => {
        if (!missingPushed) {
          failure('missing', 'Could not check showing media files', cause);
        }
      },
    );
    return () => {
      active = false;
      stopMedia();
      stopMissing();
    };
  }, []);

  const screens = screensDoc?.value.screens ?? EMPTY_SCREENS;
  const looks = looksDoc?.value ?? null;
  const propsFile = propsDoc?.value ?? null;
  const noticesFile = noticesDoc?.value ?? null;
  const stageLayoutsFile = stageLayoutsDoc?.value ?? null;

  const now = useShowingClock({
    screens,
    looks,
    liveState,
    stageLayoutsFile,
    mediaItems,
  });

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
        liveBibleSource,
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
      liveBibleSource,
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
