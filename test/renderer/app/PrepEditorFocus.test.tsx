import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, vi} from 'vitest';
import {createServiceId} from '@core/schema/ids';
import {fixtureServiceId} from '@fixtures/renderer/features/service/items/itemFixture';
import {applyService, useShow} from '@renderer/session/show';
import {hoverForTooltip} from '@fixtures/renderer/ui/tooltipTesting';
import {
  setup,
  commandList,
} from '@fixtures/renderer/app/prepEditorFocusTesting';

it('keeps the editor while 진행 is shown without letting Escape close it', async () => {
  const f = setup(false, false, true);
  const row = screen.getByRole('option', {name: /Service song/});
  await userEvent.click(row);
  await userEvent.dblClick(row);
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
  const session = f.session.editor?.getSnapshot().session;
  expect(session).not.toBeNull();
  await userEvent.click(screen.getByRole('tab', {name: '진행'}));
  await waitFor(() =>
    expect(
      screen.getByRole('tab', {name: '진행'}).getAttribute('aria-selected'),
    ).toBe('true'),
  );
  fireEvent.keyDown(document.body, {key: 'Escape', code: 'Escape'});
  expect(f.session.editor?.getSnapshot().session).toBe(session);
  await userEvent.click(screen.getByRole('tab', {name: '준비'}));
  await waitFor(() =>
    expect(screen.getByRole('region', {name: '곡 편집'})).toBeTruthy(),
  );
  expect(f.session.editor?.getSnapshot().session).toBe(session);
});

it.each(['service', 'item'] as const)(
  'invalidates a retained service editor when its %s changes in 진행',
  async change => {
    const f = setup();
    await userEvent.dblClick(
      screen.getByRole('option', {name: /Service song/}),
    );
    await waitFor(() =>
      expect(f.session.editor?.getSnapshot().session?.itemSession).toBe(true),
    );
    await userEvent.click(screen.getByRole('tab', {name: '진행'}));
    act(() =>
      applyService({
        revision: 2,
        id:
          change === 'service'
            ? createServiceId('30000000-0000-4000-8000-000000000099')
            : fixtureServiceId,
        name: 'Changed service',
        readOnly: false,
        rows: [],
        tiles: {},
      }),
    );
    await waitFor(() =>
      expect(f.session.editor?.getSnapshot().session).toBeNull(),
    );
    await userEvent.click(screen.getByRole('tab', {name: '준비'}));
    expect(screen.queryByRole('region', {name: '곡 편집'})).toBeNull();
  },
);

it('does not open Save As for a retained song while 진행 is visible', async () => {
  const f = setup();
  await userEvent.dblClick(screen.getByRole('option', {name: /Service song/}));
  await waitFor(() =>
    expect(f.session.editor?.getSnapshot().session).not.toBeNull(),
  );
  await screen.findByRole('region', {name: '곡 편집'});
  await userEvent.keyboard('{Control>}{Shift>}s{/Shift}{/Control}');
  await screen.findByRole('dialog', {name: /다른 이름으로 저장/});
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('tab', {name: '진행'}));
  await userEvent.keyboard('{Control>}{Shift>}s{/Shift}{/Control}');
  expect(screen.queryByRole('dialog', {name: /다른 이름으로 저장/})).toBeNull();
  expect(f.session.editor?.getSnapshot().session).not.toBeNull();
});

it.each(['Service song', 'Sermon item', 'Bible item'])(
  'leaves the previous service %s editor when the service changes',
  async item => {
    const f = setup();
    const row = screen.getByRole('option', {name: new RegExp(item)});
    await userEvent.click(row);
    await userEvent.dblClick(row);
    await screen.findByRole('button', {name: '‹ Service'});
    act(() => {
      useShow.setState({
        serviceId: '50000000-0000-4000-8000-000000000123',
        openItemId: null,
        rows: [],
      });
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', {name: '‹ Service'})).toBeNull(),
    );
    expect(f.session.editor?.getSnapshot().session).toBeNull();
    expect(screen.queryByRole('region', {name: '곡 편집'})).toBeNull();
    expect(screen.getByRole('listbox', {name: '예배 순서'})).toBeTruthy();
  },
);

it.each(['double-click', 'Enter'] as const)(
  'focuses a service song opened by %s and restores its table row after Escape',
  async path => {
    const f = setup();
    const table = screen.getByRole('listbox', {name: '예배 순서'});
    const row = within(table).getByRole('option', {name: /Service song/});
    await userEvent.click(row);
    if (path === 'double-click') await userEvent.dblClick(row);
    else await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(document.activeElement).toBe(commandList()));
    const model = f.session.editor?.getSnapshot().session?.slideModel;
    expect(model?.getSnapshot().selection.ids.size).toBe(1);
    await userEvent.keyboard('{Control>}d{/Control}');
    expect(model?.getSnapshot().slides).toHaveLength(3);
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(screen.getByRole('listbox', {name: '예배 순서'})).getByRole(
          'option',
          {name: /Service song/},
        ),
      ),
    );
  },
);

it.each([
  ['Bible item', 'double-click'],
  ['Bible item', 'Enter'],
  ['Media item', 'double-click'],
  ['Media item', 'Enter'],
] as const)(
  'opens %s with %s and returns to its focused row on Escape',
  async (name, path) => {
    setup();
    const row = screen.getByRole('option', {name});
    await userEvent.click(row);
    expect(screen.queryByRole('button', {name: '‹ Service'})).toBeNull();
    if (path === 'double-click') await userEvent.dblClick(row);
    else await userEvent.keyboard('{Enter}');
    const back = await screen.findByRole('button', {name: '‹ Service'});
    expect(back.closest('[data-panel="편집"]')).not.toBeNull();
    back.focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('button', {name: '‹ Service'})).toBeNull(),
    );
    expect(document.activeElement).toBe(screen.getByRole('option', {name}));
  },
);

