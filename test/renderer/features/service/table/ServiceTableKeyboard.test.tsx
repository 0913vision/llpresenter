import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, onTestFinished, vi} from 'vitest';
import type {ServiceRow} from '@core/presentation/model';
import {isItemOfKind} from '@core/schema/service';
import {newSlidesItem} from '@core/services/slidesEdits';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {mockMenuRowHeight} from '@fixtures/renderer/features/songs/editor/editorTesting';
import {installMenuTestHooks} from '@fixtures/renderer/ui/menuTesting';
import {ItemEditQueue} from '@renderer/features/service/items/itemEditQueue';
import {ServiceTableList} from '@renderer/features/service/table/ServiceTableList';
import {applyService, useShow} from '@renderer/session/show';

installMenuTestHooks();

function setup(blank = false) {
  mockMenuRowHeight();
  const fixture = itemFixture();
  const {api, service, pushService} = fixture;
  if (blank) {
    const item = newSlidesItem('blank', fixtureItems.arranged);
    if (!isItemOfKind(item, 'slides')) throw new Error('Expected slides');
    pushService({
      ...service(),
      service: {
        ...service().service,
        order: [
          {...item, slides: {...item.slides, name: ''}},
          {...item, id: fixtureItems.plain, slides: {...item.slides, name: ''}},
        ],
      },
    });
  }
  window.llp = api;
  const publish = (): void =>
    applyService({
      id: fixtureServiceId,
      revision: service().revision,
      name: 'Invented service',
      readOnly: false,
      rows: service().service.order.map((item): ServiceRow =>
        'header' in item
          ? {kind: 'header', id: item.id, title: item.header}
          : isItemOfKind(item, 'slides')
            ? {
                kind: 'slides',
                id: item.id,
                title: item.slides.name,
                form: item.slides.form,
              }
            : {
                kind: 'song',
                id: item.id,
                title: item.id === fixtureItems.arranged ? '첫 곡' : '다음 곡',
              },
      ),
      tiles: {},
      jumpKeys: {},
    });
  publish();
  const stop = api.services.subscribe(publish);
  const queue = new ItemEditQueue(api, vi.fn());
  onTestFinished(() => {
    stop();
    queue.dispose();
  });
  render(
    <>
      <input aria-label="다른 검색" defaultValue="unchanged" />
      <ServiceTableList
        api={api}
        items={{submitItemEdit: request => queue.submit(request)}}
        onProblem={vi.fn()}
      />
    </>,
  );
  return {...fixture, user: userEvent.setup()};
}

afterEach(() => {
  cleanup();
  applyService(null);
  delete window.llp;
  vi.restoreAllMocks();
});

it('saves a memo through the parent push, keeps cell focus and undoes only that item', async () => {
  const {user, service} = setup();
  await screen.findByText('천천히');
  act(() => screen.getByRole('option', {name: '첫 곡'}).focus());
  await user.keyboard(
    ' {ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{Enter}',
  );
  expect(document.activeElement).toBe(
    screen.getByRole('textbox', {name: '메모, 첫 곡'}),
  );
  await user.keyboard('{Control>}a{/Control}바로 시작{Enter}');
  const memo = await screen.findByRole('button', {name: '메모, 첫 곡'});
  await waitFor(() => expect(document.activeElement).toBe(memo));
  expect(memo.textContent).toBe('바로 시작');
  await user.keyboard('{Control>}z{/Control}');
  await waitFor(() => expect(memo.textContent).toBe('천천히'));
  expect(document.activeElement).toBe(memo);
  expect(
    service().service.order.find(item => item.id === fixtureItems.arranged),
  ).toMatchObject({memo: '천천히'});
  expect(screen.getByRole('textbox', {name: '다른 검색'})).toHaveProperty(
    'value',
    'unchanged',
  );
  await user.keyboard('{Control>}y{/Control}');
  await waitFor(() => expect(memo.textContent).toBe('바로 시작'));
  await user.keyboard('{Enter}');
  expect(screen.getByRole('textbox', {name: '메모, 첫 곡'})).toHaveProperty(
    'value',
    '바로 시작',
  );
  await user.keyboard('{Escape}');
  expect(document.activeElement).toBe(
    screen.getByRole('button', {name: '메모, 첫 곡'}),
  );
});

it('keeps subsequent keys on the footer after Tab leaves a pending memo save', async () => {
  const {api, user} = setup();
  await screen.findByText('천천히');
  const edit = api.content.edit;
  let release: () => void = () => undefined;
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
  vi.spyOn(api.content, 'edit').mockImplementationOnce(async command => {
    await pending;
    return edit(command);
  });
  act(() => screen.getByRole('option', {name: '첫 곡'}).focus());
  await user.keyboard(
    ' {ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{Enter}',
  );
  await user.keyboard('{Control>}a{/Control}바로 시작{Enter}');
  expect(screen.getByRole('textbox', {name: '메모, 첫 곡'})).toHaveProperty(
    'readOnly',
    true,
  );
  await user.tab();
  const footer = screen.getByRole('button', {name: '항목'});
  expect(document.activeElement).toBe(footer);
  await act(async () => {
    release();
  });
  await waitFor(() =>
    expect(screen.getByRole('button', {name: '메모, 첫 곡'}).textContent).toBe(
      '바로 시작',
    ),
  );
  expect(document.activeElement).toBe(footer);
  await user.keyboard('{Enter}');
  expect(screen.getByRole('menu', {name: '항목 추가'})).toBeDefined();
  expect(screen.queryByRole('textbox', {name: '메모, 첫 곡'})).toBeNull();
});

