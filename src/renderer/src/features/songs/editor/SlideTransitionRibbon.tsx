import {useSyncExternalStore, type JSX} from 'react';
import type {SlideListItem} from '@core/songs/slideListEdits';
import {Button} from '@renderer/ui/Button';
import {SlideTransitionControl} from '@renderer/ui/SlideTransitionControl';
import {
  selectedSlideTransition,
  applySlideTransitionToAll,
  slideTransitionUndo,
} from './slideTransitionSelection';
import type {SlideListSession} from './slideListSession';
import styles from './SlideTransitionRibbon.module.css';

/** Edits the shared slide selection through its one history and save queue. */
export function SlideTransitionRibbon<T extends SlideListItem>({
  session,
  disabled = false,
  song = false,
}: {
  readonly session: SlideListSession<T>;
  readonly disabled?: boolean;
  readonly song?: boolean;
}): JSX.Element {
  const view = useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const {current, mixed, count, value} = selectedSlideTransition(view);
  const locked = disabled || session.readOnly || count === 0;
  return (
    <div
      className={styles.ribbon}
      onKeyDown={event => slideTransitionUndo(event, session, locked)}
    >
      <SlideTransitionControl
        label="슬라이드 전환"
        value={value}
        disabled={locked}
        mixed={mixed}
        inherit={{
          selected: current === undefined,
          onSelect: () =>
            session.commandSlides({type: 'transition', transition: undefined}),
        }}
        onChange={update =>
          session.commandSlides({
            type: 'transition',
            transition: update(
              selectedSlideTransition(session.slideModel.getSnapshot()).value,
            ),
          })
        }
      >
        <Button
          size="md"
          disabled={locked || mixed}
          className={styles.all}
          onClick={() => applySlideTransitionToAll(session, current)}
        >
          {song ? '이 곡 전체에 적용' : '전체 슬라이드에 적용'}
        </Button>
      </SlideTransitionControl>
      {mixed || count > 1 ? (
        <span className={styles.hint}>
          {mixed
            ? '선택한 슬라이드의 효과가 서로 다릅니다.'
            : `선택한 슬라이드 ${count}장에 적용됩니다.`}
        </span>
      ) : null}
    </div>
  );
}
