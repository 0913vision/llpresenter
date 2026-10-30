import {memo, useCallback, type JSX} from 'react';
import {Icon, IconButton, TruncatedText, useTooltip} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {executeDismiss} from './showingDismiss';
import {useShowingGroups} from './showingHooks';
import type {DismissDescriptor, ShowingItem} from './showingTypes';
import styles from './ShowingTab.module.css';

function BackgroundStillIcon({
  tooltipText,
}: {
  readonly tooltipText: string;
}): JSX.Element {
  const {targetProps, tooltip} = useTooltip({text: tooltipText});
  return (
    <>
      <span
        {...targetProps}
        role="img"
        aria-label={tooltipText}
        className={styles.stillIcon}
      >
        <Icon name="pause" size={16} />
      </span>
      {tooltip}
    </>
  );
}

export interface ShowingRowProps {
  readonly item: ShowingItem;
  readonly onDismiss: (descriptor: DismissDescriptor) => void;
}

export function areShowingRowPropsEqual(
  prevProps: ShowingRowProps,
  nextProps: ShowingRowProps,
): boolean {
  if (prevProps.onDismiss !== nextProps.onDismiss) return false;
  const prev = prevProps.item;
  const next = nextProps.item;
  if (prev === next) return true;
  if (prev.id !== next.id) return false;
  if (prev.kind !== next.kind) return false;
  if (prev.kindLabel !== next.kindLabel) return false;
  if (prev.icon !== next.icon) return false;
  if (prev.iconTooltip !== next.iconTooltip) return false;
  if (prev.title !== next.title) return false;
  if (prev.time !== next.time) return false;

  const prevDismiss = prev.dismiss;
  const nextDismiss = next.dismiss;
  if (prevDismiss === nextDismiss) return true;
  if (prevDismiss === undefined || nextDismiss === undefined) return false;
  if (prevDismiss.kind !== nextDismiss.kind) return false;
  if (prevDismiss.kind === 'message' && nextDismiss.kind === 'message') {
    return prevDismiss.messageId === nextDismiss.messageId;
  }
  if (prevDismiss.kind === 'prop' && nextDismiss.kind === 'prop') {
    return prevDismiss.propId === nextDismiss.propId;
  }
  return true;
}

export const ShowingRow = memo(
  ({item, onDismiss}: ShowingRowProps): JSX.Element => {
    const handleClick = useCallback(() => {
      if (item.dismiss !== undefined) {
        onDismiss(item.dismiss);
      }
    }, [item.dismiss, onDismiss]);

    return (
      <div className={styles.row}>
        <span className={styles.iconCell}>
          {item.iconTooltip !== undefined ? (
            <BackgroundStillIcon tooltipText={item.iconTooltip} />
          ) : (
            <Icon name={item.icon} size={16} />
          )}
        </span>
        <span className={styles.kind}>{item.kindLabel}</span>
        <span className={styles.title}>
          <TruncatedText text={item.title} />
        </span>
        {item.time !== undefined ? (
          <span className={styles.time}>{item.time}</span>
        ) : null}
        {item.dismiss !== undefined ? (
          <IconButton icon="x" size="sm" label="내리기" onClick={handleClick} />
        ) : (
          <span className={styles.buttonPlaceholder} />
        )}
      </div>
    );
  },
  areShowingRowPropsEqual,
);

export interface ShowingTabProps {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}

/** The 표시 중 tab of 진행 도구, grouping live items by screen. */
export function ShowingTab({onProblem}: ShowingTabProps = {}): JSX.Element {
  const {groups} = useShowingGroups(onProblem);

  const handleDismiss = useCallback((descriptor: DismissDescriptor) => {
    executeDismiss(descriptor);
  }, []);

  return (
    <div className={styles.root}>
      {groups.map(group => (
        <div key={group.screenId} className={styles.group}>
          <p className={styles.groupHeader}>{group.screenName}</p>
          {group.items.map(item => (
            <ShowingRow key={item.id} item={item} onDismiss={handleDismiss} />
          ))}
        </div>
      ))}
    </div>
  );
}
