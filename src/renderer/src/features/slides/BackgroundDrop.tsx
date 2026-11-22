import {useEffect, useRef, type DragEvent, type ReactNode} from 'react';
import {changeSlides, withBackground} from '@core/slides/edits';
import {hasMediaDrag, readMediaDrag} from '@renderer/features/media/mediaDrag';
import {canAddMedia, mediaItem} from '@renderer/platform/media';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {noticeTime} from '@renderer/ui/notices';
import {selectionOf} from './deckSelection';
import type {SlideDeck} from './slideDeck';
import type {Report} from '@renderer/session/serviceEdit';
import styles from './SlideEditor.module.css';

const TARGET = '[data-song-slide], [data-background-picture]';

/** A media file dropped on a slide is what is behind its texts. */
export function BackgroundDrop({
  deck,
  report,
  children,
}: {
  readonly deck: SlideDeck;
  readonly report: Report;
  readonly children: ReactNode;
}): ReactNode {
  const marked = useRef<HTMLElement | null>(null);
  const clear = (): void => {
    marked.current?.removeAttribute('data-background-drop');
    marked.current = null;
  };
  useEffect(() => {
    document.addEventListener('dragend', clear);
    return () => {
      document.removeEventListener('dragend', clear);
      clear();
    };
  }, []);
  const target = (event: DragEvent): HTMLElement | null =>
    event.target instanceof Element
      ? event.target.closest<HTMLElement>(TARGET)
      : null;
  const problem = (title: string): void =>
    report({
      key: 'slides:background-drop',
      kind: 'warning',
      icon: 'warning',
      title,
      time: noticeTime(),
    });
  const drop = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasMediaDrag(event.dataTransfer)) return;
    const element = target(event);
    clear();
    if (element === null) return;
    event.preventDefault();
    event.stopPropagation();
    const id = readMediaDrag(event.dataTransfer);
    const media = id === undefined ? undefined : mediaItem(id);
    if (id === undefined || media === undefined || !canAddMedia(id)) {
      problem('미디어 파일을 찾을 수 없습니다');
      return;
    }
    if (media.kind === 'audio') {
      problem('오디오는 배경으로 사용할 수 없습니다');
      return;
    }
    if (deck.readOnly) {
      problem(NEWER_FILE_REASON);
      return;
    }
    const {ids} = selectionOf(deck);
    const own = deck.slides.find(
      slide => slide.id === element.dataset['songSlide'],
    );
    deck.edit(slides =>
      changeSlides(
        slides,
        own === undefined || ids.has(own.id) ? ids : new Set([own.id]),
        slide => withBackground(slide, {kind: 'media', media: id}),
      ),
    );
  };
  return (
    <div
      className={styles.drop}
      onDragOver={event => {
        if (!hasMediaDrag(event.dataTransfer)) return;
        const element = target(event);
        clear();
        if (element === null) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
        element.setAttribute('data-background-drop', '');
        marked.current = element;
      }}
      onDragLeave={event => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !marked.current?.contains(event.relatedTarget)
        ) {
          clear();
        }
      }}
      onDrop={drop}
    >
      {children}
    </div>
  );
}
