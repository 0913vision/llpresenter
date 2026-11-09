import type {JSX, ReactNode} from 'react';
import {
  SLIDE_TRANSITION_LIMITS,
  type SlideTransition,
} from '@core/schema/slideTransition';
import {NumberField} from './NumberField';
import styles from './SlideTransitionControl.module.css';
import {SLIDE_EFFECTS, SLIDE_DIRECTIONS} from './slideTransitionChoices';

export type SlideTransitionChange = (
  current: SlideTransition,
) => SlideTransition;

function EffectPicture({
  kind,
}: {
  readonly kind: SlideTransition['kind'] | 'default';
}): JSX.Element {
  return (
    <svg viewBox="0 0 44 30" aria-hidden="true">
      <rect
        x="4"
        y="5"
        width="36"
        height="20"
        rx="2"
        className={kind === 'default' ? styles.inherited : styles.old}
      />
      {kind === 'none' ? <path d="M9 25 35 5" className={styles.edge} /> : null}
      {kind === 'dissolve' ? (
        <rect
          x="16"
          y="9"
          width="24"
          height="16"
          rx="2"
          opacity=".7"
          className={styles.next}
        />
      ) : null}
      {kind === 'push' ? (
        <>
          <rect x="16" y="5" width="24" height="20" className={styles.next} />
          <path
            d="M36 15H22m4-4-4 4 4 4M7 11h5M5 15h7M7 19h5"
            className={styles.edge}
          />
        </>
      ) : null}
      {kind === 'wipe' ? (
        <>
          <rect x="20" y="5" width="20" height="20" className={styles.next} />
          <path d="M20 4v22" className={styles.edge} />
        </>
      ) : null}
    </svg>
  );
}

/** The slide effects gallery shared by preferences and slide editing. */
export function SlideTransitionControl({
  value,
  onChange,
  label,
  disabled = false,
  inherit,
  mixed = false,
  children,
}: {
  readonly value: SlideTransition;
  readonly onChange: (update: SlideTransitionChange) => void;
  readonly label: string;
  readonly disabled?: boolean;
  readonly inherit?: {
    readonly selected: boolean;
    readonly onSelect: () => void;
  };
  readonly mixed?: boolean;
  readonly children?: ReactNode;
}): JSX.Element {
  const own = inherit?.selected !== true && !mixed;
  const directional = own && (value.kind === 'push' || value.kind === 'wipe');
  return (
    <div className={styles.controls} role="group" aria-label={label}>
      <div className={styles.group}>
        {inherit === undefined ? null : <span>효과</span>}
        <div className={styles.gallery} role="group" aria-label="효과">
          {inherit === undefined ? null : (
            <button
              type="button"
              className={styles.tile}
              disabled={disabled}
              aria-pressed={inherit.selected && !mixed}
              onClick={inherit.onSelect}
            >
              <EffectPicture kind="default" />
              <span>기본값</span>
            </button>
          )}
          {SLIDE_EFFECTS.map(([kind, name]) => (
            <button
              key={kind}
              type="button"
              className={styles.tile}
              disabled={disabled}
              aria-pressed={own && value.kind === kind}
              onClick={() =>
                onChange(current => {
                  const {dir, ...rest} = current;
                  return {
                    ...rest,
                    kind,
                    ...(kind === 'push' || kind === 'wipe'
                      ? {dir: dir ?? 'left'}
                      : {}),
                  };
                })
              }
            >
              <EffectPicture kind={kind} />
              <span>{name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={styles.group}>
        <span>방향</span>
        <div className={styles.directions}>
          {SLIDE_DIRECTIONS.map(([dir, arrow, name]) => (
            <button
              key={dir}
              type="button"
              disabled={disabled || !directional}
              aria-label={name}
              title={name}
              aria-pressed={directional && (value.dir ?? 'left') === dir}
              onClick={() =>
                onChange(current =>
                  current.kind === 'push' || current.kind === 'wipe'
                    ? {...current, dir}
                    : current,
                )
              }
            >
              {arrow}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.group}>
        <span>시간</span>
        <NumberField
          className={styles.time}
          aria-label={`${label} 시간`}
          value={value.sec}
          {...SLIDE_TRANSITION_LIMITS}
          unit="초"
          disabled={disabled || !own || value.kind === 'none'}
          updateOn="commit"
          onChange={sec => onChange(current => ({...current, sec}))}
        />
        {children}
      </div>
    </div>
  );
}
