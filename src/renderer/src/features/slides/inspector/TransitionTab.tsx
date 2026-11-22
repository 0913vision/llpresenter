import {useState, type JSX} from 'react';
import {
  SLIDE_TRANSITION_LIMITS,
  type SlideTransition,
} from '@core/schema/slideTransition';
import {withTransition} from '@core/slides';
import {TextField} from '@renderer/ui/TextField';
import {PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import {
  INITIAL_SLIDE_EFFECT,
  sameSlideTransition,
  SLIDE_DIRECTIONS,
  SLIDE_EFFECTS,
} from '@renderer/ui/slideTransitionChoices';
import {focusSlides} from '../deckSelection';
import {ApplyToAll} from './ApplyToAll';
import {changeSelected, type ChosenSlides} from './changeSelected';
import {EffectPicture} from './EffectPicture';
import styles from './TransitionTab.module.css';

/** The transition of several slides, or the one to start from. */
function chosenTransition(chosen: ChosenSlides['chosen']): {
  readonly value: SlideTransition;
  readonly mixed: boolean;
} {
  const value = chosen[0]?.transition ?? INITIAL_SLIDE_EFFECT;
  const mixed = chosen.some(
    slide => !sameSlideTransition(slide.transition, value),
  );
  return {value: mixed ? INITIAL_SLIDE_EFFECT : value, mixed};
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
    <span className={styles.time}>
      <TextField
        id={id}
        aria-label="전환 시간"
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

/** The transition the selected slides come in with. */
export function TransitionTab({deck, chosen}: ChosenSlides): JSX.Element {
  const {value, mixed} = chosenTransition(chosen);
  const locked = deck.readOnly;
  const set = (transition: SlideTransition): void =>
    changeSelected(deck, slide => withTransition(slide, transition));
  return (
    <PropertyGroup title="화면 전환">
      <div className={styles.rows}>
        <PropertyRow label="효과">
          {() => (
            <div className={styles.effects} role="group" aria-label="효과">
              {SLIDE_EFFECTS.map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  className={styles.effect}
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
            <div className={styles.directions} role="group" aria-label="방향">
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
              key={`${chosen.map(slide => slide.id).join(',')}:${value.kind}`}
              id={controlId}
              value={value.sec}
              mixed={mixed}
              disabled={locked || (!mixed && value.kind === 'none')}
              empty={!mixed && value.kind === 'none'}
              onCommit={sec =>
                changeSelected(deck, slide =>
                  slide.transition === undefined
                    ? slide
                    : withTransition(slide, {...slide.transition, sec}),
                )
              }
            />
          )}
        </PropertyRow>
        <ApplyToAll
          deck={deck}
          change={mixed ? null : slide => withTransition(slide, value)}
        >
          전체 슬라이드에 적용
        </ApplyToAll>
      </div>
    </PropertyGroup>
  );
}
