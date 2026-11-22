import {
  useLayoutEffect,
  useMemo,
  useRef,
  type JSX,
  type ReactNode,
} from 'react';
import type {UiApi} from '@contracts/ipc/ui';
import {makeSlide} from '@core/slides/make';
import {useLabelColors} from '@renderer/features/labels/labels';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {slideMaking} from '@renderer/platform/themes';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import type {Report} from '@renderer/session/serviceEdit';
import {Button} from '@renderer/ui/Button';
import {Icon} from '@renderer/ui/Icon';
import {isComposing} from '@renderer/ui/ime';
import {menuAvailability} from '@renderer/ui/menuModel';
import {Progress} from '@renderer/ui';
import {TextField} from '@renderer/ui/TextField';
import {Tooltip} from '@renderer/ui/Tooltip';
import {BackgroundDrop} from '../slides/BackgroundDrop';
import {addReason, addSlides} from '../slides/deckCommands';
import {SlideEditor} from '../slides/SlideEditor';
import styles from '../slides/SlideEditorHeader.module.css';
import {SlideInspector} from '../slides/SlideInspector';
import {useDeckTiles, type SlideDeck} from '../slides/slideDeck';
import {songUsage} from './library/songUsage';
import {
  ask,
  editSong,
  editSongTitle,
  isUnsaved,
  replaySong,
  requestSave,
  songTitleProblem,
  useSongDraft,
} from './songDraft';

/** The slides of the library song that is open. */
export function useSongDeck(): SlideDeck | null {
  const draft = useSongDraft(view => view.draft);
  return useMemo(() => {
    if (draft === null) return null;
    return {
      id: draft.song.id,
      item: undefined,
      source: {kind: 'song', title: draft.song.title},
      slides: draft.song.slides,
      readOnly: draft.document?.access === 'readOnly',
      canUndo: draft.past.length > 0,
      canRedo: draft.future.length > 0,
      edit: (change, key) =>
        editSong(song => {
          const slides = change(song.slides);
          return slides === song.slides ? song : {...song, slides};
        }, key),
      replay: replaySong,
    };
  }, [draft]);
}

const PICTURES_REASON = '배경을 가져오는 중입니다';

function save(): void {
  requestSave().catch((error: unknown) =>
    console.error('Could not save the song', error),
  );
}

function SongHeader({
  onBack,
}: {
  readonly onBack: () => void;
}): JSX.Element | null {
  const {draft, library, libraryStatus, pictures, saving, titleFocus} =
    useSongDraft();
  const frame = useRef<HTMLDivElement>(null);
  const focused = useRef(0);
  useLayoutEffect(() => {
    if (titleFocus === focused.current) return;
    focused.current = titleFocus;
    const input = frame.current?.querySelector('input');
    input?.focus();
    input?.select();
  }, [titleFocus]);
  if (draft === null) return null;
  const unsaved = isUnsaved(draft);
  const readOnly = draft.document?.access === 'readOnly';
  const busy = pictures !== null && (pictures.busy || saving);
  const titleReason = songTitleProblem(draft, library);
  const reason = titleReason ?? (busy ? PICTURES_REASON : undefined);
  const usage = songUsage(library, libraryStatus, draft.song.id);
  return (
    <header className={styles.header}>
      <Button className={styles.back} onClick={onBack}>
        ‹ 라이브러리
      </Button>
      {unsaved ? (
        <Tooltip text="저장하지 않은 변경">
          <span
            className={styles.unsaved}
            role="img"
            aria-label="저장하지 않은 변경"
          />
        </Tooltip>
      ) : (
        <span className={styles.unsaved} data-empty aria-hidden="true" />
      )}
      <div ref={frame} className={styles.title}>
        <TextField
          aria-label="곡 제목"
          variant="title"
          block
          value={draft.song.title}
          onChange={editSongTitle}
          readOnly={readOnly || saving}
          title={readOnly ? NEWER_FILE_REASON : undefined}
          invalid={titleReason !== undefined}
          invalidReason={titleReason}
          onKeyDown={event => {
            if (event.key !== 'Enter' || isComposing(event)) return;
            event.preventDefault();
            event.currentTarget
              .closest('section')
              ?.querySelector<HTMLTextAreaElement>('textarea')
              ?.focus();
          }}
        />
      </div>
      {busy ? <Progress value={null} label="배경 가져오는 중" /> : null}
      {draft.document === null ? null : (
        <Button
          disabled={saving || readOnly}
          onClick={() => ask({kind: 'saveAs'})}
        >
          다른 이름으로 저장…
        </Button>
      )}
      <Button
        variant={draft.document === null ? 'primary' : undefined}
        disabled={saving || readOnly || !unsaved || reason !== undefined}
        title={reason ?? (unsaved ? undefined : '변경 없음')}
        onClick={save}
      >
        저장
      </Button>
      {draft.document === null ? null : (
        <Tooltip text={usage.tooltip}>
          <span
            tabIndex={0}
            className={styles.used}
            data-unavailable={usage.unavailable || undefined}
          >
            <Icon name={usage.unavailable ? 'warning' : 'link'} size={14} />
            {usage.text}
          </span>
        </Tooltip>
      )}
    </header>
  );
}

/** The editor of the library song that is open, and the panel beside it. */
export function useSongEditor({
  report,
  onBack,
  ui,
}: {
  readonly report: Report;
  readonly onBack: () => void;
  readonly ui?: Pick<UiApi, 'setLayout'> | undefined;
}): {readonly editor: ReactNode; readonly inspector: ReactNode} | null {
  const deck = useSongDeck();
  const colors = useLabelColors();
  const tiles = useDeckTiles(
    deck ?? {slides: [], source: {kind: 'song', title: ''}},
    colors,
  );
  const open = deck !== null;
  useWindowShortcuts([
    {
      id: 'songWindow.save',
      context: 'song',
      when: () => open,
      run: save,
    },
    {
      id: 'songWindow.saveAs',
      context: 'song',
      when: () => useSongDraft.getState().draft?.document != null,
      run: () => ask({kind: 'saveAs'}),
    },
    {
      id: 'import.save',
      context: 'import',
      when: () => {
        const {draft} = useSongDraft.getState();
        return draft !== null && draft.document === null;
      },
      run: save,
    },
  ]);
  if (deck === null) return null;
  const addTitle = (): void =>
    addSlides(deck, [
      makeSlide(slideMaking(), 'songTitle', {
        texts: {제목: deck.source.title},
      }),
    ]);
  return {
    editor: (
      <BackgroundDrop deck={deck} report={report}>
        <SlideEditor
          deck={deck}
          tiles={tiles}
          header={<SongHeader onBack={onBack} />}
          extraMenu={() => [
            {
              kind: 'item',
              id: 'song-title',
              label: '제목 슬라이드 추가',
              ...menuAvailability(addReason(deck)),
              onSelect: addTitle,
            },
          ]}
          onBack={onBack}
          ui={ui}
        />
      </BackgroundDrop>
    ),
    inspector: (
      <BackgroundDrop deck={deck} report={report}>
        <SlideInspector deck={deck} tiles={tiles} />
      </BackgroundDrop>
    ),
  };
}
