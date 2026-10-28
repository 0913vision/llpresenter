import {memo, useCallback, type JSX} from 'react';
import {Icon, IconButton, TruncatedText, useTooltip} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import type {NamedDocument} from '@renderer/screens/useSettingsDocument';
import {
  executeDismiss,
  useShowingGroups,
  type DismissDescriptor,
  type ShowingItem,
} from './showingRows';
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

interface ShowingRowProps {
  readonly item: ShowingItem;
  readonly onDismiss: (descriptor: DismissDescriptor) => void;
}

const ShowingRow = memo(({item, onDismiss}: ShowingRowProps): JSX.Element => {
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
});

export interface ShowingTabProps {
  readonly screensDoc?: NamedDocument<'screens'> | null | undefined;
  readonly looksDoc?: NamedDocument<'looks'> | null | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly externalNow?: number | undefined;
}

/** The 표시 중 tab of 진행 도구, grouping live items by screen. */
export function ShowingTab({
  screensDoc,
  looksDoc,
  onProblem,
  externalNow,
}: ShowingTabProps = {}): JSX.Element {
  const {groups} = useShowingGroups({
    screensDoc,
    looksDoc,
    onProblem,
    externalNow,
  });

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
