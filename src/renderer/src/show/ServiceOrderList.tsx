import {memo, useEffect, useRef, type JSX, type KeyboardEvent} from 'react';
import {Icon} from '@renderer/ui/Icon';
import {moveRow, openItem, useShow} from '@renderer/state/show';
import {useLive} from '@renderer/state/live';
import {isItemRow, type ItemKind, type ServiceRow} from './model';
import type {RowKey} from './navigation';
import styles from './ServiceOrderList.module.css';

const iconByKind: Readonly<Record<ItemKind, string>> = {
  song: 'song',
  bible: 'book',
  media: 'film',
  notice: 'notice',
  slot: 'listplus',
};

const rowKeys: Readonly<Record<string, RowKey>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  Home: 'home',
  End: 'end',
};

function useLiveItemId(): string | null {
  return useLive(view => view.state?.layers.slide?.itemId ?? null);
}

const Row = memo(
  ({
    row,
    selected,
    tabStop,
    live,
  }: {
    readonly row: ServiceRow;
    readonly selected: boolean;
    readonly tabStop: boolean;
    readonly live: boolean;
  }): JSX.Element => {
    if (row.kind === 'header') {
      return <div className={styles.group}>{row.title}</div>;
    }
    return (
      <button
        type="button"
        role="option"
        tabIndex={tabStop ? 0 : -1}
        aria-selected={selected}
        data-state={live ? 'live' : undefined}
        className={styles.row}
        onClick={() => openItem(row.id)}
      >
        <Icon name={iconByKind[row.kind]} size={16} className={styles.icon} />
        <span className={styles.title}>{row.title}</span>
        {live ? <span className={styles.badge}>LIVE</span> : null}
      </button>
    );
  },
);

/** The 예배 순서 list of the 진행 workspace. */
export function ServiceOrderList(): JSX.Element {
  const rows = useShow(view => view.rows);
  const openItemId = useShow(view => view.openItemId);
  const liveItemId = useLiveItemId();
  const listRef = useRef<HTMLDivElement>(null);
  const tabStopId = openItemId ?? rows.find(isItemRow)?.id ?? null;

  useEffect(() => {
    const list = listRef.current;
    if (!list?.contains(document.activeElement)) return;
    list.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [openItemId]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const key = rowKeys[event.key];
    if (key === undefined) return;
    event.preventDefault();
    moveRow(key);
  };

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="예배 순서"
      data-service-list=""
      className={styles.list}
      onKeyDown={onKeyDown}
    >
      {rows.map(row => (
        <Row
          key={row.id}
          row={row}
          selected={row.id === openItemId}
          tabStop={row.id === tabStopId}
          live={row.id === liveItemId}
        />
      ))}
    </div>
  );
}