it('names title-less rows and cells by type and position without adding visible titles', async () => {
  const {service, user} = setup(true);
  for (const position of [1, 2]) {
    const row = await screen.findByRole('option', {
      name: `빈 슬라이드 ${position}`,
    });
    for (const field of ['테마', '배경', '시작할 때', '메모']) {
      await within(row).findByRole('button', {
        name: `${field}, 빈 슬라이드 ${position}`,
      });
    }
    expect(row.textContent).not.toContain('빈 슬라이드');
  }
  expect(
    service().service.order.every(
      item => isItemOfKind(item, 'slides') && item.slides.name === '',
    ),
  ).toBe(true);
  act(() => screen.getByRole('option', {name: '빈 슬라이드 1'}).focus());
  await user.keyboard(' {ArrowRight}{Enter}');
  await screen.findByRole('menu');
  await user.keyboard('{Escape}');
  expect(document.activeElement).toBe(
    screen.getByRole('button', {name: '테마, 빈 슬라이드 1'}),
  );
  await user.keyboard('{ArrowRight}{Enter}');
  await screen.findByRole('listbox', {name: '배경 선택'});
  await user.keyboard('{Escape}');
  expect(document.activeElement).toBe(
    screen.getByRole('button', {name: '배경, 빈 슬라이드 1'}),
  );
});

it.each(['빈 슬라이드', '광고'])(
  'adds %s after the selection from the footer keyboard menu and opens its editor',
  async label => {
    const {api, user, service} = setup();
    const open = vi
      .spyOn(api.slidesEditor, 'open')
      .mockResolvedValue({ok: true, value: undefined});
    await screen.findByText('천천히');
    act(() => screen.getByRole('option', {name: '첫 곡'}).focus());
    await user.keyboard(' ');
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '항목'}),
    );
    await user.keyboard(
      '{Enter}{Home}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}',
    );
    if (label === '광고') await user.keyboard('{ArrowDown}');
    const menu = screen.getByRole('menu', {name: '항목 추가'});
    expect(menu.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('menuitem', {name: label}).id,
    );
    await user.keyboard('{Enter}');
    await waitFor(() => expect(open).toHaveBeenCalledOnce());
    const order = service().service.order;
    const added = order[2];
    expect(added).toMatchObject({
      slides: {form: label === '광고' ? 'ad' : 'blank'},
    });
    expect(order[3]?.id).toBe(fixtureItems.plain);
    expect(useShow.getState().openItemId).toBe(added?.id);
    expect(open).toHaveBeenCalledWith({
      serviceId: fixtureServiceId,
      itemId: added?.id,
      ...(label === '빈 슬라이드' ? {focusText: true} : {}),
    });
  },
);

it('continues row navigation after delete/undo and uses the named empty list for undo/redo', async () => {
  const {user} = setup(true);
  const first = await screen.findByRole('option', {name: '빈 슬라이드 1'});
  act(() => first.focus());
  await user.keyboard(' {Delete}');
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
  expect(document.activeElement).toBe(screen.getByRole('option'));
  await user.keyboard('{Control>}z{/Control}');
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
  expect(document.activeElement?.getAttribute('role')).toBe('option');
  await user.keyboard('{Home}{ArrowDown}');
  expect(document.activeElement?.getAttribute('data-value')).toBe(
    fixtureItems.plain,
  );
  await user.keyboard('{Delete}');
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
  await user.keyboard(' {Delete}');
  await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
  expect(
    within(screen.getByRole('listbox', {name: '예배 순서'})).getByRole('status')
      .textContent,
  ).toBe('항목 없음');
  expect(document.activeElement).toBe(
    screen.getByRole('listbox', {name: '예배 순서'}),
  );
  await user.keyboard('{Control>}z{/Control}');
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('option')),
  );
  await user.keyboard('{Control>}y{/Control}');
  await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
  expect(document.activeElement).toBe(
    screen.getByRole('listbox', {name: '예배 순서'}),
  );
});

it('does not reclaim focus after the operator leaves a pending undo', async () => {
  const {api, user} = setup(true);
  act(() => screen.getByRole('option', {name: '빈 슬라이드 1'}).focus());
  await user.keyboard(' {Delete}');
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
  const edit = api.content.edit;
  let release: () => void = () => undefined;
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
  vi.spyOn(api.content, 'edit').mockImplementationOnce(async command => {
    await pending;
    return edit(command);
  });
  await user.keyboard('{Control>}z{/Control}');
  const other = screen.getByRole('textbox', {name: '다른 검색'});
  act(() => other.focus());
  await act(async () => {
    release();
  });
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
  expect(document.activeElement).toBe(other);
});
