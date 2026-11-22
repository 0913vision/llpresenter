import {useSyncExternalStore, type JSX} from 'react';
import {SONG_LIMITS} from '@core/schema/song';
import {TextArea} from '@renderer/ui/TextArea';
import type {SongSession} from './songSession';
import styles from './SongSlideText.module.css';

/** The text of the selected slide of a song, where it is kept. */
export function SongSlideText({
  session,
  disabled,
}: {
  readonly session: SongSession;
  readonly disabled: boolean;
}): JSX.Element | null {
  const view = useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const block = session.selectedOccurrence;
  const slide = view.slides[block];
  if (slide === undefined) return null;
  const name = slide.titleSlide ? '제목 및 부제' : '가사';
  return (
    <label className={styles.field}>
      {name}
      <TextArea
        aria-label={name}
        title={
          slide.titleSlide
            ? `제목 및 부제: 두 줄, 각 ${SONG_LIMITS.titleLine}자`
            : undefined
        }
        value={slide.lines.join('\n')}
        readOnly={disabled || session.readOnly}
        spellCheck={false}
        onChange={text => {
          session.selectOccurrence(block);
          session.edit({
            type: 'text',
            text,
            start: text.length,
            end: text.length,
          });
        }}
        onBlur={() => session.endTyping()}
      />
    </label>
  );
}
