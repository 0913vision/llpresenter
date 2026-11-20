import {useState, useSyncExternalStore, type JSX} from 'react';
import {
  SLIDE_TRANSITION_LIMITS,
  type SlideTransition,
} from '@core/schema/slideTransition';
import type {SlideListItem} from '@core/songs/slideListEdits';
import type {SlideListSession} from '@renderer/features/songs/editor/slideListSession';
import {Button} from '@renderer/ui/Button';
import {TextField} from '@renderer/ui/TextField';
import {EffectPicture} from '@renderer/ui/SlideTransitionControl';
import transitionStyles from '@renderer/ui/SlideTransitionControl.module.css';
import {PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import styles from './SlideInspector.module.css';
import {
  SLIDE_EFFECTS,
  SLIDE_DIRECTIONS,
} from '@renderer/ui/slideTransitionChoices';
import {
  applySlideTransitionToAll,
  sameSlideTransition,
  INITIAL_SLIDE_EFFECT,
} from '@renderer/features/songs/editor/slideTransitionSelection';

/** Summarizes selected effects consistently for every item adapter. */
export function inspectorTransition(
  values: ReadonlyArray<SlideTransition | undefined>,
): {readonly value: SlideTransition; readonly mixed: boolean} {
  const value = values[0] ?? INITIAL_SLIDE_EFFECT;
  return {
    value,
    mixed: values.some(effect => !sameSlideTransition(effect, value)),
  };
}

function TimeField({
  id,
  value,
  mixed,
  disabled,
  onCommit,
}: {
  readonly id: string;
  readonly value: number;
  readonly mixed: boolean;
  readonly disabled: boolean;
  readonly onCommit: (seconds: number) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (): void => {
    if (draft === null) return;
    const parsed = Number(draft.trim());
    if (draft.trim() !== '' && Number.isFinite(parsed)) {
      const {min, max} = SLIDE_TRANSITION_LIMITS;
      onCommit(Math.min(max, Math.max(min, Math.round(parsed * 100) / 100)));
    }
    setDraft(null);
  };
  return (
    <span className={styles.timeField}>
      <TextField
        id={id}
        aria-label="전환 시간"
        block
        inputMode="decimal"
        placeholder={mixed ? '혼합' : undefined}
        disabled={disabled}
        value={draft ?? (mixed ? '' : String(Math.round(value * 100) / 100))}
        onChange={setDraft}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.blur();
            document
              .querySelector<HTMLElement>(
                '[data-song-slide][aria-selected="true"], [data-leading-card][aria-selected="true"], [data-song-slide]',
              )
              ?.focus();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setDraft(null);
          }
        }}
      />
      <span>초</span>
    </span>
  );
}

/** Adapts a slide-list selection to the shared transition section. */
export function useTransitionSelection<T extends SlideListItem>({
  session,
  disabled,
  onApplyAll,
}: {
  readonly onApplyAll?: ((transition: SlideTransition) => void) | undefined;
  readonly session: SlideListSession<T>;
  readonly disabled: boolean;
}): TransitionSectionProps {
  const view = useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const selected = view.slides.filter(slide =>
    view.selection.ids.has(slide.id),
  );
  const first = selected[0]?.transition;
  const summary = inspectorTransition(selected.map(slide => slide.transition));
  const mixed = summary.mixed;
  const value = mixed ? INITIAL_SLIDE_EFFECT : summary.value;
  const locked = disabled || session.readOnly || selected.length === 0;
  const set = (transition: SlideTransition | undefined): void =>
    session.commandSlides({type: 'transition', transition});
  return {
    value,
    mixed,
    disabled: locked,
    selectionKey: selected.map(slide => slide.id).join(','),
    onChange: set,
    onSeconds: sec => session.commandSlides({type: 'transition-seconds', sec}),
    onApplyAll: () => {
      if (onApplyAll === undefined) {
        applySlideTransitionToAll(session, first ?? value);
      } else {
        onApplyAll(first ?? value);
      }
    },
  };
}

export interface TransitionSectionProps {
  readonly allowAll?: boolean | undefined;
  readonly value: SlideTransition;
  readonly mixed: boolean;
  readonly disabled: boolean;
  readonly selectionKey: string;
  readonly onChange: (transition: SlideTransition) => void;
  readonly onSeconds: (seconds: number) => void;
  readonly onApplyAll: () => void;
}

/** The same effect, direction, duration and apply-all rows for every item. */
export function TransitionSection({
  value,
  mixed,
  disabled,
  selectionKey,
  onChange,
  onSeconds,
  onApplyAll,
  allowAll = true,
}: TransitionSectionProps): JSX.Element {
  const locked = disabled;
  const set = onChange;
  return (
    <PropertyGroup title="전환">
      <div className={styles.transitionRows}>
        <PropertyRow label="효과">
          {() => (
            <div
              className={transitionStyles.gallery}
              role="group"
              aria-label="효과"
            >
              {SLIDE_EFFECTS.map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  className={transitionStyles.tile}
                  disabled={locked}
                  aria-pressed={!mixed && value.kind === kind}
                  onClick={() => {
                    set({
                      kind,
                      sec: value.sec,
                      ...(kind === 'push' || kind === 'wipe'
                        ? {dir: value.dir ?? 'left'}
                        : {}),
                    });
                  }}
                >
                  <EffectPicture kind={kind} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </PropertyRow>
        <PropertyRow label="방향">
          {() => (
            <div
              className={transitionStyles.directions}
              role="group"
              aria-label="방향"
            >
              {SLIDE_DIRECTIONS.map(([dir, arrow, label]) => (
                <button
                  key={dir}
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-pressed={
                    !mixed &&
                    (value.kind === 'push' || value.kind === 'wipe') &&
                    (value.dir ?? 'left') === dir
                  }
                  disabled={
                    locked ||
                    mixed ||
                    (value.kind !== 'push' && value.kind !== 'wipe')
                  }
                  onClick={() => set({...value, dir})}
                >
                  {arrow}
                </button>
              ))}
            </div>
          )}
        </PropertyRow>
        <PropertyRow label="시간">
          {({controlId}) => (
            <TimeField
              key={selectionKey}
              id={controlId}
              value={value.sec}
              mixed={mixed}
              disabled={locked || (!mixed && value.kind === 'none')}
              onCommit={onSeconds}
            />
          )}
        </PropertyRow>
        <PropertyRow label="">
          {() => (
            <Button
              className={styles.full}
              size="md"
              disabled={locked || mixed || !allowAll}
              onClick={onApplyAll}
            >
              전체 슬라이드에 적용
            </Button>
          )}
        </PropertyRow>
      </div>
    </PropertyGroup>
  );
}
