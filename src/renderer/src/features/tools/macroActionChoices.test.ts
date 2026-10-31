import {expect, it, vi} from 'vitest';
import type {MacroActionKind} from '@core/schema/macros';
import {menuItems} from '@renderer/ui/menuModel';
import {macroActionChoices} from './macroActionChoices';
import {
  prepareMacroAction,
  type MacroActionDraft,
} from '@core/macros/macroActionDraft';

const id = '00000000-0000-4000-8000-000000000001';

function actionFrom(draft: MacroActionDraft | undefined) {
  if (!draft) throw new Error('Missing action choice');
  return prepareMacroAction(draft);
}

it.each<MacroActionKind>(['look', 'notice', 'media', 'audioPlaylist', 'macro'])(
  'builds a validated %s action from its target',
  kind => {
    const choose = vi.fn((draft: MacroActionDraft) =>
      prepareMacroAction(draft),
    );
    const [row] = menuItems(
      macroActionChoices({kind, targets: [{id, name: '대상'}], choose}),
    );
    row?.onSelect?.();
    expect(choose).toHaveBeenCalledOnce();
    expect(actionFrom(choose.mock.calls[0]?.[0])?.kind).toBe(kind);
  },
);

it.each(['prop', 'timer'] as const)(
  'lists %s operations and marks the current target and operation',
  kind => {
    const choose = vi.fn((draft: MacroActionDraft) =>
      prepareMacroAction(draft),
    );
    const current = prepareMacroAction({
      kind,
      target: id,
      operation: kind === 'prop' ? 'off' : 'pause',
    });
    if (!current) throw new Error('Invalid action fixture');
    const [row] = menuItems(
      macroActionChoices({
        kind,
        targets: [{id, name: '대상'}],
        current,
        choose,
      }),
    );
    expect(row?.checked).toBe(true);
    const choices = menuItems(row?.loadSubmenu?.() ?? row?.submenu ?? []);
    expect(choices.map(choice => choice.label)).toEqual(
      kind === 'prop'
        ? ['켜기', '끄기', '바꾸기']
        : ['시작', '일시 정지', '처음으로'],
    );
    expect(choices.map(choice => choice.checked)).toEqual([false, true, false]);
    choices[2]?.onSelect?.();
    expect(actionFrom(choose.mock.calls[0]?.[0])).toEqual(
      kind === 'prop'
        ? {kind, prop: id, mode: 'toggle'}
        : {kind, timer: id, operation: 'reset'},
    );
  },
);

it('lists audio tracks before fade out and stop and switches back to play', () => {
  const choose = vi.fn((draft: MacroActionDraft) => prepareMacroAction(draft));
  const rows = macroActionChoices({
    kind: 'audio',
    targets: [{id, name: '음악'}],
    current: {kind: 'audio', operation: 'stop'},
    choose,
  });
  expect(rows.map(row => (row.kind === 'separator' ? '|' : row.label))).toEqual(
    ['음악', '|', '페이드 아웃', '멈춤'],
  );
  const choices = menuItems(rows);
  expect(choices.map(row => row.checked)).toEqual([false, false, true]);
  choices[0]?.onSelect?.();
  expect(actionFrom(choose.mock.calls[0]?.[0])).toEqual({
    kind: 'audio',
    media: id,
    operation: 'play',
  });
  expect(
    menuItems(
      macroActionChoices({kind: 'audio', targets: undefined, choose}),
    ).map(row => row.label),
  ).toEqual(['페이드 아웃', '멈춤']);
});

it('distinguishes layers and individual props and keeps the clear transition', () => {
  const choose = vi.fn((draft: MacroActionDraft) => prepareMacroAction(draft));
  const transition = {fade: true, durationMs: 1200};
  const rows = menuItems(
    macroActionChoices({
      kind: 'clearLayer',
      targets: [
        {id: 'prop', name: '그래픽', clearTarget: 'layer'},
        {id, name: '로고', clearTarget: 'prop'},
      ],
      current: {kind: 'clearLayer', layer: 'prop', transition},
      choose,
    }),
  );
  expect(rows.map(row => row.checked)).toEqual([true, false]);
  rows[1]?.onSelect?.();
  expect(actionFrom(choose.mock.calls[0]?.[0])).toEqual({
    kind: 'clearLayer',
    prop: id,
    transition,
  });
});
