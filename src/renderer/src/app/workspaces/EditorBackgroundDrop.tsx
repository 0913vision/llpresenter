import {isItemOfKind} from '@core/schema/service';
import {useEffect, useRef, type DragEvent, type ReactNode} from 'react';
import {hasMediaDrag, readMediaDrag} from '@renderer/features/media/mediaDrag';
import {useOtherSources} from '@renderer/features/service/items/useOtherSources';
import type {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {noticeTime} from '@renderer/ui/notices';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import styles from './EditorBackgroundDrop.module.css';

/** Accept media only on editor slides and the inspector picture. */
export function EditorBackgroundDrop({
  items,
  editor,
  children,
  sources,
}: {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly children: ReactNode;
  readonly sources: ReturnType<typeof useOtherSources>;
}) {
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
  const target = (event: DragEvent<HTMLDivElement>): HTMLElement | null => {
    if (
      !(event.target instanceof Element) ||
      event.target.closest('[data-overlay-clip]')
    ) {
      return null;
    }
    const element = event.target.closest<HTMLElement>(
      '[data-song-slide], [data-background-picture]',
    );
    return element !== null && event.currentTarget.contains(element)
      ? element
      : null;
  };
  const problem = (title: string): void =>
    items.reportNotice({
      key: 'editor-background-drop',
      kind: 'warning',
      icon: 'warning',
      title,
      time: noticeTime(),
    });
  return (
    <div
      className={styles.root}
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
      onDrop={event => {
        if (!hasMediaDrag(event.dataTransfer)) return;
        const element = target(event);
        clear();
        if (element === null) return;
        event.preventDefault();
        event.stopPropagation();
        const id = readMediaDrag(event.dataTransfer);
        const media = sources.media.find(entry => entry.id === id);
        if (
          id === undefined ||
          media === undefined ||
          !sources.canAddMedia(id)
        ) {
          problem('미디어 파일을 찾을 수 없습니다');
          return;
        }
        if (media.kind === 'audio') {
          problem('오디오는 배경으로 사용할 수 없습니다');
          return;
        }
        const editorState = editor.getSnapshot();
        const session = editorState.session;
        if (session !== null && !session.itemSession) {
          const locked = session.readOnly || editorState.busy;
          if (locked) {
            problem('지금은 편집할 수 없습니다');
          } else session.setBackground(id);
          return;
        }
        const state = items.getSnapshot();
        if (
          state.item === null ||
          (!isItemOfKind(state.item, 'song') &&
            !isItemOfKind(state.item, 'slides'))
        ) {
          problem('이 항목에는 배경을 설정할 수 없습니다');
        } else {
          const locked = state.busy || state.service?.access === 'readOnly';
          if (locked) {
            problem('지금은 편집할 수 없습니다');
          } else {
            editorTask(items.setBackground(id));
          }
        }
      }}
      onDragEnd={clear}
    >
      {children}
    </div>
  );
}
