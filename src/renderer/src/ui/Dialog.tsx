import {useId, useRef, type JSX, type MouseEvent, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Button} from './Button';
import {Checkbox, type CheckState} from './Checkbox';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {IconButton} from './IconButton';
import {layerContainer} from './layers';
import {PRIMARY_MARK, useModal, type InitialFocus} from './useModal';
import styles from './Dialog.module.css';

/** The dialog widths: 460, 600, 820, and 1080. */
export type DialogSize = 's' | 'm' | 'l' | 'xl';

/** A footer button of a dialog. */
export interface DialogAction {
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabled?: boolean | undefined;
  /** Tooltip text, such as the reason the button is disabled. */
  readonly title?: string | undefined;
}

export interface DialogProps {
  /** The name of the task, such as 새 예배. */
  readonly title: string;
  /** The object the dialog works on, such as a file name. */
  readonly subtitle?:
    {readonly text: string; readonly icon?: string | undefined} | undefined;
  readonly size: DialogSize;
  /** A fixed height, such as 700 for 새 예배; the content decides otherwise. */
  readonly height?: number | undefined;
  /** What [취소], the close button, and Esc do. */
  readonly onCancel: () => void;
  readonly cancelLabel?: string | null | undefined;
  /** An auxiliary action at the left of the footer. */
  readonly footerStart?: ReactNode;
  /** Focus the surface to keep existing autosaving names unarmed on open. */
  readonly initialFocus?: InitialFocus | undefined;
  /** The one primary button at the far right; Enter presses it. */
  readonly primary: DialogAction;
  /** Other buttons, between [취소] and the primary button. */
  readonly secondary?: readonly DialogAction[] | undefined;
  /** The option bar under the header. */
  readonly topBar?: ReactNode;
  /** The input bar above the footer. */
  readonly bottomBar?: ReactNode;
  /** A pick list on the left makes the body two columns. */
  readonly aside?: ReactNode;
  /** An action under the pick list, such as 지금 예배를 템플릿으로 저장. */
  readonly asideFoot?: ReactNode;
  readonly children: ReactNode;
}

const CANCEL_LABEL = '취소';
const CLOSE_LABEL = '닫기';
const CLOSE_SHORTCUT = 'Esc';
const SUBTITLE_ICON_SIZE = 14;

const sizeClass = {
  s: styles.s,
  m: styles.m,
  l: styles.l,
  xl: styles.xl,
} as const satisfies Record<DialogSize, string | undefined>;

function ActionButton({
  action,
  primary = false,
}: {
  readonly action: DialogAction;
  readonly primary?: boolean;
}): JSX.Element {
  return (
    <Button
      size="md"
      variant={primary ? 'primary' : 'secondary'}
      disabled={action.disabled}
      title={action.title}
      onClick={action.onSelect}
      {...(primary ? PRIMARY_MARK : {})}
    >
      {action.label}
    </Button>
  );
}

function DialogBody({
  aside,
  asideFoot,
  children,
}: {
  readonly aside: ReactNode;
  readonly asideFoot: ReactNode;
  readonly children: ReactNode;
}): JSX.Element {
  if (aside === undefined) return <div className={styles.body}>{children}</div>;
  return (
    <div className={classNames(styles.body, styles.split)}>
      <div className={styles.aside}>
        {aside}
        {asideFoot === undefined ? null : (
          <div className={styles.asideFoot}>{asideFoot}</div>
        )}
      </div>
      <div className={styles.main}>{children}</div>
    </div>
  );
}

const FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]';

function keepFocusInModal(event: MouseEvent<HTMLDivElement>): void {
  // NOTE(0913vision): A press on the scrim, or on text in the modal, would
  // move focus to the body, out of reach of the modal's Esc and focus trap.
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(FOCUSABLE) === null) event.preventDefault();
}

/**
 * The scrim under the menu bar that centers a modal surface, in the dialog
 * layer. A press on it, or on anything in the modal that can't take focus,
 * leaves focus where it was.
 */
