import {useState, type JSX} from 'react';
import {
  SLIDE_TRANSITION_LIMITS,
  type SlideTransition,
} from '@core/schema/slideTransition';
import {Button} from '@renderer/ui/Button';
import {TextField} from '@renderer/ui/TextField';
import {EffectPicture} from '@renderer/ui/SlideTransitionControl';
import transitionStyles from '@renderer/ui/SlideTransitionControl.module.css';
import {PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import {focusSlides} from './deckSelection';
import styles from './SlideInspector.module.css';
import {
  SLIDE_EFFECTS,
  SLIDE_DIRECTIONS,
} from '@renderer/ui/slideTransitionChoices';
import {
  INITIAL_SLIDE_EFFECT,
  sameSlideTransition,
} from '@renderer/ui/slideTransitionChoices';

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
  empty,
  onCommit,
}: {
  readonly id: string;
  readonly value: number;
  readonly mixed: boolean;
  readonly disabled: boolean;
  readonly empty: boolean;
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
        value={
          empty
            ? ''
            : (draft ?? (mixed ? '' : String(Math.round(value * 100) / 100)))
        }
        onChange={setDraft}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.blur();
            focusSlides();
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
              key={`${selectionKey}:${value.kind}`}
              id={controlId}
              value={value.sec}
              mixed={mixed}
              disabled={locked || (!mixed && value.kind === 'none')}
              empty={!mixed && value.kind === 'none'}
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
