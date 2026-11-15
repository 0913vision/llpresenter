import {useState, useSyncExternalStore, type JSX} from 'react';
import {
  SLIDE_TRANSITION_LIMITS,
  type SlideTransition,
} from '@core/schema/slideTransition';
import type {SlideListItem} from '@core/songs/slideListEdits';
import type {SlideListSession} from '@renderer/features/songs/editor/slideListSession';
import {Button} from '@renderer/ui/Button';
import {TextField} from '@renderer/ui/TextField';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import styles from './SlideInspector.module.css';
import {
  SLIDE_EFFECTS,
  SLIDE_DIRECTIONS,
} from '@renderer/ui/slideTransitionChoices';
import {
  selectedSlideTransition,
  applySlideTransitionToAll,
} from '@renderer/features/songs/editor/slideTransitionSelection';

const effects = SLIDE_EFFECTS.map(([value, label]) => ({value, label}));
const directions = SLIDE_DIRECTIONS.map(([value, , label]) => ({value, label}));

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
  );
}

/** Transition edits use the same selection, history and save queue as the editor. */
export function TransitionRows<T extends SlideListItem>({
  session,
  disabled,
  song = false,
  onApplyAll,
}: {
  readonly onApplyAll?: ((transition: SlideTransition) => void) | undefined;
  readonly session: SlideListSession<T>;
  readonly disabled: boolean;
  readonly song?: boolean;
}): JSX.Element {
  const view = useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const selected = view.slides.filter(slide =>
    view.selection.ids.has(slide.id),
  );
  const {current: first, mixed, value} = selectedSlideTransition(view);
  const locked = disabled || session.readOnly || selected.length === 0;
  const set = (transition: SlideTransition | undefined): void =>
    session.commandSlides({type: 'transition', transition});
  return (
    <TransitionPicker
      value={value}
      mixed={mixed}
      disabled={locked}
      selectionKey={selected.map(slide => slide.id).join(',')}
      onChange={set}
      onSeconds={sec =>
        session.commandSlides({type: 'transition-seconds', sec})
      }
      onApplyAll={() => {
        if (onApplyAll === undefined) {
          applySlideTransitionToAll(session, first ?? value);
        } else {
          onApplyAll(first ?? value);
        }
      }}
      song={song}
    />
  );
}

export function TransitionPicker({
  value,
  mixed,
  disabled,
  selectionKey,
  onChange,
  onSeconds,
  onApplyAll,
  song = false,
  allowAll = true,
}: {
  readonly allowAll?: boolean;
  readonly value: SlideTransition;
  readonly mixed: boolean;
  readonly disabled: boolean;
  readonly selectionKey: string;
  readonly onChange: (transition: SlideTransition) => void;
  readonly onSeconds: (seconds: number) => void;
  readonly onApplyAll: () => void;
  readonly song?: boolean;
}): JSX.Element {
  const locked = disabled;
  const set = onChange;
  return (
    <PropertyGroup title="전환">
      <PropertyRow label="효과">
        {({controlId}) => (
          <SelectMenu
            id={controlId}
            aria-label="효과"
            block
            disabled={locked}
            value={mixed ? undefined : value.kind}
            valueText={mixed ? '혼합' : undefined}
            options={effects}
            onChange={kind => {
              set({
                kind,
                sec: value.sec,
                ...(kind === 'push' || kind === 'wipe'
                  ? {dir: value.dir ?? 'left'}
                  : {}),
              });
            }}
          />
        )}
      </PropertyRow>
      <PropertyRow label="방향">
        {({controlId}) => (
          <SelectMenu
            id={controlId}
            aria-label="방향"
            block
            disabled={
              locked ||
              mixed ||
              (value.kind !== 'push' && value.kind !== 'wipe')
            }
            value={mixed ? undefined : (value.dir ?? 'left')}
            valueText={mixed ? '혼합' : undefined}
            options={directions}
            onChange={dir => set({...value, dir})}
          />
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
            {song ? '이 곡 전체에 적용' : '전체 슬라이드에 적용'}
          </Button>
        )}
      </PropertyRow>
    </PropertyGroup>
  );
}
