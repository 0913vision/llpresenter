import {useId, useRef, type JSX, type ReactNode} from 'react';
import {Button} from './Button';
import {classNames} from './classNames';
import {ModalScrim} from './Dialog';
import {Icon} from './Icon';
import {PRIMARY_MARK, useModal} from './useModal';
import styles from './AlertDialog.module.css';

/** A button of a confirmation dialog, named by what happens. */
export interface AlertAction {
  readonly label: string;
  readonly onSelect: () => void;
  /** The one primary button, at the far right; Enter presses it. */
  readonly primary?: boolean | undefined;
  /** Esc presses it when there is no [취소], as 새로 시작 in recovery. */
  readonly escape?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  /** Tooltip text, such as the reason the button is disabled. */
  readonly title?: string | undefined;
}

export interface AlertDialogProps {
  /** A 24px icon for what the question is about, such as `song`. */
  readonly icon: string;
  /** One question, or a noun when the question is clear. */
  readonly title: string;
  /** The facts needed to decide, such as 라이브러리 곡 4장, 10월 20일 수정. */
  readonly meta?: readonly string[] | undefined;
  /** [취소] at the left end; Esc presses it. */
  readonly onCancel?: (() => void) | undefined;
  readonly cancelLabel?: string | undefined;
  /** The buttons on the right, the primary one last. */
  readonly actions: readonly AlertAction[];
  /** A section of states to pick, such as 복구할 상태 and its check rows. */
  readonly list?:
    {readonly label: string; readonly children: ReactNode} | undefined;
}

const CANCEL_LABEL = '취소';
const ICON_SIZE = 24;

function escapeAction(
  onCancel: (() => void) | undefined,
  actions: readonly AlertAction[],
): (() => void) | undefined {
  return onCancel ?? actions.find(action => action.escape === true)?.onSelect;
}

function enterAction(
  actions: readonly AlertAction[],
): (() => void) | undefined {
  const primary = actions.find(action => action.primary === true);
  return primary === undefined || primary.disabled === true
    ? undefined
    : primary.onSelect;
}

function AlertList({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): JSX.Element {
  const labelId = useId();
  return (
    <div className={styles.list} role="group" aria-labelledby={labelId}>
      <p id={labelId} className={styles.listLabel}>
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * A confirmation dialog that asks one question before going on. Focus starts
 * on the primary button. It has no close button, and a click on the scrim
 * does nothing.
 */
export function AlertDialog({
  icon,
  title,
  meta = [],
  onCancel,
  cancelLabel = CANCEL_LABEL,
  actions,
  list,
}: AlertDialogProps): JSX.Element {
  const titleId = useId();
  const metaId = useId();
  const surface = useRef<HTMLDivElement>(null);
  const onKeyDown = useModal({
    surface,
    onEscape: escapeAction(onCancel, actions),
    onEnter: enterAction(actions),
    initialFocus: 'primary',
  });
  return (
    <ModalScrim>
      <div
        ref={surface}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={meta.length > 0 ? metaId : undefined}
        className={classNames(
          styles.alert,
          list !== undefined && styles.withList,
        )}
        onKeyDown={onKeyDown}
      >
        <div className={styles.head}>
          <span className={styles.icon}>
            <Icon name={icon} size={ICON_SIZE} />
          </span>
          <div className={styles.text}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {meta.length === 0 ? null : (
              <p id={metaId} className={styles.meta}>
                {meta.map(fact => (
                  <span key={fact}>{fact}</span>
                ))}
              </p>
            )}
          </div>
        </div>
        {list === undefined ? null : (
          <AlertList label={list.label}>{list.children}</AlertList>
        )}
        <div className={styles.actions}>
          {onCancel === undefined ? null : (
            <Button size="md" className={styles.cancel} onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          {actions.map(action => (
            <Button
              key={action.label}
              size="md"
              variant={action.primary === true ? 'primary' : 'secondary'}
              disabled={action.disabled}
              title={action.title}
              onClick={action.onSelect}
              {...(action.primary === true ? PRIMARY_MARK : {})}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </ModalScrim>
  );
}
