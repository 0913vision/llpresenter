import {
  Fragment,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
  type RefObject,
} from 'react';
import type {Slide, SlidesDraft} from '@core/services/slidesEdits';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {SongSlideSurface} from '../../songs/editor/SongSlideSurface';
import {SlidesListSession} from './slidesListSession';
import styles from './SlidesEditor.module.css';

export function SlideRows({
  draft,
  blocked,
  report,
  list,
  renderRow,
  children,
  session,
  onBack,
}: {
  readonly draft: SlidesDraft;
  readonly blocked: boolean;
  readonly update: () => void;
  readonly report: (message: string) => void;
  readonly list: RefObject<HTMLDivElement | null>;
  readonly renderRow: (slide: Slide, index: number) => ReactNode;
  readonly children: ReactNode;
  readonly session?: SlidesListSession | undefined;
  readonly onBack?: (() => void) | undefined;
}): JSX.Element {
  const fallback = useMemo(
    () =>
      new SlidesListSession(draft, {
        locked: () => false,
        problem: message => console.error(message),
      }),
    [draft],
  );
  useLayoutEffect(
    () => fallback.configure({locked: () => blocked, problem: report}),
    [fallback, blocked, report],
  );
  const commands = session ?? fallback;
  useSyncExternalStore(
    commands.slideModel.subscribe,
    commands.slideModel.getSnapshot,
  );
  const {item, selection, selected} = draft.snapshot;
  const rows = item.slides.slides;
  const gap = (index: number): ReactNode => (
    <button
      type="button"
      className={styles.gap}
      aria-label={`${index + 1}번째 위치에 삽입`}
      data-gap-index={index}
      data-slide-gap={index}
      data-caret={selection.caret === index || undefined}
      tabIndex={-1}
      onClick={event => {
        commands.selectSlides({type: 'gap', index});
        event.currentTarget
          .closest<HTMLElement>('[aria-label="슬라이드 편집 명령"]')
          ?.focus();
      }}
    />
  );
  return (
    <SongSlideSurface
      session={commands}
      blocked={blocked}
      onBack={onBack}
      className={styles.rowSurface}
    >
      <div
        ref={list}
        className={styles.rows}
        aria-label="슬라이드 편집 목록"
        tabIndex={-1}
      >
        {rows.map((slide, index) => (
          <Fragment key={slide.id}>
            {gap(index)}
            <div
              className={styles.row}
              data-selected={selection.ids.has(slide.id) || undefined}
              data-focused={
                (selected === index && selection.ids.has(slide.id)) || undefined
              }
              tabIndex={-1}
              data-slide-id={slide.id}
              data-song-slide={slide.id}
              data-slide-index={index}
              data-editor-block={index}
              draggable={!blocked}
              onClick={event => {
                if (
                  isInTextEntry(event.target) ||
                  (event.target instanceof Element &&
                    event.target.closest('button') !== null)
                ) {
                  return;
                }
                commands.selectSlides({
                  type: 'click',
                  id: slide.id,
                  shift: event.shiftKey,
                  ctrl: event.ctrlKey || event.metaKey,
                });
              }}
              onFocusCapture={event => {
                if (isInTextEntry(event.target)) {
                  commands.selectSlides({type: 'click', id: slide.id});
                }
              }}
            >
              {renderRow(slide, index)}
            </div>
          </Fragment>
        ))}
        {gap(rows.length)}
        {children}
      </div>
    </SongSlideSurface>
  );
}
