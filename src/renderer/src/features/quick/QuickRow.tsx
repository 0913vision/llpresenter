import type {JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {displayReference, parseReference} from '@core/bible';
import type {LiveState} from '@core/schema/live';
import {
  isKnownQuickItem,
  type KnownQuickItem,
  type QuickItem,
  type QuickItemKind,
} from '@core/schema/quick';
import {ListActionRow} from '@renderer/ui';
import type {Notice} from '@renderer/ui/popups/notices';
import {TimerValue} from '../tools/timers/TimerValue';
import {quickItemOn, quickItemUnavailable} from './quickActions';
import {QuickRowEditor} from './QuickEditing';
import type {QuickEdit} from './quickEdits';
import type {useQuickTimers} from './useQuickTimers';

const icons: Readonly<Record<QuickItemKind, string>> = {
  song: 'song',
  bible: 'book',
  prop: 'prop',
  timer: 'timer',
  macro: 'macro',
};

/**
 * The name a row shows: a passage named by its own reference shows it the
 * way passages are written, such as 요한복음 3:16.
 */
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

/** What every row of the 빠른 실행 list shares. */
export interface QuickRowContext {
  readonly api: LlpApi;
  readonly live: LiveState | null;
  readonly timers: ReturnType<typeof useQuickTimers>;
  readonly locked: boolean;
  readonly full: boolean;
  readonly timersFull: boolean;
  readonly save: (
    edit: QuickEdit,
    completion?: 'applied' | 'saved',
  ) => Promise<boolean>;
  readonly onProblem: (notice: Notice) => void;
  /** Runs an item the operator pressed. */
  readonly run: (item: KnownQuickItem) => void;
  readonly remove: (item: QuickItem) => void;
  readonly pin: (id: string, active: boolean) => void;
  /** The row a drag would put an item before. */
  readonly insertBefore: string | null | undefined;
  /** The row the Tab key reaches the list at. */
  readonly tabStop: string | null | undefined;
}

/** One item of 빠른 실행: its button, and its menu and editors around it. */
export function QuickRow({
  item,
  context,
}: {
  readonly item: QuickItem;
  readonly context: QuickRowContext;
}): JSX.Element {
  const {api, live, timers} = context;
  const known = isKnownQuickItem(item);
  const reason = quickItemUnavailable(item) ?? timers.reason(item);
  const available = known && reason === undefined;
  const timer =
    known && item.kind === 'timer'
      ? timers.definitions.get(item.ref)
      : undefined;
  const activate = (): void => {
    if (available) context.run(item);
  };
  return (
    <QuickRowEditor
      api={api}
      item={item}
      timer={timer}
      activate={activate}
      activateReason={reason}
      onProblem={context.onProblem}
      locked={context.locked}
      full={context.full}
      timersFull={context.timersFull}
      save={context.save}
      onDelete={() => context.remove(item)}
      onPinChange={context.pin}
      insertBefore={context.insertBefore === item.id}
    >
      <ListActionRow
        tabIndex={item.id === context.tabStop ? 0 : -1}
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
        pressed={known && available ? quickItemOn(item, live) : undefined}
        disabled={!available}
        reason={reason}
        onPress={activate}
      />
    </QuickRowEditor>
  );
}