it.each(['Bible item', 'Media item'] as const)(
  'opens the %s editor and inspector from a details slide',
  async name => {
    const f = setup();
    const send = vi.spyOn(f.api.live, 'send');
    await userEvent.click(screen.getByRole('option', {name}));
    await screen.findByRole('tab', {name: '슬라이드'});
    const details = screen.getByRole('region', {name: '세부정보'});
    await userEvent.click(within(details).getByRole('tab', {name: '슬라이드'}));
    const grid = within(details).getByRole('listbox', {name: '슬라이드'});
    const first = await within(grid).findByRole('option', {name: /^1(?:\s|$)/});
    await userEvent.dblClick(first);
    await screen.findByRole('button', {name: '‹ Service'});
    expect(screen.getByRole('region', {name: '슬라이드 속성'})).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  },
);

it.each([
  ['Announcement item', 'double-click'],
  ['Announcement item', 'Enter'],
  ['Section item', 'double-click'],
  ['Section item', 'Enter'],
] as const)('opens %s with %s in the slide editor', async (name, path) => {
  setup(true);
  const row = screen.getByRole('option', {name});
  await userEvent.click(row);
  if (path === 'double-click') await userEvent.dblClick(row);
  else await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
  await userEvent.keyboard('{Escape}');
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('option', {name})),
  );
});

it('retains the section card when the details panel unmounts for the editor', async () => {
  setup(true);
  const row = screen.getByRole('option', {name: 'Section item'});
  await userEvent.click(row);
  await userEvent.dblClick(row);
  const card = await screen.findByRole('textbox', {name: '타이틀'});
  expect(card).toHaveProperty('value', 'Section');
  await waitFor(() =>
    expect(document.querySelector('[data-leading-card]')).not.toBeNull(),
  );
});

it('binds a service song card while switching from details to the editor', async () => {
  setup(false, true);
  await userEvent.dblClick(screen.getByRole('option', {name: /Service song/}));
  const field = await screen.findByRole('textbox', {name: '타이틀'});
  expect(field).toHaveProperty('value', 'Song section');
  expect(document.querySelector('[data-leading-card]')).not.toBeNull();
});

it('switches from a song to a Bible item and back to a song', async () => {
  setup();
  const song = screen.getByRole('option', {name: /Service song/});
  await userEvent.click(song);
  await userEvent.dblClick(song);
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
  const next = screen.getByRole('option', {name: 'Bible item'});
  expect(fireEvent.mouseDown(next, {button: 0})).toBe(false);
  expect(document.activeElement).toBe(commandList());
  await userEvent.click(next);
  await screen.findByRole('button', {name: '‹ Service'});
  await userEvent.click(screen.getByRole('option', {name: /Service song/}));
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
});

it('tabs from the numbered navigator through the editor before the right panel', async () => {
  setup();
  await userEvent.dblClick(screen.getByRole('option', {name: /Service song/}));
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
  const navigator = screen.getByRole('listbox', {name: '예배 순서'});
  const row = within(navigator).getByRole('option', {name: /Service song/});
  expect(row.textContent).toContain('1');
  expect(row.textContent).toContain('Service song');
  expect(row.textContent).not.toContain('슬라이드');
  expect(
    within(navigator).getByRole('option', {name: 'Bible item'}).textContent,
  ).not.toContain('슬라이드');
  row.focus();
  let sawEditor = false;
  let sawRight = false;
  for (let i = 0; i < 60 && !sawRight; i++) {
    await userEvent.tab();
    const active = document.activeElement;
    if (!(active instanceof Element)) continue;
    if (active.closest('[data-panel="편집"]')) sawEditor = true;
    if (active.closest('[data-panel="슬라이드 속성"]')) {
      expect(sawEditor).toBe(true);
      sawRight = true;
    }
  }
  expect(sawRight).toBe(true);
  await userEvent.keyboard('{Escape}');
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('option', {name: /Service song/}),
    ),
  );
});

it('shows the full navigator name in a tooltip when it is truncated', async () => {
  setup();
  await userEvent.dblClick(screen.getByRole('option', {name: /Service song/}));
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
  const row = within(
    screen.getByRole('listbox', {name: '예배 순서'}),
  ).getByRole('option', {name: /Service song/});
  const name = within(row).getByText('Service song');
  Object.defineProperties(name, {
    clientWidth: {value: 40},
    scrollWidth: {value: 120},
  });
  expect((await hoverForTooltip(name))?.textContent).toBe('Service song');
});

it.each(['double-click', 'Enter'] as const)(
  'focuses sermon list commands opened by %s and handles body Escape',
  async path => {
    setup();
    const row = screen.getByRole('option', {name: /Sermon item/});
    await userEvent.click(row);
    if (path === 'double-click') await userEvent.dblClick(row);
    else await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(document.activeElement).toBe(commandList()));
    fireEvent.keyDown(document.body, {key: 'Escape', code: 'Escape'});
    await waitFor(() =>
      expect(
        screen
          .queryAllByLabelText('슬라이드 편집', {selector: 'div'})
          .filter(editor => editor.closest('[data-held-copy]') === null),
      ).toHaveLength(0),
    );
    const table = await screen.findByRole('listbox', {name: '예배 순서'});
    expect(document.activeElement).toBe(
      within(table).getByRole('option', {name: /Sermon item/}),
    );
  },
);
