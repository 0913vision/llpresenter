import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';
import type {Notice} from '@renderer/ui/notices';
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
  /** The tile selected in the grid, whose properties the right column shows. */
  readonly selected: string | null;
  readonly select: (mediaId: string | null) => void;
}

const MediaViewContext = createContext<MediaViewContextValue | null>(null);

export interface MediaViewProviderProps {
  readonly api: MediaApi;
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
}: MediaViewProviderProps): JSX.Element {
  const report = useEffectEvent(onProblem);
  const [library] = useState(() => new MediaLibrary(api));
  const [choice, choose] = useState<MediaListChoice>(ALL_MEDIA);
  const [selected, select] = useState<string | null>(null);
  useEffect(
    () =>
      library.start(notice => {
        report(notice);
      }),
    [library],
  );
  const value = useMemo(
    () => ({library, choice, choose, selected, select}),
    [library, choice, selected],
  );
  return <MediaViewContext value={value}>{children}</MediaViewContext>;
}

/** What a media view column reads: the media list and the chosen list. */
export interface MediaViewState extends MediaViewContextValue {
  readonly view: MediaLibraryView;
}

/**
 * The shared media view state. A chosen playlist that is gone from the list
 * reads as 모든 미디어.
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
  const gone =
    context.choice.kind !== 'all' &&
    view.document !== null &&
    chosenPlaylist(view.document, context.choice) === null;
  return {...context, view, choice: gone ? ALL_MEDIA : context.choice};
}
