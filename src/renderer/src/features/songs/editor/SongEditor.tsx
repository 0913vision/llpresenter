import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {LabelMenu} from './LabelMenu';
import {SongBlock, type EditorFocus} from './SongBlock';
import {SongHeader} from './SongHeader';
import {SlideHotKeyControl} from './SlideHotKeyControl';
import type {SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
import styles from './SongEditor.module.css';
import type {SongId} from '@core/schema/ids';
import {isComposing} from '@renderer/ui/ime';
import {linearSlidesOf, slideCountOf} from '@core/songs/blockEdits';
import {PanelFooter} from '@renderer/ui/Panel';
import {Button} from '@renderer/ui/Button';
import {useSongBlockWindow} from './useSongBlockWindow';
import {SongSlideSurface} from './SongSlideSurface';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {useShow} from '@renderer/session/show';

/** Mount with a window-owned store; unmounting does not discard song history. */
export function SongEditor({
  store,
  onImportedSave,
  unsaved = false,
  onBack,
  actions,
}: {
  readonly store: SongEditorStore;
  readonly onImportedSave?: ((id: SongId) => void) | undefined;
  /** Shows the dot before the title while edits wait for 저장. */
  readonly unsaved?: boolean;
  readonly onBack?: (() => void) | undefined;
  readonly actions?: ReactNode;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const serviceName = useShow(view => view.serviceName);
  return (
    <section
      aria-label="곡 편집"
      className={styles.editor}
      onKeyDown={event => {
        if (
          event.key === 'Escape' &&
          !(event.target instanceof HTMLTextAreaElement) &&
          !(event.target instanceof HTMLInputElement)
        ) {
          event.preventDefault();
          event.stopPropagation();
          onBack?.();
        }
      }}
    >
      {state.session === null ? null : (
        <div key={state.session.document.song.id} className={styles.content}>
          <SongHeader
            store={store}
            session={state.session}
            onImportedSave={onImportedSave}
            unsaved={unsaved || state.session.unsaved || state.imported}
            back={
              onBack === undefined ? undefined : (
                <Button className={styles.back} onClick={onBack}>
                  ‹{' '}
                  {state.session.itemSession
                    ? serviceName || '예배 순서'
                    : '라이브러리'}
                </Button>
              )
            }
            actions={state.imported ? null : actions}
          />
          <SlideHotKeyControl
            store={store}
            session={state.session}
            busy={state.busy}
          />
          <SongSlideSurface
            session={state.session}
            store={store}
            className={styles.surface}
            onBack={onBack}
          >
            <SongBlocks store={store} session={state.session} />
          </SongSlideSurface>
          <PanelFooter
            count={slideCountOf(state.session.history.snapshot.song)}
          />
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
  const list = useSyncExternalStore(
    session.history.model.subscribe,
    session.history.model.getSnapshot,
  );
  const itemRow = useShow(view => {
    const row = view.rows.find(row => row.id === song.id);
    return row?.kind === 'song' ? row : undefined;
  });
  const theme = useSlideTheme(
    session.itemSession && itemRow !== undefined
      ? itemRow
      : {id: song.id, kind: 'song', title: song.title},
    session.itemSession ? 'service' : 'external',
  );
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
  const slides = useMemo(() => linearSlidesOf(song), [song]);
  const {viewport, total, offsets, indices, setScrollTop} = useSongBlockWindow(
    slides,
    selection.block,
    menu?.block,
  );
  const tab = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (
      event.code !== 'Tab' ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      focus.current.composing ||
      isComposing(event)
    ) {
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
    const label = target === row.querySelector('button:not([data-slide-gap])');
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
      const slide = session.history.snapshot.song.slides[block];
      if (slide === undefined) return;
      if (!session.history.model.getSnapshot().selection.ids.has(slide.id)) {
        session.selectSlides({type: 'click', id: slide.id});
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
              `[data-editor-block="${selection.block}"] button:not([data-slide-gap])`,
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
      {slides.length === 0 ? (
        <Button
          disabled={state.busy || session.readOnly}
          onClick={() => session.edit({type: 'insert'})}
        >
          슬라이드 추가
        </Button>
      ) : null}
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
              active={list.selection.ids.has(slide.id)}
              focused={
                selection.block === block && list.selection.ids.has(slide.id)
              }
              caret={list.selection.caret === block}
              canvas={
                theme === undefined ? undefined : (
                  <SlidePicture
                    {...theme}
                    background={theme.background ?? session.background}
                    slide={{
                      itemId: song.id,
                      position: block,
                      lines: slide.lines,
                      label: slide.label ?? null,
                    }}
                  />
                )
              }
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
      <button
        type="button"
        className={styles.endGap}
        data-slide-gap={slides.length}
        data-caret={list.selection.caret === slides.length}
        aria-label="마지막 슬라이드 뒤에 삽입"
        onClick={event => {
          session.selectSlides({type: 'gap', index: slides.length});
          event.currentTarget
            .closest<HTMLElement>('[aria-label="슬라이드 편집 명령"]')
            ?.focus();
        }}
      />
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
