import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';
import type {Notice} from '@renderer/ui/notices';
import type {MediaImportProgress} from '@core/schema/mediaEdit';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {ALL_MEDIA, chosenPlaylist, type MediaListChoice} from './mediaEntries';
import {
  MediaLibrary,
  type MediaApi,
  type MediaLibraryView,
} from './mediaLibrary';

interface MediaViewContextValue {
  readonly library: MediaLibrary;
  readonly choice: MediaListChoice;
  readonly choose: (choice: MediaListChoice) => void;
  readonly selected: string | null;
  readonly select: (mediaId: string | null) => void;
  readonly imported: (
    jobs: readonly MediaImportProgress[],
    choice?: MediaListChoice,
  ) => void;
}

const MediaViewContext = createContext<MediaViewContextValue | null>(null);
const RECENT_IMPORT_LIMIT = 64;

function useImportCompletion(
  api: MediaApi,
  onComplete: (mediaId: string, choice: MediaListChoice) => void,
) {
  const pending = useRef(new Set<string>());
  const active = useRef(false);
  const recent = useRef(new Map<string, MediaImportProgress>());
  const destination = useRef<MediaListChoice>(ALL_MEDIA);
  const complete = (progress: MediaImportProgress): void => {
    if (
      progress.phase !== 'complete' ||
      !pending.current.has(progress.mediaId)
    ) {
      return;
    }
    pending.current.clear();
    onComplete(progress.mediaId, destination.current);
  };
  const received = useEffectEvent(complete);
  useEffect(() => {
    active.current = true;
    const completed = recent.current;
    const waiting = pending.current;
    const stop = api.media.subscribeImports(progress => {
      if (!['complete', 'failed', 'cancelled'].includes(progress.phase)) return;
      completed.set(progress.mediaId, progress);
      if (completed.size > RECENT_IMPORT_LIMIT) {
        const oldest = completed.keys().next();
        if (!oldest.done) completed.delete(oldest.value);
      }
      received(progress);
      if (progress.phase !== 'complete') waiting.delete(progress.mediaId);
    });
    return () => {
      active.current = false;
      stop();
      waiting.clear();
      completed.clear();
    };
  }, [api]);
  return (
    jobs: readonly MediaImportProgress[],
    choice: MediaListChoice = ALL_MEDIA,
  ): void => {
    if (!active.current) return;
    destination.current = choice;
    pending.current.clear();
    for (const job of jobs) pending.current.add(job.mediaId);
    for (const job of jobs) complete(recent.current.get(job.mediaId) ?? job);
  };
}

const ignoreImported: MediaViewContextValue['imported'] = () => undefined;

/** Tracks completion in the shared host even when a media panel unmounts. */
export function useMediaImportCompletion() {
  return use(MediaViewContext)?.imported ?? ignoreImported;
}

export function useHasMediaView(): boolean {
  return use(MediaViewContext) !== null;
}

export interface MediaViewProviderProps {
  readonly api: MediaApi;
  readonly active?: boolean;
  /** The workspace host merges problems into its one notification list. */
  readonly onProblem: (notice: Notice) => void;
  readonly children: ReactNode;
}

/**
 * The media view's columns share one media list, one chosen list, and one
 * selected tile: the playlist panels on the left choose, the grid in the
 * center shows the list and selects, and the properties on the right follow.
 */
export function MediaViewProvider({
  api,
  onProblem,
  children,
  active = true,
}: MediaViewProviderProps): JSX.Element {
  const report = useEffectEvent(onProblem);
  const [library] = useState(() => new MediaLibrary(api));
  const [choice, choose] = useState<MediaListChoice>(ALL_MEDIA);
  const [selected, select] = useState<string | null>(null);
  const navigate = use(WorkspaceNavigation);
  const imported = useImportCompletion(api, (mediaId, destination) => {
    choose(destination);
    select(mediaId);
    navigate?.('prep');
  });
  useEffect(
    () =>
      active
        ? library.start(notice => {
            report(notice);
          })
        : undefined,
    [library, active],
  );
  const value = useMemo(
    () => ({library, choice, choose, selected, select, imported}),
    [library, choice, selected, imported],
  );
  return <MediaViewContext value={value}>{children}</MediaViewContext>;
}

/** What a media view column reads: the media list and the chosen list. */
export interface MediaViewState extends MediaViewContextValue {
  readonly view: MediaLibraryView;
}

/**
 * The shared media view state. A chosen playlist that is gone from the list
 * reads as 모든 미디어. A selection outside the current list reads as null.
 */
export function useMediaView(): MediaViewState {
  const context = use(MediaViewContext);
  if (context === null) {
    throw new Error('A media view column needs a MediaViewProvider');
  }
  const view = useSyncExternalStore(
    context.library.subscribe,
    context.library.getSnapshot,
  );
  const playlist = chosenPlaylist(view.document, context.choice);
  const gone =
    context.choice.kind !== 'all' &&
    view.document !== null &&
    playlist === null;
  const item = view.document?.value.items.find(
    ({id}) => id === context.selected,
  );
  const selected =
    item !== undefined &&
    (playlist === null || playlist.items.includes(item.id))
      ? item.id
      : null;
  return {
    ...context,
    view,
    choice: gone ? ALL_MEDIA : context.choice,
    selected,
  };
}
