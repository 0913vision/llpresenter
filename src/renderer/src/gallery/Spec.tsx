import {useState, type CSSProperties, type JSX, type ReactNode} from 'react';
import {classNames} from '../ui/classNames';
import styles from './Gallery.module.css';

/** The surface a group of specimens sits on, as on the preview cards. */
export type SpecSurface = 'app' | 'panel' | 'dialog' | 'inset';

/**
 * A state that a preview card pins with `.is-hover`, `.is-active`, or
 * `.is-focus`. The gallery draws the control in its default state, and the
 * comparison tool applies the state with real input.
 */
export type SpecPin = 'hover' | 'pressed' | 'focus';

const surfaceClass = {
  app: undefined,
  panel: styles.panel,
  dialog: styles.dialog,
  inset: styles.inset,
} as const satisfies Record<SpecSurface, string | undefined>;

export function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section className={styles.section} data-section={title}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

export function SpecGroup({
  title,
  surface = 'app',
  alignTop = false,
  children,
}: {
  readonly title?: string;
  readonly surface?: SpecSurface;
  readonly alignTop?: boolean;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className={styles.group}>
      {title === undefined ? null : (
        <h3 className={styles.groupTitle}>{title}</h3>
      )}
      <div
        className={classNames(
          styles.spec,
          surfaceClass[surface],
          alignTop && styles.top,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function SpecItem({
  label,
  pin,
  pinIndex = 0,
  width,
  children,
}: {
  readonly label: string;
  readonly pin?: SpecPin | undefined;
  /** Which control inside the item takes the pinned state. */
  readonly pinIndex?: number | undefined;
  /** The width the preview card gives the specimen, in pixels. */
  readonly width?: number | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  const style: CSSProperties | undefined =
    width === undefined ? undefined : {width};
  return (
    <div
      className={styles.item}
      data-spec={label}
      data-pin={pin}
      data-pin-index={pin === undefined ? undefined : pinIndex}
    >
      <div
        className={classNames(styles.row, width !== undefined && styles.fill)}
        style={style}
      >
        {children}
      </div>
      <span className={styles.itemLabel}>{label}</span>
    </div>
  );
}

/** A change handler for specimens that only show a state. */
export function ignore(): undefined {
  return undefined;
}

/** Keeps a specimen's value in local state so that it can be tried out. */
export function Stateful<T>({
  initial,
  children,
}: {
  readonly initial: T;
  readonly children: (value: T, setValue: (value: T) => void) => ReactNode;
}): ReactNode {
  const [value, setValue] = useState(initial);
  return children(value, setValue);
}
