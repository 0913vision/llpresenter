import {timerCommandLabels} from '@renderer/ui/timerCommandLabels';
import type {MacroActionKind, KnownMacroAction} from '@core/schema/macros';
import type {MenuEntry, MenuItem} from '@renderer/ui/menuModel';
import {menuSeparator} from '@renderer/ui/menuRows';
import {
  draftMacroAction,
  type MacroActionDraft,
} from '@core/macros/macroActionDraft';
import type {MacroTargetChoice} from './macroTargets';

const operations = {
  prop: [
    {value: 'on', label: '켜기'},
    {value: 'off', label: '끄기'},
    {value: 'toggle', label: '바꾸기'},
  ],
  timer: [
    {value: 'start', label: timerCommandLabels.start},
    {value: 'pause', label: timerCommandLabels.pause},
    {value: 'reset', label: timerCommandLabels.reset},
  ],
} as const;

interface ActionChoicesInput {
  readonly kind: MacroActionKind;
  readonly targets: readonly MacroTargetChoice[] | undefined;
  readonly current?: KnownMacroAction | undefined;
  readonly choose: (draft: MacroActionDraft) => void;
}

/** Target and operation choices shared by Add Action and Edit Action. */
export function macroActionChoices({
  kind,
  targets,
  current,
  choose,
}: ActionChoicesInput): readonly MenuEntry[] {
  const initial = current && draftMacroAction(current);
  const choice = (label: string, draft: MacroActionDraft): MenuItem => ({
    kind: 'item',
    id: `${draft.target ?? draft.kind}:${draft.operation ?? ''}`,
    label,
    check: current ? 'radio' : undefined,
    checked:
      initial !== undefined &&
      initial.target === draft.target &&
      initial.operation === draft.operation &&
      initial.clearTarget === draft.clearTarget,
    onSelect: () => choose({...initial, ...draft}),
  });
  if (kind === 'clearAll') return [choice('모두 지우기', {kind})];
  const rows = (targets ?? []).map((target): MenuItem => {
    const draft = {
      kind,
      target: target.id,
      clearTarget: target.clearTarget,
      ...(kind === 'audio' ? {operation: 'play'} : {}),
    };
    const row = choice(
      `${target.name}${kind === 'message' || kind === 'stageLayout' ? '…' : ''}`,
      draft,
    );
    if (kind !== 'prop' && kind !== 'timer') return row;
    return {
      ...row,
      check: undefined,
      checked: initial?.target === target.id,
      onSelect: undefined,
      loadSubmenu: () =>
        operations[kind].map(operation =>
          choice(operation.label, {...draft, operation: operation.value}),
        ),
    };
  });
  if (kind === 'audio') {
    return [
      ...rows,
      ...(rows.length > 0 ? [menuSeparator('audio-operations')] : []),
      choice('페이드 아웃', {kind, operation: 'fadeOut'}),
      choice('멈춤', {kind, operation: 'stop'}),
    ];
  }
  return rows;
}
