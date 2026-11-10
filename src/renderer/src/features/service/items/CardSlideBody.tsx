import {useEffect, useRef, useState, type JSX, type KeyboardEvent} from 'react';
import {SLIDES_LIMITS, type SectionCard} from '@core/schema/service';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {SlideThumbnailBand} from '@renderer/ui/SlideThumbnail';
import styles from './CardSlideBody.module.css';

/** Picture and editable names shared by the list row and grid cell. */
export function CardSlideBody({
  itemId,
  card,
  disabled,
  onChange,
  onSelect,
  mode = 'list',
}: {
  readonly itemId: string;
  readonly card: SectionCard;
  readonly disabled: boolean;
  readonly onChange: (field: 'name' | 'english', value: string) => void;
  readonly onSelect?: (() => void) | undefined;
  readonly mode?: 'list' | 'grid' | undefined;
}): JSX.Element {
  const [draft, setDraft] = useState({name: card.name, english: card.english});
  const editing = useRef<'name' | 'english' | null>(null);
  const cancelled = useRef(false);
  useEffect(() => {
    setDraft(current => ({
      name: editing.current === 'name' ? current.name : card.name,
      english: editing.current === 'english' ? current.english : card.english,
    }));
  }, [itemId, card.name, card.english]);
  const preview = {...card, ...draft};
  const keyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelled.current = true;
      setDraft({name: card.name, english: card.english});
      event.currentTarget.blur();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.blur();
    }
  };
  const commit = (field: 'name' | 'english', value: string): void => {
    editing.current = null;
    if (cancelled.current) cancelled.current = false;
    else if (value !== card[field]) onChange(field, value);
  };
  const theme = useSlideTheme({
    id: itemId,
    kind: 'slides',
    form: 'blank',
    title: draft.name,
    theme: card.theme,
  });
  return (
    <>
      <div className={styles.thumbnail} data-view={mode}>
        <div className={styles.canvas}>
          {theme === undefined ? null : (
            <SlidePicture
              {...theme}
              slide={{
                itemId,
                position: 0,
                label: draft.name,
                lines: [draft.english],
                sectionCard: preview,
              }}
            />
          )}
          {onSelect === undefined ? null : (
            <button
              type="button"
              className={styles.select}
              aria-label={card.name}
              onClick={onSelect}
            />
          )}
        </div>
        <SlideThumbnailBand number={1} label="구역 이름" />
      </div>
      <div className={styles.fields} data-view={mode}>
        <label>
          구역 이름
          <input
            value={draft.name}
            maxLength={SLIDES_LIMITS.name}
            disabled={disabled}
            onFocus={() => {
              editing.current = 'name';
            }}
            onChange={event => {
              const value = event.currentTarget.value;
              setDraft(current => ({...current, name: value}));
            }}
            onKeyDown={keyDown}
            onBlur={event => commit('name', event.currentTarget.value)}
          />
        </label>
        <label>
          영문 이름
          <input
            value={draft.english}
            maxLength={SLIDES_LIMITS.text}
            disabled={disabled}
            onFocus={() => {
              editing.current = 'english';
            }}
            onChange={event => {
              const value = event.currentTarget.value;
              setDraft(current => ({...current, english: value}));
            }}
            onKeyDown={keyDown}
            onBlur={event => commit('english', event.currentTarget.value)}
          />
        </label>
      </div>
    </>
  );
}
