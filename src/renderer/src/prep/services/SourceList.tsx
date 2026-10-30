import {useMemo, type JSX, type ReactNode} from 'react';
import type {ServiceEntry, TemplateEntry} from '@core/schema/contentDocuments';
import {Button} from '@renderer/ui/Button';
import {ListBox, ListGroup, ListRow} from '@renderer/ui/ListRow';
import {dateLabel} from './serviceDates';
import type {SourceRow} from './useSourceActions';
import {EMPTY_SOURCE, sourceKey, type ServiceSource} from './useServiceSources';
import styles from './ServiceDialogs.module.css';
import {isContextMenuKey, type ContextMenuEvent} from '../contextMenu';

const names = new Intl.Collator('ko', {numeric: true});

function countText(count: number | undefined): readonly string[] {
  return count === undefined ? [] : [`항목 ${count}개`];
}

function newestFirst(
  entries: readonly ServiceEntry[],
): readonly ServiceEntry[] {
  return [...entries].sort(
    (left, right) =>
      right.date.localeCompare(left.date) ||
      names.compare(left.name, right.name),
  );
}

function templateSource(entry: TemplateEntry): SourceRow['source'] {
  return {kind: 'template', id: entry.id};
}

function serviceSource(entry: ServiceEntry): SourceRow['source'] {
  return {kind: 'service', id: entry.id};
}

// NOTE(0913vision): A right click on a row, or the context menu key while it
// has focus, opens the row's menu; without `onRowMenu` the row stays as is.
function withMenu(
  row: SourceRow,
  onRowMenu: ((event: ContextMenuEvent, row: SourceRow) => void) | undefined,
  children: ReactNode,
): ReactNode {
  if (onRowMenu === undefined) return children;
  return (
    <div
      key={sourceKey(row.source)}
      onContextMenu={event => onRowMenu(event, row)}
      onKeyDown={event => {
        if (!isContextMenuKey(event)) return;
        event.preventDefault();
        event.stopPropagation();
        onRowMenu(event, row);
      }}
    >
      {children}
    </div>
  );
}

/**
 * The sources on the left of the service dialogs: 빈 예배 when `withEmpty`,
 * then the 템플릿 and the 지난 예배 groups, newest service first. With `onRetry`,
 * a line under the list says a list couldn't be read and offers 다시 시도;
 * with `onRowMenu`, a right click on a 템플릿 or 예배 순서 row opens its menu.
 */
export function SourceList({
  templates,
  services,
  selected,
  onSelect,
  withEmpty,
  onRetry,
  onRowMenu,
}: {
  readonly templates: readonly TemplateEntry[];
  readonly services: readonly ServiceEntry[];
  readonly selected: ServiceSource | null;
  readonly onSelect: (source: ServiceSource) => void;
  readonly withEmpty: boolean;
  readonly onRetry?: (() => void) | undefined;
  /** Opens the right-click menu of a 템플릿 or 예배 순서 row. */
  readonly onRowMenu?:
    ((event: ContextMenuEvent, row: SourceRow) => void) | undefined;
}): JSX.Element {
  const sorted = useMemo(() => newestFirst(services), [services]);
  const sources = useMemo(
    () =>
      new Map(
        [
          EMPTY_SOURCE,
          ...templates.map(templateSource),
          ...services.map(serviceSource),
        ].map(source => [sourceKey(source), source]),
      ),
    [templates, services],
  );
  return (
    <>
      <ListBox
        label="시작할 예배 순서"
        selected={selected === null ? undefined : sourceKey(selected)}
        onSelect={value => {
          const source = sources.get(value);
          if (source !== undefined) onSelect(source);
        }}
        inset
      >
        {withEmpty ? (
          <ListRow
            value={sourceKey(EMPTY_SOURCE)}
            icon="plus"
            title="빈 예배"
          />
        ) : null}
        {templates.length === 0 ? null : (
          <ListGroup label="템플릿">
            {templates.map(entry =>
              withMenu(
                {
                  source: templateSource(entry),
                  name: entry.name,
                  access: entry.access,
                },
                onRowMenu,
                <ListRow
                  key={entry.id}
                  value={sourceKey(templateSource(entry))}
                  icon="frame"
                  title={entry.name}
                  sub={countText(entry.itemCount)}
                />,
              ),
            )}
          </ListGroup>
        )}
        {sorted.length === 0 ? null : (
          <ListGroup label="지난 예배">
            {sorted.map(entry =>
              withMenu(
                {
                  source: serviceSource(entry),
                  name: entry.name,
                  access: entry.access,
                },
                onRowMenu,
                <ListRow
                  key={entry.id}
                  value={sourceKey(serviceSource(entry))}
                  icon="cal"
                  title={entry.name}
                  sub={[
                    dateLabel(entry.date.slice(0, 10)),
                    ...countText(entry.itemCount),
                  ]}
                />,
              ),
            )}
          </ListGroup>
        )}
      </ListBox>
      {onRetry === undefined ? null : (
        <div className={styles.retry}>
          <span>목록을 다 읽지 못했습니다</span>
          <Button variant="ghost" icon="refresh" onClick={onRetry}>
            다시 시도
          </Button>
        </div>
      )}
    </>
  );
}
