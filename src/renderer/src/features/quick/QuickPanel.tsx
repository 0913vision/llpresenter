import {displayReference, parseReference} from '@core/bible';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useReflow} from '@renderer/ui/useReflow';
import {deleteSelection} from '@renderer/ui/deleteSelection';
import {
  NOTHING_TO_UNDO,
  NOTHING_TO_REDO,
} from '@renderer/platform/problemReasons';
import {useEffect, useMemo, useState, type JSX} from 'react';
import {
  isKnownQuickItem,
  type QuickItem,
  type QuickItemKind,
} from '@core/schema/quick';
import {
  useSettingsDocument,
  type NamedDocument,
} from '@renderer/platform/useSettingsDocument';
import {useLive} from '@renderer/session/live';
import {useShow} from '@renderer/session/show';
import {bibleSourceFor} from '@renderer/session/showLibrary';
import {ListActionRow, ListInsertLine} from '@renderer/ui';
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  PanelTools,
  PanelActions,
} from '@renderer/ui/Panel';
import type {Notice} from '@renderer/ui/notices';
import {BibleQuickField} from './BibleQuickField';
import {quickItemOn, quickItemUnavailable, quickRunner} from './quickActions';
import styles from './QuickPanel.module.css';
import {
  duplicateQuickItem,
  QuickAdd,
  quickCopyReason,
  QuickRowEditor,
} from './QuickEditing';
import {useDuplicateShortcut} from '../tools/useDuplicateShortcut';
import {MAX_TIMER_DEFINITIONS} from '@core/schema/timers';
import {MAX_QUICK_ITEMS, type QuickEdit} from './quickEdits';
import {useQuickEditing} from './useQuickEditing';
import {useRowMoveKeys} from '@renderer/ui/reorder';
import {useQuickDrag} from './useQuickDrag';
import {useQuickTimers} from './useQuickTimers';
import {useQuickWindow} from './useQuickWindow';
import {TimerValue} from '../tools/TimerValue';

const icons: Readonly<Record<QuickItemKind, string>> = {
  song: 'song',
  bible: 'book',
  prop: 'prop',
  timer: 'timer',
  macro: 'macro',
};
const EMPTY_ITEMS: readonly QuickItem[] = [];

