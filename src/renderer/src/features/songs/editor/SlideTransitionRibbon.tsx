import {useSyncExternalStore, type JSX} from 'react';
import type {
  SlideListItem,
  SlideListSnapshot,
} from '@core/songs/slideListEdits';
import type {SlideTransition} from '@core/schema/slideTransition';
import {Button} from '@renderer/ui/Button';
import {SlideTransitionControl} from '@renderer/ui/SlideTransitionControl';
import {isComposing} from '@renderer/ui/ime';
import type {SlideListSession} from './slideListSession';
import styles from './SlideTransitionRibbon.module.css';

const INITIAL_EFFECT: SlideTransition = {kind: 'dissolve', sec: 0.5};
function selectedTransition(view: SlideListSnapshot<SlideListItem>) {
  const selected = view.slides.filter(slide =>
    view.selection.ids.has(slide.id),
  );
  const current = selected[0]?.transition;
  const key = (effect: SlideTransition | undefined): string =>
    JSON.stringify(
      effect === undefined
        ? null
        : [effect.kind, effect.sec, effect.dir ?? 'left'],
    );
  const mixed = selected.some(slide => key(slide.transition) !== key(current));
  return {
    current,
    mixed,
    count: selected.length,
    value: mixed ? INITIAL_EFFECT : (current ?? INITIAL_EFFECT),
  };
}

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
  const {current, mixed, count, value} = selectedTransition(view);
  const locked = disabled || session.readOnly || count === 0;
  return (
    <div
      className={styles.ribbon}
      onKeyDown={event => {
        if (
          locked ||
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
              selectedTransition(session.slideModel.getSnapshot()).value,
            ),
          })
        }
      >
        <Button
          disabled={locked || mixed}
          className={styles.all}
          onClick={() =>
            session.commandSlides({
              type: 'transition',
              transition: current,
              all: true,
            })
          }
        >
          {song ? '이 곡 전체에 적용' : '전체 슬라이드에 적용'}
        </Button>
      </SlideTransitionControl>
      <span className={styles.hint}>
        {mixed
          ? '선택한 슬라이드의 효과가 서로 다릅니다.'
          : count > 1
            ? `선택한 슬라이드 ${count}장에 적용됩니다.`
            : '전환 효과는 진행 중 슬라이드를 보낼 때 재생합니다.'}
      </span>
    </div>
  );
}
