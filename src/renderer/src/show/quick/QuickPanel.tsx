import {useEffect, useMemo, useState, type JSX} from 'react';
import {
  isKnownQuickItem,
  type QuickItem,
  type QuickItemKind,
} from '@core/schema/quick';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useLive} from '@renderer/platform/live';
import {useShow} from '@renderer/state/show';
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
import {QuickAdd, QuickRowEditor} from './QuickEditing';
import {MAX_QUICK_ITEMS} from './quickEdits';
import {useQuickEditing} from './useQuickEditing';
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
  black: 'monitor',
};
const EMPTY_ITEMS: readonly QuickItem[] = [];

export function QuickPanel({
  selectionVersion,
  onProblem,
}: {
  readonly selectionVersion: number;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element | null {
  const api = window.llp;
  const document = useSettingsDocument('quick', '퀵 실행', onProblem);
  const timers = useQuickTimers(api, document, onProblem);
  const editing = useQuickEditing(api, onProblem);
  const locked = document?.access !== 'editable' || editing.busy;
  const full = (document?.value.items.length ?? 0) >= MAX_QUICK_ITEMS;
  const items = document?.value.items ?? EMPTY_ITEMS;
  const ids = useMemo(() => items.map(item => item.id), [items]);
  const windowed = useQuickWindow(items);
  const drag = useQuickDrag({
    enabled: !locked,
    revision: document?.revision ?? null,
    ids,
    listRef: windowed.list,
    onMove: (id, before) => {
      const source = document?.value.items.find(item => item.id === id);
      const target = document?.value.items.find(item => item.id === before);
      if (!source || (before !== null && !target)) return;
      editing
        .run({kind: 'move', id: source.id, before: target?.id ?? null})
        .catch((cause: unknown) =>
          console.error('Quick reorder callback failed:', cause),
        );
    },
  });
  const live = useLive(view => view.state);
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
  if (api === undefined) return null;
  return (
    <Panel label="퀵 실행" className={styles.panel}>
      <PanelHeader>
        <PanelTitle title="퀵 실행" />
        <PanelActions>
          <QuickAdd
            api={api}
            locked={locked || full}
            save={editing.run}
            onProblem={onProblem}
          />
        </PanelActions>
      </PanelHeader>
      <PanelTools>
        <BibleQuickField
          api={api}
          selectionVersion={selectionVersion + activationVersion}
          onIntent={() => runner?.cancel()}
        />
      </PanelTools>
      <PanelBody variant="flush">
        <div
          {...drag.listProps}
          role="group"
          aria-label="퀵 실행 항목"
          className={styles.list}
          style={{height: items.length * windowed.rowHeight}}
          onKeyDown={windowed.onKeyDown}
          onFocusCapture={windowed.onFocusCapture}
          onBlurCapture={windowed.onBlurCapture}
        >
          {windowed.shown.map(({item, index}) => {
            const known = isKnownQuickItem(item);
            const reason = quickItemUnavailable(item) ?? timers.reason(item);
            const available = known && reason === undefined;
            const timer =
              known && item.kind === 'timer'
                ? timers.definitions.get(item.ref)
                : undefined;
            return (
              <div
                key={item.id}
                className={styles.slot}
                style={{top: index * windowed.rowHeight}}
              >
                <QuickRowEditor
                  item={item}
                  locked={locked}
                  save={editing.run}
                  onPinChange={windowed.pin}
                  insertBefore={drag.before === item.id}
                >
                  <ListActionRow
                    title={item.name}
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
                    onPress={() => {
                      if (available) {
                        setActivationVersion(value => value + 1);
                        runner
                          ?.run(item)
                          .catch((cause: unknown) =>
                            console.error('Quick item callback failed:', cause),
                          );
                      }
                    }}
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
