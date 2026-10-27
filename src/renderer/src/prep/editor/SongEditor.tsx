import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type KeyboardEvent,
} from 'react';
import {LabelMenu} from './LabelMenu';
import {SongBlock, type EditorFocus} from './SongBlock';
import {SongHeader} from './SongHeader';
import {ArrangementRow} from './ArrangementRow';
import {SlideHotKeyControl} from './SlideHotKeyControl';
import type {SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
import styles from './SongEditor.module.css';
import type {SongId} from '@shared/schema/ids';
import {isComposing} from '@renderer/ui/ime';
import {isGroupedSong, type AnySong} from '@shared/schema/groupedSong';
import {linearSlidesOf} from './blockEdits';
import {useSongBlockWindow} from './useSongBlockWindow';

/** Mount with a window-owned store; unmounting does not discard song history. */
export function SongEditor({
  store,
  onImportedSave,
}: {
  readonly store: SongEditorStore;
  readonly onImportedSave?: ((id: SongId) => void) | undefined;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return (
    <section aria-label="곡 편집" className={styles.editor}>
      {state.session === null ? null : (
        <div key={state.session.document.song.id} className={styles.content}>
          <SongHeader
            store={store}
            session={state.session}
            onImportedSave={onImportedSave}
          />
          <ArrangementRow store={store} session={state.session} />
          <SlideHotKeyControl session={state.session} busy={state.busy} />
          <SongBlocks store={store} session={state.session} />
        </div>
      )}
    </section>
  );
}

function SongBlocks({
  store,
  session,
}: {
  readonly store: SongEditorStore;
  readonly session: SongSession<AnySong>;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const {song, selection} = session.history.snapshot;
  const previousBlock = useRef(selection.block);
  const focus = useRef<EditorFocus>({
    inputs: [],
    requested: false,
    composing: false,
    restoring: false,
  });
  const [menu, setMenu] = useState<{anchor: HTMLElement; block: number} | null>(
    null,
  );
  const slides = useMemo(
    () => (isGroupedSong(song) ? linearSlidesOf(song) : song.slides),
    [song],
  );
  const {viewport, total, offsets, indices, setScrollTop} = useSongBlockWindow(
    slides,
    selection.block,
    menu?.block,
  );
  const tab = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab' || focus.current.composing || isComposing(event)) {
      return;
    }
    const target = event.target;
    if (!(
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLButtonElement
    )) {
      return;
    }
    const row = target.closest<HTMLElement>('[data-editor-block]');
    if (row === null) return;
    const block = Number(row.dataset.editorBlock);
    const input = target instanceof HTMLTextAreaElement;
    const label = target === row.querySelector('button');
    if (event.shiftKey ? !label && !(input && session.readOnly) : !input) {
      return;
    }
    const next = block + (event.shiftKey ? -1 : 1);
    if (!Number.isInteger(block) || next < 0 || next >= slides.length) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    focus.current.requested = true;
    focus.current.target =
      !event.shiftKey && !session.readOnly ? 'label' : 'lyrics';
    session.select({block: next, start: 0, end: 0});
  };
  const openMenu = useCallback(
    (anchor: HTMLElement, block: number): void => {
      if (session.history.snapshot.selection.block !== block) {
        session.select({block, start: 0, end: 0});
      }
      setMenu(current => (current?.anchor === anchor ? null : {anchor, block}));
    },
    [session],
  );
  useLayoutEffect(() => {
    const owner = focus.current;
    owner.inputs.length = slides.length;
    if (owner.composing) return;
    const input = owner.inputs[selection.block];
    const changedBlock = previousBlock.current !== selection.block;
    previousBlock.current = selection.block;
    if (changedBlock) input?.scrollIntoView({block: 'nearest'});
    const ownsFocus =
      document.activeElement instanceof HTMLTextAreaElement &&
      owner.inputs.includes(document.activeElement);
    if (
      input !== undefined &&
      input !== null &&
      (owner.requested || ownsFocus)
    ) {
      owner.restoring = true;
      const target =
        owner.requested && owner.target === 'label'
          ? viewport.current?.querySelector<HTMLElement>(
              `[data-editor-block="${selection.block}"] button`,
            )
          : input;
      (target ?? input).focus({preventScroll: true});
      if (target === input) {
        input.setSelectionRange(selection.start, selection.end);
      }
      owner.restoring = false;
      if (owner.requested) input.scrollIntoView({block: 'nearest'});
    }
    owner.requested = false;
    owner.target = 'lyrics';
  });
  return (
    <div
      ref={viewport}
      role="group"
      aria-label="가사"
      className={styles.blocks}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      onKeyDown={tab}
    >
      <div className={styles.blockWindow} style={{height: total}}>
        {indices.map(block => {
          const slide = slides[block];
          return slide === undefined ? null : (
            <SongBlock
              key={block}
              slide={slide}
              block={block}
              session={session}
              focus={focus}
              active={selection.block === block}
              locked={state.busy || session.readOnly}
              editable={!session.readOnly}
              color={
                state.labels?.value.labels.find(
                  label => label.name === slide.label,
                )?.color ?? 'none'
              }
              expanded={menu?.block === block}
              onOpen={openMenu}
              top={offsets[block] ?? 0}
            />
          );
        })}
      </div>
      {menu === null ? null : (
        <LabelMenu
          store={store}
          anchor={menu.anchor}
          selected={
            slides[menu.block]?.label === ''
              ? undefined
              : slides[menu.block]?.label
          }
          onChoose={name => {
            session.select({block: menu.block, start: 0, end: 0});
            session.edit({type: 'label', name});
          }}
          onClose={restore => {
            setMenu(null);
            if (restore) menu.anchor.focus();
          }}
        />
      )}
    </div>
  );
}