function quickLabel(item: QuickItem): string {
  if (!isKnownQuickItem(item) || item.kind !== 'bible') return item.name;
  const name = parseReference(item.name);
  const reference = parseReference(item.ref.ref);
  if (!name.ok || !reference.ok) return item.name;
  const a = name.value;
  const b = reference.value;
  return a.book.id === b.book.id &&
    a.chapter === b.chapter &&
    a.verse === b.verse &&
    a.endChapter === b.endChapter &&
    a.endVerse === b.endVerse
    ? displayReference(item.name)
    : item.name;
}

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
  const [history, setHistory] = useState<{
    undo: Array<{item: QuickItem; before: QuickItem['id'] | null}>;
    redo: Array<{item: QuickItem; before: QuickItem['id'] | null}>;
  }>({undo: [], redo: []});
  const locked = document?.access !== 'editable' || editing.busy;
  const full = (document?.value.items.length ?? 0) >= MAX_QUICK_ITEMS;
  const items = document?.value.items ?? EMPTY_ITEMS;
  const runNewEdit = async (
    edit: QuickEdit,
    completion?: 'applied' | 'saved',
  ): Promise<boolean> => {
    const saved = await editing.run(edit, completion);
    if (saved) setHistory(old => ({...old, redo: []}));
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
  const windowed = useQuickWindow(items);
  useReflow(windowed.list, {
    ids,
    selector: '[data-quick-id]',
    attribute: 'data-quick-id',
    scope: 'quick',
  });
  const removeItem = (item: QuickItem): void => {
    const index = items.findIndex(value => value.id === item.id);
    deleteSelection(
      1,
      () => !locked && index >= 0,
      () => {
        const before = items[index + 1]?.id ?? null;
        const list = windowed.list.current;
        if (list) {
          list.tabIndex = -1;
          list.focus({preventScroll: true});
          list.removeAttribute('tabindex');
        }
        editing
          .run({kind: 'delete', id: item.id})
          .then(saved => {
            if (saved) {
              setHistory(old => ({
                undo: [...old.undo, {item, before}],
                redo: [],
              }));
            }
          })
          .catch((cause: unknown) =>
            console.error('Quick delete callback failed:', cause),
          );
      },
    );
  };
  const historyCommand = (kind: 'undo' | 'redo'): void => {
    const step = (kind === 'undo' ? history.undo : history.redo).at(-1);
    if (!step || locked) return;
    const edit: QuickEdit =
      kind === 'undo'
        ? {kind: 'restore', item: step.item, before: step.before}
        : {kind: 'delete', id: step.item.id};
    editing
      .run(edit)
      .then(saved => {
        if (saved) {
          setHistory(old =>
            kind === 'undo'
              ? {undo: old.undo.slice(0, -1), redo: [...old.redo, step]}
              : {undo: [...old.undo, step], redo: old.redo.slice(0, -1)},
          );
        }
      })
      .catch((cause: unknown) =>
        console.error('Quick history callback failed:', cause),
      );
  };
  useWindowShortcuts(
    (['undo', 'redo'] satisfies Array<'undo' | 'redo'>).map(kind => ({
      id: `edit.${kind}`,
      when: (event: KeyboardEvent) =>
        event.target instanceof Node &&
        windowed.list.current?.contains(event.target) === true,
      unavailable: () =>
        !locked &&
        (kind === 'undo' ? history.undo.length > 0 : history.redo.length > 0)
          ? undefined
          : kind === 'undo'
            ? NOTHING_TO_UNDO
            : NOTHING_TO_REDO,
      run: () => historyCommand(kind),
    })),
  );
  const moveItem = (id: string, before: string | null): void => {
    const source = document?.value.items.find(item => item.id === id);
    const target = document?.value.items.find(item => item.id === before);
    if (!source || (before !== null && !target)) return;
    runNewEdit({kind: 'move', id: source.id, before: target?.id ?? null}).catch(
      (cause: unknown) =>
        console.error('Quick reorder callback failed:', cause),
    );
  };
  const drag = useQuickDrag({
    enabled: !locked,
    revision: document?.revision ?? null,
    ids,
    listRef: windowed.list,
    onMove: moveItem,
  });
  useRowMoveKeys({
    owns: event =>
      event.target instanceof Node &&
      windowed.list.current?.contains(event.target) === true,
    rowId: target =>
      target instanceof Element
        ? (target.closest<HTMLElement>('[data-quick-id]')?.dataset['quickId'] ??
          null)
        : null,
    ids,
    enabled: !locked,
    onMove: moveItem,
  });
  const live = useLive(view => view.state);
  const livePassage = useShow(view => {
    const source = bibleSourceFor(view, live?.layers.slide?.itemId ?? null);
    return source?.review === false ? source.passage.displayRef : null;
  });
  const [activationVersion, setActivationVersion] = useState(0);
  const runner = useMemo(
    () => (api ? quickRunner(api, onProblem) : null),
    [api, onProblem],
  );
  useEffect(() => () => runner?.cancel(), [runner, selectionVersion, document]);
  useEffect(
    () =>
      useShow.subscribe((next, previous) => {
        if (
          next.openItemId !== previous.openItemId ||
          next.selectedTile !== previous.selectedTile
        ) {
          runner?.cancel();
        }
      }),
    [runner],
  );
  useWindowShortcuts(
    items.filter(isKnownQuickItem).map(item => ({
      id: `quick.${item.id}`,
      when: () =>
        quickItemUnavailable(item) === undefined &&
        timers.reason(item) === undefined,
      run: () => {
        runner?.run(item).catch((error: unknown) =>
          api?.log.write({
            level: 'error',
            message: 'Could not run quick shortcut',
            detail: String(error),
          }),
        );
      },
    })),
  );
  if (api === undefined) return null;
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
          {windowed.shown.map(({item, index}) => {
            const known = isKnownQuickItem(item);
            const reason = quickItemUnavailable(item) ?? timers.reason(item);
            const available = known && reason === undefined;
            const timer =
              known && item.kind === 'timer'
                ? timers.definitions.get(item.ref)
                : undefined;
            const activate = (): void => {
              if (available) {
                setActivationVersion(value => value + 1);
                runner
                  ?.run(item)
                  .catch((cause: unknown) =>
                    console.error('Quick item callback failed:', cause),
                  );
              }
            };
            return (
              <div
                key={item.id}
                className={styles.slot}
                style={{top: index * windowed.rowHeight}}
              >
                <QuickRowEditor
                  api={api}
                  item={item}
                  timer={timer}
                  activate={activate}
                  activateReason={reason}
                  onProblem={onProblem}
                  locked={locked}
                  full={full}
                  timersFull={timersFull}
                  save={runNewEdit}
                  onDelete={() => removeItem(item)}
                  onPinChange={windowed.pin}
                  insertBefore={drag.before === item.id}
                >
                  <ListActionRow
                    tabIndex={item.id === windowed.tabStop ? 0 : -1}
                    title={quickLabel(item)}
                    meta={
                      timer ? (
                        <TimerValue
                          api={api}
                          timer={timer}
                          run={available ? live?.timers?.[timer.id] : undefined}
                        />
                      ) : undefined
                    }
                    icon={known ? icons[item.kind] : 'warning'}
                    pressed={
                      known && available ? quickItemOn(item, live) : undefined
                    }
                    disabled={!available}
                    reason={reason}
                    onPress={activate}
                  />
                </QuickRowEditor>
              </div>
            );
          })}
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
