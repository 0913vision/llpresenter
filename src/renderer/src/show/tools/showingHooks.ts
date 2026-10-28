import {useMemo, useState, useEffect} from 'react';
import type {Screen} from '@shared/schema/screens';
import type {MediaItem} from '@shared/schema/mediaList';
import type {Notice} from '@renderer/ui/notices';
import {useSettingsDocument} from '@renderer/screens/useSettingsDocument';
import {useLive} from '@renderer/state/live';
import {useShow} from '@renderer/state/show';
import {useShowingClock} from './showingClock';
import {computeShowingCount, computeShowingGroups} from './showingRows';
import type {ShowingGroup} from './showingTypes';

const EMPTY_SCREENS: readonly Screen[] = [];

export interface ShowingGroupsResult {
  readonly groups: readonly ShowingGroup[];
  readonly count: number;
}

/** Hook for ShowToolsPanel to get the showing tab badge count without depending on ShowingTab. */
export function useShowingCount(onProblem?: (notice: Notice) => void): number {
  const screensDoc = useSettingsDocument('screens', '화면', onProblem);
  const looksDoc = useSettingsDocument('looks', 'Look', onProblem);
  const screens = screensDoc?.value.screens ?? EMPTY_SCREENS;
  const looks = looksDoc?.value ?? null;
  const liveState = useLive(view => view.state);
  const now = useShowingClock({screens, looks, liveState});
  return useMemo(
    () => computeShowingCount({screens, looks, liveState, now}),
    [screens, looks, liveState, now],
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

  const [mediaItems, setMediaItems] = useState<readonly MediaItem[]>([]);
  const [missingMediaIds, setMissingMediaIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let active = true;

    api.media
      .get()
      .then(res => {
        if (active) {
          setMediaItems(res.value.items);
        }
      })
      .catch(() => undefined);

    api.media
      .missing()
      .then(missing => {
        if (active) {
          setMissingMediaIds(new Set(missing));
        }
      })
      .catch(() => undefined);

    const stopMedia = api.media.subscribe(doc => {
      setMediaItems(doc.value.items);
    });
    const stopMissing = api.media.subscribeMissing(missing => {
      setMissingMediaIds(new Set(missing));
    });
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

  const now = useShowingClock({screens, looks, liveState});

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
