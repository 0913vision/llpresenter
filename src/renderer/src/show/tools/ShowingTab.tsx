import type {JSX} from 'react';
import {Icon, IconButton, TruncatedText, useTooltip} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {useShowingGroups, type ShowingGroup} from './showingRows';
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

/** The 표시 중 tab of 진행 도구, grouping live items by screen. */
export function ShowingTab({
  groups: externalGroups,
  onProblem,
}: {
  readonly groups?: readonly ShowingGroup[] | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const {groups: hookGroups} = useShowingGroups(onProblem);
  const groups = externalGroups ?? hookGroups;

  return (
    <div className={styles.root}>
      {groups.map(group => (
        <div key={group.screenId} className={styles.group}>
          <p className={styles.groupHeader}>{group.screenName}</p>
          {group.items.map(item => (
            <div key={item.id} className={styles.row}>
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
              {item.canDismiss ? (
                <IconButton
                  icon="x"
                  size="sm"
                  label="내리기"
                  onClick={item.onDismiss}
                />
              ) : (
                <span className={styles.buttonPlaceholder} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
