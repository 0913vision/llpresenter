import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {createServiceItemId} from '@shared/schema/ids';
import {SongEditorStore} from '@renderer/prep/editor';
import {mockMenuRowHeight} from '@renderer/prep/editor/editorTesting';
import {useShow} from '@renderer/state/show';
import {resetTooltips, hoverForTooltip} from '@renderer/ui/tooltipTesting';
import {NEWER_FILE_REASON} from './ItemArrangement';
import {
  fixtureItems,
  fixtureMacros,
  fixtureMedia,
  fixtureServiceId,
  itemFixture,
} from './itemFixture';
import {ItemSettingsPanel} from './ItemSidePanels';
import {ServiceItemStore} from './serviceItemStore';
import type {Notice} from '@renderer/ui/notices';

vi.mock('@renderer/render/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

afterEach(() => {
  useShow.setState({serviceId: null, openItemId: null});
  resetTooltips();
});

async function setup(itemId: string = fixtureItems.arranged) {
  mockMenuRowHeight();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const fixture = itemFixture();
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const problem = vi.fn<(notice: Notice) => void>();
  const items = new ServiceItemStore(fixture.api, editor, problem);
  items.show({serviceId: fixtureServiceId, itemId});
  const view = render(<ItemSettingsPanel items={items} editor={editor} />);
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  await waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
  const settings = screen.getByRole('region', {name: '항목 설정'});
  await waitFor(() =>
    expect(
      within(settings)
        .getByRole('button', {name: '시작할 때'})
        .getAttribute('aria-disabled'),
    ).toBeNull(),
  );
  return {
    ...fixture,
    editor,
    items,
    problem,
    settings,
    user: userEvent.setup(),
  };
}

function stored(
  service: () => {readonly service: {readonly order: readonly object[]}},
  index: number,
) {
  return service().service.order[index];
}

function failedMacros() {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mockMenuRowHeight();
  const fixture = itemFixture();
  const read = fixture.api.settings.get;
  vi.spyOn(fixture.api.settings, 'get').mockImplementation(request =>
    request.name === 'macros'
      ? Promise.reject(new Error('Gone'))
      : read(request),
  );
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
  const view = render(<ItemSettingsPanel items={items} editor={editor} />);
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  const shown = (): HTMLElement =>
    screen.getByRole('button', {name: '시작할 때'});
  return {fixture, read, shown};
}

describe('항목 설정 이번 예배 and 메모', () => {
  it('overrides the background for this item and returns to 곡 기본값', async () => {
    const {settings, user, service} = await setup();
    const background = within(settings).getByRole('button', {name: '배경'});
    expect(background.textContent).toContain('곡 기본값');
    await user.click(background);
    expect(screen.queryByRole('menuitemradio', {name: '찬송 반주'})).toBeNull();
    await user.click(screen.getByRole('menuitemradio', {name: '새벽 하늘'}));
    await waitFor(() =>
      expect(stored(service, 1)).toMatchObject({background: fixtureMedia.dawn}),
    );
    expect(background.textContent).toContain('새벽 하늘');
    expect(background.textContent).not.toContain('곡 기본값');
    await user.click(background);
    await user.click(screen.getByRole('menuitemradio', {name: '곡 기본값'}));
    await waitFor(() =>
      expect(stored(service, 1)).not.toHaveProperty('background'),
    );
  });

  it('sets the start 매크로 with its tile and removes it with 없음', async () => {
    const {settings, user, service} = await setup();
    const start = within(settings).getByRole('button', {name: '시작할 때'});
    expect(start.textContent).toContain('없음');
    await user.click(start);
    await user.click(screen.getByRole('menuitemradio', {name: '찬양'}));
    await waitFor(() =>
      expect(stored(service, 1)).toMatchObject({macro: fixtureMacros.praise}),
    );
    expect(start.textContent).toContain('찬양');
    expect(start.textContent).toContain('매크로');
    await user.click(start);
    await user.click(screen.getByRole('menuitemradio', {name: '없음'}));
    await waitFor(() => expect(stored(service, 1)).not.toHaveProperty('macro'));
  });

  it('saves the memo on blur and keeps the other fields', async () => {
    const {settings, user, service} = await setup();
    const memo = within(settings).getByRole('textbox', {name: '메모'});
    expect(memo).toHaveProperty('value', '천천히');
    await user.click(memo);
    await user.keyboard(' 부르기');
    await user.tab();
    await waitFor(() =>
      expect(stored(service, 1)).toMatchObject({
        memo: '천천히 부르기',
        arrangement: '주일용',
        future: {keep: true},
      }),
    );
  });

  it('saves a memo typed for one item to that item when another is shown', async () => {
    const {settings, user, service, items} = await setup();
    const memo = within(settings).getByRole('textbox', {name: '메모'});
    await user.click(memo);
    await user.keyboard('!');
    act(() =>
      items.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain}),
    );
    await waitFor(() =>
      expect(stored(service, 1)).toMatchObject({memo: '천천히!'}),
    );
    expect(stored(service, 2)).not.toHaveProperty('memo');
  });

  it('keeps a refused memo on screen and saves it from 다시 저장', async () => {
    const {api, settings, user, service, problem} = await setup();
    const write = api.content.edit;
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Fixture refusal'},
    });
    const memo = within(settings).getByRole('textbox', {name: '메모'});
    await user.click(memo);
    await user.keyboard('!');
    await user.tab();
    await waitFor(() =>
      expect(problem).toHaveBeenLastCalledWith(
        expect.objectContaining({title: '메모 저장 실패'}),
      ),
    );
    expect(memo).toHaveProperty('value', '천천히!');
    vi.mocked(api.content.edit).mockImplementation(write);
    const retry = problem.mock.calls.at(-1)?.[0].actions?.[0];
    expect(retry?.label).toBe('다시 저장');
    act(() => retry?.onSelect());
    await waitFor(() =>
      expect(stored(service, 1)).toMatchObject({memo: '천천히!'}),
    );
  });

  it('keeps a refused memo for its item after another item was shown', async () => {
    const {api, settings, user, items, problem} = await setup();
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Fixture refusal'},
    });
    await user.click(within(settings).getByRole('textbox', {name: '메모'}));
    await user.keyboard('?');
    act(() =>
      items.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain}),
    );
    await waitFor(() => expect(problem).toHaveBeenCalled());
    act(() =>
      items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged}),
    );
    expect(
      within(screen.getByRole('region', {name: '항목 설정'})).getByRole(
        'textbox',
        {name: '메모'},
      ),
    ).toHaveProperty('value', '천천히?');
  });

  it('gives the reason for a failed 매크로 read', async () => {
    const {shown} = failedMacros();
    await waitFor(() =>
      expect(shown().getAttribute('aria-disabled')).toBeNull(),
    );
    expect((await hoverForTooltip(shown()))?.textContent).toBe(
      '매크로를 불러오지 못했습니다',
    );
  });

  it('reads the 매크로 again from the failed row and recovers', async () => {
    const {shown, fixture, read} = failedMacros();
    await waitFor(() =>
      expect(shown().getAttribute('aria-disabled')).toBeNull(),
    );
    vi.mocked(fixture.api.settings.get).mockImplementation(read);
    await userEvent.click(shown());
    await waitFor(() =>
      expect(shown().getAttribute('aria-haspopup')).toBe('listbox'),
    );
    await waitFor(() =>
      expect(
        vi
          .mocked(fixture.api.settings.get)
          .mock.calls.filter(([request]) => request.name === 'macros'),
      ).toHaveLength(2),
    );
    await act(async () => {
      await Promise.resolve();
    });
    await userEvent.click(shown());
    expect(
      await screen.findByRole('menuitemradio', {name: '찬양'}),
    ).toBeDefined();
  });

  it('finds a 매크로 named by an older file and checks it', async () => {
    const {settings, user, service, pushService} = await setup();
    act(() =>
      pushService({
        ...service(),
        revision: 9,
        service: {
          ...service().service,
          order: service().service.order.map(row =>
            row.id === fixtureItems.arranged ? {...row, macro: '찬양'} : row,
          ),
        },
      }),
    );
    const start = within(settings).getByRole('button', {name: '시작할 때'});
    await waitFor(() => expect(start.textContent).toContain('찬양'));
    expect(start.textContent).toContain('매크로');
    await user.click(start);
    expect(
      screen
        .getByRole('menuitemradio', {name: '찬양'})
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('makes the memo read-only at the draft limit, so nothing typed can be lost', async () => {
    const {api, items, settings, user} = await setup();
    vi.spyOn(api.content, 'edit').mockResolvedValue({
      ok: false,
      error: {reason: 'stale', message: 'Fixture refusal'},
    });
    for (let n = 0; n < 100; n++) {
      await items.setMemo(
        {
          serviceId: fixtureServiceId,
          itemId: createServiceItemId(
            `80000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
          ),
        },
        `메모 ${n}`,
      );
    }
    const memo = within(settings).getByRole('textbox', {name: '메모'});
    await waitFor(() => expect(memo).toHaveProperty('readOnly', true));
    await user.click(memo);
    await user.keyboard('잃을 글');
    expect(memo).toHaveProperty('value', '천천히');
    act(() =>
      items.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain}),
    );
    act(() =>
      items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged}),
    );
    expect(
      within(screen.getByRole('region', {name: '항목 설정'})).getByRole(
        'textbox',
        {name: '메모'},
      ),
    ).toHaveProperty('value', '천천히');
    const again = within(
      screen.getByRole('region', {name: '항목 설정'}),
    ).getByRole('textbox', {name: '메모'});
    expect((await hoverForTooltip(again))?.textContent).toBe(
      '저장하지 못한 메모가 너무 많음',
    );
  });

  it('locks the rows of a read-only service with the reason', async () => {
    const {settings, service, pushService} = await setup();
    act(() => pushService({...service(), revision: 9, access: 'readOnly'}));
    const start = within(settings).getByRole('button', {name: '시작할 때'});
    expect(start.getAttribute('aria-disabled')).toBe('true');
    expect((await hoverForTooltip(start))?.textContent).toBe(NEWER_FILE_REASON);
    expect(
      within(settings).getByRole('textbox', {name: '메모'}),
    ).toHaveProperty('readOnly', true);
  });
});
