import {useReflow} from '@renderer/ui/panels/useReflow';
import {useMemo, useState, type JSX} from 'react';
import type {QuickItem} from '@core/schema/tools/quick';
import {
  useSettingsDocument,
  type NamedDocument,
} from '@renderer/platform/documents/useSettingsDocument';
import {useLive} from '@renderer/session/live';
import {useShow} from '@renderer/session/show/show';
import {bibleSourceFor} from '@renderer/session/show/showLibrary';
import {ListInsertLine} from '@renderer/ui';
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  PanelTools,
  PanelActions,
} from '@renderer/ui/panels/Panel';
import type {Notice} from '@renderer/ui/popups/notices';
import {BibleQuickField} from './BibleQuickField';
import {useQuickRunner} from './useQuickRunner';
import styles from './QuickPanel.module.css';
import {duplicateQuickItem, QuickAdd, quickCopyReason} from './QuickEditing';
import {QuickRow, type QuickRowContext} from './QuickRow';
import {useDuplicateShortcut} from '../tools/useDuplicateShortcut';
import {MAX_TIMER_DEFINITIONS} from '@core/schema/tools/timers';
import {MAX_QUICK_ITEMS, type QuickEdit} from './quickEdits';
import {useQuickEditing} from './useQuickEditing';
import {useQuickReorder} from './useQuickReorder';
import {useQuickTimers} from './useQuickTimers';
import {useQuickHistory} from './useQuickHistory';
import {useQuickWindow} from './useQuickWindow';

const EMPTY_ITEMS: readonly QuickItem[] = [];

export function QuickPanel({
  selectionVersion,
  onProblem,
  initialDocument,
}: {
  readonly selectionVersion: number;
  readonly onProblem: (notice: Notice) => void;
  readonly initialDocument?: NamedDocument<'quick'> | null | undefined;
}): JSX.Element | null {
  const api = window.llp;
  const loaded = useSettingsDocument(
    initialDocument === undefined ? 'quick' : null,
    '빠른 실행',
    onProblem,
  );
  const document = initialDocument === undefined ? loaded : initialDocument;
  const timers = useQuickTimers(document, onProblem);
  const editing = useQuickEditing(api, onProblem);
  const locked = document?.access !== 'editable' || editing.busy;
  const full = (document?.value.items.length ?? 0) >= MAX_QUICK_ITEMS;
  const items = document?.value.items ?? EMPTY_ITEMS;
  const windowed = useQuickWindow(items);
  const history = useQuickHistory({
    items,
    locked,
    run: edit => editing.run(edit),
    list: windowed.list,
  });
  const runNewEdit = async (
    edit: QuickEdit,
    completion?: 'applied' | 'saved',
  ): Promise<boolean> => {
    const saved = await editing.run(edit, completion);
    if (saved) history.clearRedo();
    return saved;
  };
  const timersFull = timers.definitions.size >= MAX_TIMER_DEFINITIONS;
  const rowAt = (event: KeyboardEvent): QuickItem | undefined => {
    const id =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-quick-id]')?.dataset[
            'quickId'
          ]
        : undefined;
    return items.find(item => item.id === id);
  };
  useDuplicateShortcut({
    itemAt: rowAt,
    reasonOf: item => quickCopyReason(item, {locked, full, timersFull}),
    run: item => duplicateQuickItem(item, runNewEdit),
  });
  const ids = useMemo(() => items.map(item => item.id), [items]);
  useReflow(windowed.list, {
    ids,
    selector: '[data-quick-id]',
    attribute: 'data-quick-id',
    scope: 'quick',
  });
  const drag = useQuickReorder({
    list: windowed.list,
    items,
    ids,
    revision: document?.revision ?? null,
    locked,
    save: runNewEdit,
  });
  const live = useLive(view => view.state);
  const livePassage = useShow(view => {
    const source = bibleSourceFor(view, live?.layers.slide?.itemId ?? null);
    return source?.review === false ? source.passage.displayRef : null;
  });
  const [activationVersion, setActivationVersion] = useState(0);
  const runner = useQuickRunner({
    api,
    onProblem,
    items,
    timerReason: timers.reason,
    selectionVersion,
    document,
  });
  if (api === undefined) return null;
  const rowContext: QuickRowContext = {
    api,
    live,
    timers,
    locked,
    full,
    timersFull,
    save: runNewEdit,
    onProblem,
    run: item => {
      setActivationVersion(value => value + 1);
      runner
        ?.run(item)
        .catch((cause: unknown) =>
          console.error('Quick item callback failed:', cause),
        );
    },
    remove: item => history.remove(item),
    pin: windowed.pin,
    insertBefore: drag.before,
    tabStop: windowed.tabStop,
  };
  return (
    <Panel label="빠른 실행" className={styles.panel}>
      <PanelHeader>
        <PanelTitle title="빠른 실행" />
        <PanelActions>
          <QuickAdd
            api={api}
            locked={locked || full}
            save={runNewEdit}
            onProblem={onProblem}
          />
        </PanelActions>
      </PanelHeader>
      <PanelTools>
        <div className={styles.bibleField}>
          <BibleQuickField
            api={api}
            selectionVersion={selectionVersion + activationVersion}
            onIntent={() => runner?.cancel()}
          />
        </div>
      </PanelTools>
      <PanelBody variant="flush">
        <div
          className={styles.livePassage}
          role={livePassage === null ? undefined : 'status'}
        >
          {livePassage}
        </div>
        <div
          {...drag.listProps}
          role="group"
          aria-label="빠른 실행 항목"
          className={styles.list}
          style={{height: items.length * windowed.rowHeight}}
          onKeyDown={windowed.onKeyDown}
          onFocusCapture={windowed.onFocusCapture}
        >
          {windowed.shown.map(({item, index}) => (
            <div
              key={item.id}
              className={styles.slot}
              style={{top: index * windowed.rowHeight}}
            >
              <QuickRow item={item} context={rowContext} />
            </div>
          ))}
          {drag.before === null ? (
            <div
              className={styles.slot}
              style={{top: items.length * windowed.rowHeight}}
            >
              <ListInsertLine />
            </div>
          ) : null}
        </div>
      </PanelBody>
    </Panel>
  );
}
