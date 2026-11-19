import {useSyncExternalStore} from 'react';
import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, onTestFinished, vi} from 'vitest';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {newSectionCard, sectionCardOf} from '@core/services/sectionCards';
import {newSlidesItem} from '@core/services/slidesEdits';
import {isItemOfKind} from '@core/schema/service';
import {ItemCardRow} from '@renderer/features/service/items/ItemCardRow';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {serviceOrderEditsFor} from '@renderer/session/serviceOrderEdits';

it.each(['song', 'bible', 'slides', 'standalone'] as const)(
  'adds, replaces, removes and undoes a card for %s',
  async kind => {
    const fixture = itemFixture();
    const document = fixture.service();
    const source = document.service.order.find(
      row => row.id === fixtureItems.arranged,
    );
    if (source === undefined || !isItemOfKind(source, 'song')) {
      throw Error('Missing song');
    }
    const passage = panelPassage();
    const target =
      kind === 'song'
        ? source
        : kind === 'bible'
          ? {
              id: source.id,
              bible: {
                translation: passage.translation,
                ref: passage.ref,
                split: 'verse' as const,
                reference: 'every' as const,
                verseNumbers: true,
                translationName: false,
              },
            }
          : kind === 'slides'
            ? newSlidesItem('blank', source.id)
            : {
                ...newSlidesItem('blank', source.id),
                sectionCard: newSectionCard(),
                slides: {form: 'blank' as const, name: 'Card', slides: []},
              };
    fixture.pushService({
      ...document,
      service: {
        ...document.service,
        order: document.service.order.map(row =>
          row.id === source.id ? target : row,
        ),
      },
    });
    const editor = new SongEditorStore(fixture.api, vi.fn());
    const items = new ServiceItemStore(fixture.api, editor, vi.fn());
    items.show({serviceId: fixtureServiceId, itemId: source.id});
    function Row() {
      const {item, busy} = useSyncExternalStore(
        items.subscribe,
        items.getSnapshot,
      );
      return item === null ? null : (
        <ItemCardRow
          items={items}
          item={item}
          reason={busy ? '저장 중' : undefined}
        />
      );
    }
    const view = render(<Row />);
    onTestFinished(async () => {
      view.unmount();
      items.dispose();
      await editor.dispose();
    });
    const field = await screen.findByRole('button', {name: '구역 이름'});
    const choose = async (name: string) => {
      await waitFor(() =>
        expect(field.getAttribute('aria-disabled')).not.toBe('true'),
      );
      await userEvent.click(field);
      await userEvent.click(screen.getByRole('menuitemradio', {name}));
      await waitFor(() => expect(field.textContent).toContain(name));
    };
    const first = SUNDAY_SECTIONS[0],
      second = SUNDAY_SECTIONS[1];
    if (!first || !second) throw Error('Missing sections');
    await userEvent.click(field);
    const menu = screen.getByRole('menu', {name: '구역 이름'});
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map(row => row.textContent),
    ).toEqual([
      ...(kind === 'standalone' ? [] : ['없음']),
      ...SUNDAY_SECTIONS.map(section => section.name),
    ]);
    await userEvent.click(
      within(menu).getByRole('menuitemradio', {name: first.name}),
    );
    await waitFor(() =>
      expect(items.getSnapshot().item).toMatchObject({
        sectionCard: sectionCardOf(first),
      }),
    );
    await choose(second.name);
    await waitFor(() =>
      expect(items.getSnapshot().item).toMatchObject({
        sectionCard: sectionCardOf(second),
      }),
    );
    if (kind === 'standalone') {
      expect(items.getSnapshot().item).toMatchObject({
        slides: {name: second.name},
        theme: second.theme,
      });
    }
    const history = serviceOrderEditsFor(fixture.api);
    await act(async () => {
      expect((await history.undo(fixtureServiceId)).ok).toBe(true);
    });
    await waitFor(() =>
      expect(items.getSnapshot().item).toMatchObject({
        sectionCard: sectionCardOf(first),
      }),
    );
    if (kind === 'standalone') {
      expect(items.getSnapshot().item).toMatchObject({
        slides: {name: first.name},
        theme: first.theme,
      });
    }
    await act(async () => {
      expect((await history.redo(fixtureServiceId)).ok).toBe(true);
    });
    await waitFor(() =>
      expect(items.getSnapshot().item).toMatchObject({
        sectionCard: sectionCardOf(second),
      }),
    );
    if (kind !== 'standalone') {
      await choose('없음');
      await waitFor(() =>
        expect(items.getSnapshot().item).not.toHaveProperty('sectionCard'),
      );
    }
  },
);

it('keeps a custom name and English text until another choice is made', async () => {
  const fixture = itemFixture();
  const document = fixture.service();
  const custom = {
    ...newSectionCard(),
    name: '우리 이름',
    english: 'Our custom title',
  };
  fixture.pushService({
    ...document,
    service: {
      ...document.service,
      order: document.service.order.map(row =>
        row.id === fixtureItems.arranged ? {...row, sectionCard: custom} : row,
      ),
    },
  });
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
  function Row() {
    const {item} = useSyncExternalStore(items.subscribe, items.getSnapshot);
    return item === null ? null : (
      <ItemCardRow items={items} item={item} reason={undefined} />
    );
  }
  const view = render(<Row />);
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  const field = await screen.findByRole('button', {name: '구역 이름'});
  expect(field.textContent).toContain('우리 이름');
  expect(items.getSnapshot().item).toMatchObject({sectionCard: custom});
  await userEvent.click(field);
  await userEvent.click(screen.getByRole('menuitemradio', {name: '찬양'}));
  const section = SUNDAY_SECTIONS.find(value => value.name === '찬양');
  if (!section) throw Error('Missing section');
  await waitFor(() =>
    expect(items.getSnapshot().item).toMatchObject({
      sectionCard: sectionCardOf(section),
    }),
  );
});
