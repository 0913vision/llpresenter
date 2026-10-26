import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import type {LiveLayers} from '@shared/live';
import {createMediaId} from '@shared/schema/ids';
import {SongEditorStore} from '@renderer/prep/editor';
import {useShow} from '@renderer/state/show';
import {fixtureItems, fixtureServiceId, itemFixture} from './itemFixture';
import {ItemPreviewPanel, ItemSettingsPanel} from './ItemSidePanels';
import {ServiceItemStore} from './serviceItemStore';
import {ServiceItemPanel} from './SongItemPanel';

const drawing = vi.hoisted(() => ({
  render: vi.fn<(layers: LiveLayers) => void>(),
}));
vi.mock('@renderer/render/outputRenderer', () => ({
  OutputRenderer: class {
    render = drawing.render;
    dispose = vi.fn();
  },
}));

afterEach(() => {
  useShow.setState({serviceId: null, openItemId: null});
  drawing.render.mockClear();
});

async function setup(itemId: string = fixtureItems.arranged) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const fixture = itemFixture();
  const output = vi.spyOn(fixture.api.live, 'send');
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  useShow.setState({serviceId: fixtureServiceId, openItemId: itemId});
  const view = render(
    <>
      <ServiceItemPanel items={items} editor={editor} sizeClass="normal" />
      <ItemPreviewPanel items={items} editor={editor} />
      <ItemSettingsPanel items={items} editor={editor} />
    </>,
  );
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  await waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
  await waitFor(() => expect(editor.getSnapshot().labels).not.toBeNull());
  return {...fixture, editor, items, output, user: userEvent.setup()};
}

function caption(): string {
  const preview = screen.getByRole('region', {name: '미리보기'});
  return preview.textContent;
}

function lastLayers(): LiveLayers | undefined {
  return drawing.render.mock.calls.at(-1)?.[0];
}

describe('service item preview and 항목 설정', () => {
  it('previews the place selected in the item, in the order it plays', async () => {
    const {user, output} = await setup();
    expect(caption()).toContain('1절1 / 3');
    const strip = screen.getByRole('listbox', {name: '구성 순서'});
    await user.click(within(strip).getAllByRole('option')[2] ?? strip);
    expect(caption()).toContain('후렴3 / 3');
    expect(lastLayers()?.slide?.lines).toEqual(['빛을 따라가요']);
    expect(output).not.toHaveBeenCalled();
  });

  it('draws the item background over the song default', async () => {
    const {items, service, pushService} = await setup();
    const override = createMediaId('60000000-0000-4000-8000-000000000001');
    act(() =>
      pushService({
        ...service(),
        revision: 9,
        service: {
          ...service().service,
          order: service().service.order.map(row =>
            row.id === fixtureItems.arranged
              ? {...row, background: override}
              : row,
          ),
        },
      }),
    );
    expect(items.getSnapshot().item).toMatchObject({background: override});
    expect(lastLayers()?.media?.mediaId).toBe(override);
  });

  it('names the source song and opens it in the editor', async () => {
    const {user, editor, first} = await setup();
    const settings = screen.getByRole('region', {name: '항목 설정'});
    const source = within(settings).getByRole('group', {name: '곡'});
    expect(source.textContent).toContain(first.song.title);
    expect(source.textContent).toContain('라이브러리');
    await user.click(
      within(source).getByRole('button', {name: '라이브러리 곡 열기'}),
    );
    expect(editor.getSnapshot().session?.document.song.id).toBe(first.song.id);
  });

  it('shows empty panels for a slot item', async () => {
    await setup();
    act(() => useShow.setState({openItemId: fixtureItems.slot}));
    const settings = screen.getByRole('region', {name: '항목 설정'});
    expect(within(settings).queryByRole('group')).toBeNull();
    expect(
      within(screen.getByRole('region', {name: '미리보기'})).queryByRole(
        'radiogroup',
      ),
    ).toBeNull();
  });
});
