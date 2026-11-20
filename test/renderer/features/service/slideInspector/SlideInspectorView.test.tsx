import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {
  SlideInspectorView,
  type InspectorAdapter,
} from '@renderer/features/service/slideInspector/SlideInspectorView';
import {inspectorTransition} from '@renderer/features/service/slideInspector/TransitionSection';

it.each([
  'song',
  'blank',
  'title',
  'bible',
  'sermon',
  'liturgy',
  'ad',
  'standby',
] as const)('uses one preview, selection and history contract for %s', kind => {
  const change = vi.fn();
  const seconds = vi.fn();
  const applyAll = vi.fn();
  const undo = vi.fn();
  const adapter: InspectorAdapter = {
    selectedIds: [`${kind}:first`, `${kind}:second`],
    transition: {
      value: {kind: 'push', sec: 1, dir: 'left'},
      mixed: true,
      disabled: false,
      selectionKey: kind,
      onChange: change,
      onSeconds: seconds,
      onApplyAll: applyAll,
    },
    undo,
  };
  const view = render(
    <SlideInspectorView
      identity={kind}
      preview={<div data-testid="preview">{kind}</div>}
      adapter={adapter}
    />,
  );
  expect(screen.getByTestId('preview').textContent).toBe(kind);
  expect(
    screen
      .getByLabelText('\uC804\uD658 \uC2DC\uAC04')
      .getAttribute('placeholder'),
  ).toBe('\uD63C\uD569');
  expect(
    screen
      .getByRole<HTMLButtonElement>('button', {
        name: '\uC804\uCCB4 \uC2AC\uB77C\uC774\uB4DC\uC5D0 \uC801\uC6A9',
      })
      .getAttribute('aria-disabled'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '\uB514\uC878\uBE0C'}));
  expect(change).toHaveBeenCalledWith({kind: 'dissolve', sec: 1});
  view.rerender(
    <SlideInspectorView
      identity={kind}
      preview={<div data-testid="preview">{kind}</div>}
      adapter={{
        ...adapter,
        transition: {
          ...adapter.transition,
          value: {kind: 'push', sec: 1, dir: 'left'},
          mixed: false,
          disabled: false,
          selectionKey: kind,
          onChange: change,
          onSeconds: seconds,
          onApplyAll: applyAll,
        },
      }}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: '\uC804\uCCB4 \uC2AC\uB77C\uC774\uB4DC\uC5D0 \uC801\uC6A9',
    }),
  );
  expect(applyAll).toHaveBeenCalledOnce();
  fireEvent.keyDown(screen.getByTestId('preview'), {key: 'z', ctrlKey: true});
  expect(undo).toHaveBeenCalledWith('undo');
  fireEvent.keyDown(screen.getByTestId('preview'), {
    key: 'z',
    ctrlKey: true,
    shiftKey: true,
  });
  expect(undo).toHaveBeenLastCalledWith('redo');
  view.unmount();
});

it('keeps media preview without offering an unsupported transition', () => {
  const view = render(
    <SlideInspectorView
      identity="media"
      preview={<div data-testid="media-preview" />}
      adapter={{selectedIds: ['media:one']}}
    />,
  );
  expect(screen.getByTestId('media-preview')).toBeTruthy();
  expect(screen.queryByRole('group', {name: '\uD6A8\uACFC'})).toBeNull();
  view.unmount();
});

it('does not replay history while editing is locked or composing', () => {
  const undo = vi.fn();
  const view = render(
    <SlideInspectorView
      identity="locked"
      preview={<div data-testid="preview" />}
      adapter={{selectedIds: ['one'], undo, undoDisabled: true}}
    />,
  );
  fireEvent.keyDown(screen.getByTestId('preview'), {key: 'z', ctrlKey: true});
  expect(undo).not.toHaveBeenCalled();
  view.rerender(
    <SlideInspectorView
      identity="locked"
      preview={<div data-testid="preview" />}
      adapter={{selectedIds: ['one'], undo}}
    />,
  );
  fireEvent.keyDown(screen.getByTestId('preview'), {
    key: 'Process',
    ctrlKey: true,
    isComposing: true,
  });
  expect(undo).not.toHaveBeenCalled();
  view.unmount();
});

it('summarizes unset and mixed transitions identically for every adapter', () => {
  expect(inspectorTransition([undefined, {kind: 'none', sec: 0.5}])).toEqual({
    value: {kind: 'none', sec: 0.5},
    mixed: false,
  });
  expect(
    inspectorTransition([
      {kind: 'push', dir: 'left', sec: 1},
      {kind: 'wipe', dir: 'left', sec: 1},
    ]),
  ).toEqual({value: {kind: 'push', dir: 'left', sec: 1}, mixed: true});
});
