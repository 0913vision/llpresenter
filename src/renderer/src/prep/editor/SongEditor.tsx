import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import {LabelMenu} from './LabelMenu';
import {SongBlock, type EditorFocus} from './SongBlock';
import {SongHeader} from './SongHeader';
import type {SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
import styles from './SongEditor.module.css';

/** Mount with a window-owned store; unmounting does not discard song history. */
export function SongEditor({
  store,
}: {
  readonly store: SongEditorStore;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return (
    <section aria-label="곡 편집" className={styles.editor}>
      {state.session === null ? null : (
        <div key={state.session.document.song.id} className={styles.content}>
          <SongHeader store={store} session={state.session} />
          <div className={styles.blocks}>
            <SongBlocks store={store} session={state.session} />
          </div>
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
  readonly session: SongSession;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const {song, selection} = session.history.snapshot;
  const focus = useRef<EditorFocus>({
    inputs: [],
    requested: false,
    composing: false,
    restoring: false,
  });
  const [menu, setMenu] = useState<{anchor: HTMLElement; block: number} | null>(
    null,
  );
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
    if (owner.composing) return;
    const input = owner.inputs[selection.block];
    const ownsFocus =
      document.activeElement instanceof HTMLTextAreaElement &&
      owner.inputs.includes(document.activeElement);
    if (
      input !== undefined &&
      input !== null &&
      (owner.requested || ownsFocus)
    ) {
      owner.restoring = true;
      input.focus({preventScroll: true});
      input.setSelectionRange(selection.start, selection.end);
      owner.restoring = false;
      if (owner.requested) input.scrollIntoView({block: 'nearest'});
    }
    owner.requested = false;
  });
  return (
    <>
      {song.slides.map((slide, block) => (
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
            state.labels?.value.labels.find(label => label.name === slide.label)
              ?.color ?? 'none'
          }
          expanded={menu?.block === block}
          onOpen={openMenu}
        />
      ))}
      {menu === null ? null : (
        <LabelMenu
          store={store}
          anchor={menu.anchor}
          selected={
            song.slides[menu.block]?.label === ''
              ? undefined
              : song.slides[menu.block]?.label
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
    </>
  );
}
