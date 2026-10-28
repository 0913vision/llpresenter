import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {KnownMacroAction, MacroActionKind} from '@shared/schema/macros';
import {MacroActionDialog, type MacroActionChoices} from './MacroActionDialog';

const id = '00000000-0000-4000-8000-000000000001';
const target = {id, name: '대상 가'};
const screens = [{id, name: '본 화면'}];
const kinds: readonly MacroActionKind[] = [
  'look',
  'stageLayout',
  'media',
  'prop',
  'notice',
  'audio',
  'audioPlaylist',
  'timer',
  'macro',
];
const choices: MacroActionChoices = Object.fromEntries(
  kinds.map(kind => [kind, [target]]),
);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each(kinds)('requires a valid target for %s and builds its action', kind => {
  const save = vi.fn<(action: KnownMacroAction) => void>();
  render(
    <MacroActionDialog
      kind={kind}
      choices={choices}
      screens={screens}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  const done = screen.getByRole('button', {name: '완료'});
  expect(done.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '대상'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '대상 가'}));
  fireEvent.click(done);
  expect(save).toHaveBeenCalledOnce();
  expect(save.mock.calls[0]?.[0].kind).toBe(kind);
});

it('supports a clear action and audio stop without a target', () => {
  const save = vi.fn<(action: KnownMacroAction) => void>();
  const view = render(
    <MacroActionDialog
      kind="clearAll"
      choices={{}}
      screens={screens}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  expect(screen.getByText('\ubaa8\ub450 \uc9c0\uc6b0\uae30')).toBeDefined();
  fireEvent.click(screen.getByRole('button', {name: '완료'}));
  expect(save).toHaveBeenCalledWith({kind: 'clearAll'});
  view.rerender(
    <MacroActionDialog
      key="audio"
      kind="audio"
      choices={{}}
      screens={screens}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '동작'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '멈춤'}));
  fireEvent.click(screen.getByRole('button', {name: '완료'}));
  expect(save).toHaveBeenLastCalledWith({kind: 'audio', operation: 'stop'});
});

it('can clear one prop without treating it as a layer', () => {
  const save = vi.fn<(action: KnownMacroAction) => void>();
  render(
    <MacroActionDialog
      kind="clearLayer"
      choices={{clearLayer: [{...target, clearTarget: 'prop'}]}}
      screens={screens}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '대상'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '대상 가'}));
  fireEvent.click(screen.getByRole('button', {name: '완료'}));
  expect(save).toHaveBeenCalledWith({kind: 'clearLayer', prop: id});
});

it('requires message blanks and at least one selected screen', () => {
  const save = vi.fn<(action: KnownMacroAction) => void>();
  render(
    <MacroActionDialog
      kind="message"
      choices={{message: [{...target, blanks: ['이름'], text: '{이름}'}]}}
      screens={screens}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '대상'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '대상 가'}));
  const done = screen.getByRole('button', {name: '완료'});
  expect(done.getAttribute('aria-disabled')).toBe('true');
  fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
    target: {value: '안내'},
  });
  const targets = screen.getByRole('group', {name: '보낼 화면'});
  fireEvent.click(within(targets).getByRole('button', {name: '모든 화면'}));
  expect(done.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(within(targets).getByRole('button', {name: '본 화면'}));
  fireEvent.click(done);
  expect(save).toHaveBeenCalledWith({
    kind: 'message',
    template: id,
    values: {이름: '안내'},
    targets: [id],
    duration: null,
  });
});

it('blocks a removed choice and locks all draft controls during save', () => {
  const save = vi.fn<(action: KnownMacroAction) => void>();
  const view = render(
    <MacroActionDialog
      kind="prop"
      choices={choices}
      screens={screens}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '대상'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '대상 가'}));
  view.rerender(
    <MacroActionDialog
      kind="prop"
      choices={{}}
      screens={screens}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  expect(
    screen.getByRole('button', {name: '완료'}).getAttribute('aria-disabled'),
  ).toBe('true');
  view.rerender(
    <MacroActionDialog
      kind="prop"
      choices={{}}
      screens={screens}
      locked
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  expect(
    screen.getByRole('button', {name: '동작'}).getAttribute('aria-disabled'),
  ).toBe('true');
  expect(
    screen.getByRole('button', {name: '대상'}).getAttribute('aria-disabled'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '완료'}));
  expect(save).not.toHaveBeenCalled();
});

it('blocks a message when no screen remains', () => {
  const save = vi.fn<(action: KnownMacroAction) => void>();
  render(
    <MacroActionDialog
      kind="message"
      choices={{message: [target]}}
      screens={[]}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '대상'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '대상 가'}));
  expect(
    screen.getByRole('button', {name: '완료'}).getAttribute('aria-disabled'),
  ).toBe('true');
});

it('handles prototype-named blanks and rejects oversized expanded messages', () => {
  const save = vi.fn<(action: KnownMacroAction) => void>();
  render(
    <MacroActionDialog
      kind="message"
      choices={{
        message: [
          {
            ...target,
            blanks: ['constructor', '__proto__'],
            text: '{constructor}{constructor}{__proto__}',
          },
        ],
      }}
      screens={screens}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '대상'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '대상 가'}));
  const done = screen.getByRole('button', {name: '완료'});
  expect(done.getAttribute('aria-disabled')).toBe('true');
  fireEvent.change(screen.getByRole('textbox', {name: 'constructor'}), {
    target: {value: 'a'.repeat(2000)},
  });
  fireEvent.change(screen.getByRole('textbox', {name: '__proto__'}), {
    target: {value: 'b'},
  });
  expect(done.getAttribute('aria-disabled')).toBe('true');
  fireEvent.change(screen.getByRole('textbox', {name: 'constructor'}), {
    target: {value: 'a'.repeat(1999)},
  });
  fireEvent.click(done);
  expect(save).toHaveBeenCalledOnce();
});

it.each(['', '  \n\t '])(
  'blocks a message whose expanded text is blank',
  text => {
    const save = vi.fn<(action: KnownMacroAction) => void>();
    render(
      <MacroActionDialog
        kind="message"
        choices={{message: [{...target, text}]}}
        screens={screens}
        locked={false}
        onCancel={() => undefined}
        onSave={save}
      />,
    );
    fireEvent.click(screen.getByRole('button', {name: '\ub300\uc0c1'}));
    fireEvent.click(
      screen.getByRole('menuitemradio', {name: '\ub300\uc0c1 \uac00'}),
    );
    const done = screen.getByRole('button', {name: '\uc644\ub8cc'});
    expect(done.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(done);
    expect(save).not.toHaveBeenCalled();
  },
);

it('preserves an existing clear transition when the dialog saves', () => {
  const save = vi.fn<(action: KnownMacroAction) => void>();
  render(
    <MacroActionDialog
      kind="clearAll"
      initial={{kind: 'clearAll', transition: {fade: true, durationMs: 1200}}}
      choices={{}}
      screens={screens}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '\uc644\ub8cc'}));
  expect(save).toHaveBeenCalledWith({
    kind: 'clearAll',
    transition: {fade: true, durationMs: 1200},
  });
});
