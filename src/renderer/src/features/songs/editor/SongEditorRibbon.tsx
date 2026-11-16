import {type JSX, type ReactNode} from 'react';
import type {SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
import {SlideHotKeyControl} from './SlideHotKeyControl';

export type SongDesignRenderer = (
  session: SongSession,
  busy: boolean,
) => ReactNode;

/** Keeps item appearance separate from slide editing without changing the deck. */
export function SongEditorRibbon({
  store,
  session,
  busy,
}: {
  readonly store: SongEditorStore;
  readonly session: SongSession;
  readonly busy: boolean;
  readonly renderDesign: SongDesignRenderer | undefined;
}): JSX.Element {
  return <SlideHotKeyControl store={store} session={session} busy={busy} />;
}