export function ModalScrim({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return createPortal(
    <div className={styles.scrim} onMouseDown={keepFocusInModal}>
      {children}
    </div>,
    layerContainer('dialog'),
  );
}

/**
 * A dialog for one task. It covers the window below the menu bar with a
 * scrim, makes the app behind it inert, and closes only through its buttons,
 * Esc, or Enter. A click on the scrim does nothing.
 */
export function Dialog({
  title,
  subtitle,
  size,
  height,
  onCancel,
  cancelLabel = CANCEL_LABEL,
  footerStart,
  initialFocus = 'text-field',
  primary,
  secondary = [],
  topBar,
  bottomBar,
  aside,
  asideFoot,
  children,
}: DialogProps): JSX.Element {
  const titleId = useId();
  const surface = useRef<HTMLDivElement>(null);
  const onKeyDown = useModal({
    surface,
    onEscape: onCancel,
    onEnter: primary.disabled === true ? undefined : primary.onSelect,
    initialFocus,
  });
  return (
    <ModalScrim>
      <div
        ref={surface}
        role="dialog"
        tabIndex={initialFocus === 'surface' ? -1 : undefined}
        aria-modal="true"
        aria-labelledby={titleId}
        className={classNames(styles.dialog, sizeClass[size])}
        style={height === undefined ? undefined : {height}}
        onKeyDown={onKeyDown}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {subtitle === undefined ? null : (
            <span className={styles.subtitle}>
              {subtitle.icon === undefined ? null : (
                <Icon name={subtitle.icon} size={SUBTITLE_ICON_SIZE} />
              )}
              {subtitle.text}
            </span>
          )}
          <IconButton
            icon="x"
            label={CLOSE_LABEL}
            shortcut={CLOSE_SHORTCUT}
            size="md"
            className={styles.close}
            onClick={onCancel}
          />
        </div>
        {topBar === undefined ? null : (
          <div className={classNames(styles.bar, styles.barTop)}>{topBar}</div>
        )}
        <DialogBody aside={aside} asideFoot={asideFoot}>
          {children}
        </DialogBody>
        {bottomBar === undefined ? null : (
          <div className={styles.bar}>{bottomBar}</div>
        )}
        <div className={styles.footer}>
          {footerStart === undefined ? null : (
            <div className={styles.footerStart}>{footerStart}</div>
          )}
          {cancelLabel === null ? null : (
            <Button size="md" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          {secondary.map(action => (
            <ActionButton key={action.label} action={action} />
          ))}
          <ActionButton action={primary} primary />
        </div>
      </div>
    </ModalScrim>
  );
}

/** A named control in a dialog bar, such as 이름 and its text field. */
export function DialogField({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

export interface DialogBoxProps {
  readonly title: string;
  /** A count at the right end of the header, such as 항목 9개. */
  readonly meta?: string | undefined;
  /** A select-all checkbox before the title. */
  readonly checkAll?:
    | {
        readonly checked: CheckState;
        readonly onChange: (checked: boolean) => void;
      }
    | undefined;
  readonly children: ReactNode;
}

/** A list box inside a dialog body, with a header and a scrolling list. */
export function DialogBox({
  title,
  meta,
  checkAll,
  children,
}: DialogBoxProps): JSX.Element {
  const titleId = useId();
  return (
    <section className={styles.box} aria-labelledby={titleId}>
      <div className={styles.boxHeader}>
        {checkAll === undefined ? null : (
          <Checkbox
            checked={checkAll.checked}
            onChange={checkAll.onChange}
            aria-labelledby={titleId}
          />
        )}
        <span id={titleId}>{title}</span>
        {meta === undefined ? null : (
          <span className={styles.boxMeta}>{meta}</span>
        )}
      </div>
      <div className={styles.boxBody}>{children}</div>
    </section>
  );
}
