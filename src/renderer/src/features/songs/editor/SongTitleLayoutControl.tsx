import {useSyncExternalStore, type JSX} from 'react';
import {DEFAULT_SONG_TITLE_LAYOUT} from '@core/schema/songTitleLayout';
import {THEME_LIMITS} from '@core/themes/elementRules';
import {NumberField} from '@renderer/ui/NumberField';
import {isComposing} from '@renderer/ui/ime';
import type {SongSession} from './songSession';
import styles from './SongTitleLayoutControl.module.css';

export function SongTitleLayoutControl({
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
  const block = view.slides.findIndex(slide =>
    view.selection.ids.has(slide.id),
  );
  const slide = view.slides[block];
  if (view.selection.ids.size !== 1 || !slide?.titleSlide) return null;
  const labels = {
    titleTracking: '제목 자간',
    subtitleTracking: '부제 자간',
    titleTop: '제목 위쪽',
    subtitleTop: '부제 위쪽',
  };
  const spacing = {...DEFAULT_SONG_TITLE_LAYOUT, ...slide.titleLayout};
  return (
    <div
      className={styles.spacing}
      onKeyDown={event => {
        if (
          event.defaultPrevented ||
          disabled ||
          session.readOnly ||
          isComposing(event) ||
          !(event.ctrlKey || event.metaKey) ||
          event.altKey
        ) {
          return;
        }
        const key = event.key.toLowerCase();
        if (key !== 'z' && key !== 'y') return;
        event.preventDefault();
        event.stopPropagation();
        session.edit(key === 'y' || event.shiftKey ? 'redo' : 'undo');
      }}
    >
      {(
        [
          'titleTracking',
          'subtitleTracking',
          'titleTop',
          'subtitleTop',
        ] as const
      ).map(key => (
        <label key={key} className={styles.field}>
          {labels[key]}
          <NumberField
            aria-label={labels[key]}
            value={spacing[key]}
            min={key.endsWith('Top') ? 0 : THEME_LIMITS.tracking.min}
            max={
              key === 'titleTop'
                ? THEME_LIMITS.height - 160
                : key === 'subtitleTop'
                  ? THEME_LIMITS.height - 90
                  : THEME_LIMITS.tracking.max
            }
            unit="px"
            updateOn="commit"
            disabled={disabled || session.readOnly}
            onChange={value =>
              session.edit({
                type: 'title-layout',
                block,
                layout: {
                  ...slide.titleLayout,
                  titleTracking: spacing.titleTracking,
                  subtitleTracking: spacing.subtitleTracking,
                  [key]: value,
                },
              })
            }
          />
        </label>
      ))}
    </div>
  );
}
