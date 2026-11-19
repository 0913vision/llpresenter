import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {expect, it, vi} from 'vitest';
import userEvent from '@testing-library/user-event';
import {
  createServiceItemId,
  createThemeId,
  translationIdSchema,
} from '@core/schema/ids';
import {parse} from 'valibot';
import {fixtureMedia} from '@fixtures/core/mediaList';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {OtherSlideInspector} from '@renderer/features/service/slideInspector/OtherSlideInspector';
import {useContext, useLayoutEffect, useRef} from 'react';
import {PictureReadiness} from '@renderer/rendering/PictureReadiness';
import {newLiturgyItem} from '@core/services/liturgy';
import {isItemOfKind} from '@core/schema/service';

const showTiles = vi.hoisted(() => {
  const value: Array<{label: null; labelColor: string; lines: string[]}> = [];
  return {value};
});
vi.mock('@renderer/session/show', () => ({useShow: () => showTiles.value}));
vi.mock('@renderer/features/bible/useBibleProjections', () => ({
  useBibleTileProjection: ({itemId}: {itemId: string | null}) =>
    itemId === null
      ? null
      : itemId.endsWith('000000000098')
        ? {
            tiles: [
              {
                label: null,
                labelColor: 'none',
                lines: ['Sermon'],
                sermonTitle: true,
              },
              {label: '1:1', labelColor: 'none', lines: ['Verse']},
              {
                label: null,
                labelColor: 'none',
                lines: ['Sermon'],
                sermonTitle: true,
              },
            ],
            partsByTile: [
              null,
              {
                reference: {
                  translation: 'sample',
                  book: 1,
                  chapter: 1,
                  verse: 1,
                },
                part: 1,
                partCount: 1,
                text: 'text',
                display: 'text',
                continued: false,
                manual: false,
              },
              null,
            ],
            appearance: {theme: {layout: {}, emptyColor: '#000', item: null}},
          }
        : {
            tiles: [
              {label: '1:1', labelColor: 'none', lines: ['첫 말씀']},
              {label: '1:2', labelColor: 'none', lines: ['둘째 말씀']},
            ],
            partsByTile: [1, 2].map(verse => ({
              reference: {translation: 'sample', book: 1, chapter: 1, verse},
              part: 1,
              partCount: 1,
              text: 'text',
              display: 'text',
              continued: false,
              manual: false,
            })),
            appearance: {theme: {layout: {}, emptyColor: '#000', item: null}},
          },
}));
vi.mock('@renderer/rendering/SlidePicture', () => ({
  SlidePicture: ({slide}: {slide: {label: string; sectionCard?: unknown}}) => {
    const ready = useContext(PictureReadiness);
    const source = useRef({});
    useLayoutEffect(() => {
      ready?.(source.current);
    }, [ready]);
    return (
      <div
        data-testid={
          slide.sectionCard === undefined ? 'bible-picture' : 'card-picture'
        }
      >
        {slide.label}
      </div>
    );
  },
}));
vi.mock('@renderer/platform/useSlideTheme', () => ({
  useSlideTheme: (item: unknown) =>
    item === undefined
      ? undefined
      : {layout: {}, emptyColor: '#000', item: null},
}));
vi.mock('@renderer/features/media/MediaPropertiesPanel', () => ({
  MediaProperties: ({item}: {item: {kind: string}}) => (
    <div>media settings {item.kind}</div>
  ),
}));

async function setup(
  kind:
    | 'image'
    | 'video'
    | 'bible'
    | 'bible-card'
    | 'slide-card'
    | 'sermon'
    | 'creed'
    | 'prayer',
  omitSecondLiturgyTransition = false,
) {
  const fixture = itemFixture();
  const old = fixture.service();
  const itemId = createServiceItemId(
    kind === 'sermon'
      ? '50000000-0000-4000-8000-000000000098'
      : '50000000-0000-4000-8000-000000000099',
  );
  const item =
    kind === 'creed' || kind === 'prayer'
      ? (() => {
          const liturgy = newLiturgyItem(itemId, {kind, translation: 'new'});
          return omitSecondLiturgyTransition
            ? {
                ...liturgy,
                liturgy: {
                  ...liturgy.liturgy,
                  transitions: (liturgy.liturgy.transitions ?? []).filter(
                    entry => entry.index !== 1,
                  ),
                },
              }
            : liturgy;
        })()
      : kind === 'sermon'
        ? {
            id: itemId,
            sermon: {
              title: 'Sermon',
              passage: {
                translation: parse(translationIdSchema, 'sample'),
                ref: 'John 1:1',
                split: 'verse' as const,
                reference: 'every' as const,
                verseNumbers: true,
                translationName: false,
              },
            },
          }
        : kind === 'bible' || kind === 'bible-card'
          ? {
              id: itemId,
              ...(kind === 'bible-card'
                ? {
                    sectionCard: {
                      name: '예배 시작',
                      english: 'WELCOME',
                      theme: createThemeId(
                        '00000000-0000-4000-8000-000000000100',
                      ),
                    },
                  }
                : {}),
              bible: {
                translation: parse(translationIdSchema, 'sample'),
                ref: '창세기 1:1',
                split: 'verse' as const,
                reference: 'every' as const,
                verseNumbers: true,
                translationName: false,
              },
            }
          : kind === 'slide-card'
            ? {
                id: itemId,
                sectionCard: {
                  name: '예배 시작',
                  english: 'WELCOME',
                  theme: createThemeId('00000000-0000-4000-8000-000000000100'),
                },
                slides: {form: 'blank' as const, name: 'Section', slides: []},
              }
            : {
                id: itemId,
                media: kind === 'image' ? fixtureMedia.warm : fixtureMedia.dawn,
              };
  fixture.pushService({
    ...old,
    revision: old.revision + 1,
    service: {...old.service, order: [item]},
  });
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  act(() => items.show({serviceId: fixtureServiceId, itemId}));
  const view = render(<OtherSlideInspector items={items} editor={editor} />);
  await waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
  if (kind === 'image' || kind === 'video') {
    await waitFor(() =>
      expect(view.container.querySelector('[inert] img')).not.toBeNull(),
    );
    const image = view.container.querySelector('[inert] img');
    if (image === null) throw new Error('Missing staged image');
    fireEvent.load(image);
    await waitFor(() => expect(image.closest('[inert]')).toBeNull());
  }
  return {view, items, editor, fixture};
}

it.each(['creed', 'prayer'] as const)(
  'applies a transition to selected %s slides in one undo step',
  async kind => {
    showTiles.value = [
      {label: null, labelColor: 'none', lines: ['First']},
      {label: null, labelColor: 'none', lines: ['Second']},
      {label: null, labelColor: 'none', lines: ['Third']},
    ];
    const {view, items, editor} = await setup(kind);
    try {
      const before = structuredClone(items.getSnapshot().item);
      act(() => {
        items.setBibleSelection([0, 1]);
        items.selectPosition(1);
      });
      await userEvent.click(
        await screen.findByRole('button', {name: '디졸브'}),
      );
      await waitFor(() => {
        const item = items.getSnapshot().item;
        if (item === null || !isItemOfKind(item, 'liturgy')) {
          throw new Error('Missing liturgy item');
        }
        expect(
          item.liturgy.transitions?.find(entry => entry.index === 0)?.transition
            .kind,
        ).toBe('dissolve');
        expect(
          item.liturgy.transitions?.find(entry => entry.index === 1)?.transition
            .kind,
        ).toBe('dissolve');
      });
      await act(() => items.replayItemEdit('undo'));
      await waitFor(() => expect(items.getSnapshot().item).toEqual(before));
    } finally {
      showTiles.value = [];
      view.unmount();
      items.dispose();
      await editor.dispose();
    }
  },
);

it.each(['creed', 'prayer'] as const)(
  'keeps an unset %s transition unset when editing a mixed duration',
  async kind => {
    showTiles.value = [
      {label: null, labelColor: 'none', lines: ['First']},
      {label: null, labelColor: 'none', lines: ['Second']},
    ];
    const {view, items, editor} = await setup(kind, true);
    try {
      act(() => {
        items.setBibleSelection([0, 1]);
        items.selectPosition(1);
      });
      const time = await screen.findByLabelText('전환 시간');
      expect(time.getAttribute('placeholder')).toBe('혼합');
      const user = userEvent.setup();
      await user.clear(time);
      await user.type(time, '2{Enter}');
      await waitFor(() => {
        const item = items.getSnapshot().item;
        if (item === null || !isItemOfKind(item, 'liturgy')) {
          throw new Error('Missing liturgy item');
        }
        expect(
          item.liturgy.transitions?.find(entry => entry.index === 0)?.transition
            .sec,
        ).toBe(2);
        expect(
          item.liturgy.transitions?.find(entry => entry.index === 1),
        ).toBeUndefined();
      });
    } finally {
      showTiles.value = [];
      view.unmount();
      items.dispose();
      await editor.dispose();
    }
  },
);
it.each(['sermon', 'bible', 'bible-card', 'slide-card'] as const)(
  'provides property layout and spacing for %s transition rows',
  async kind => {
    const {view, items, editor} = await setup(kind);
    const group = screen.getByRole('group', {name: '전환'});
    expect(group.closest('[class*="properties"]')).not.toBeNull();
    const rows = group.querySelector('[class*="transitionRows"]');
    expect(rows?.children).toHaveLength(4);
    expect(
      Array.from(rows?.children ?? []).map(
        row => row.querySelector('label')?.textContent ?? '',
      ),
    ).toEqual(['효과', '방향', '시간', '']);
    expect(
      screen.getByRole('button', {name: '전체 슬라이드에 적용'}),
    ).toBeTruthy();
    for (const row of Array.from(rows?.children ?? []).slice(0, 3)) {
      expect(row.querySelector('label')).not.toBeNull();
      expect(row.querySelector('label')?.nextElementSibling).not.toBeNull();
    }
    expect(
      readFileSync(
        'src/renderer/src/features/service/slideInspector/SlideInspector.module.css',
        'utf8',
      ),
    ).toMatch(/\.transitionRows\s*\{[^}]*gap:\s*var\(--space-8\)/);
    view.unmount();
    items.dispose();
    await editor.dispose();
  },
);
it('saves opening and closing sermon title transitions independently', async () => {
  const {view, items, editor} = await setup('sermon');
  await userEvent.click(
    screen.getByRole('button', {name: '\ub514\uc878\ube0c'}),
  );
  await waitFor(() =>
    expect(items.getSnapshot().item).toMatchObject({
      sermon: {openingTransition: {kind: 'dissolve'}},
    }),
  );
  act(() => {
    items.setBibleSelection([2]);
    items.selectPosition(2);
  });
  await userEvent.click(
    screen.getByRole('button', {name: '\ubc00\uc5b4\ub0b4\uae30'}),
  );
  await waitFor(() =>
    expect(items.getSnapshot().item).toMatchObject({
      sermon: {
        openingTransition: {kind: 'dissolve'},
        closingTransition: {kind: 'push'},
      },
    }),
  );
  view.unmount();
  items.dispose();
  await editor.dispose();
});
it('shows the card-only slide item in the inspector', async () => {
  const {view, items, editor} = await setup('slide-card');
  expect(screen.getByTestId('card-picture').textContent).toBe('예배 시작');
  expect(screen.getByText('1 / 1')).toBeTruthy();
  view.unmount();
  items.dispose();
  await editor.dispose();
});
it.each(['image', 'video'] as const)(
  'shows the %s picture and existing media properties',
  async kind => {
    const {view, items, editor} = await setup(kind);
    await screen.findByText(`media settings ${kind}`);
    expect(view.container.querySelector('img')?.getAttribute('src')).toContain(
      fixtureMedia[kind === 'image' ? 'warm' : 'dawn'],
    );
    if (kind === 'video') {
      expect(view.container.querySelector('img')?.getAttribute('src')).toBe(
        thumbnailSrc(fixtureMedia.dawn),
      );
    }
    const image = view.container.querySelector('img');
    if (image === null) throw new Error('Missing media picture');
    fireEvent.error(image);
    expect(image.style.visibility).toBe('hidden');
    fireEvent.load(image);
    expect(image.style.visibility).toBe('');
    view.unmount();
    items.dispose();
    await editor.dispose();
  },
);
it('shows the selected Bible picture, label and transition picker', async () => {
  const {view, items, editor} = await setup('bible');
  expect(screen.getByTestId('bible-picture')).toBeTruthy();
  expect(screen.getAllByText('1:1')).toHaveLength(2);
  expect(screen.getByLabelText('\uD6A8\uACFC')).toBeTruthy();
  act(() => items.show(null));
  expect(screen.queryByTestId('bible-picture')).toBeNull();
  expect(screen.queryByText('1:1')).toBeNull();
  view.unmount();
  items.dispose();
  await editor.dispose();
});

it('shows the Bible opening card and offsets verse positions past it', async () => {
  const {view, items, editor} = await setup('bible-card');
  expect(screen.getByTestId('card-picture').textContent).toBe('예배 시작');
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(screen.queryByTestId('bible-picture')).toBeNull();
  act(() => items.selectPosition(1));
  expect(screen.getByTestId('bible-picture').textContent).toBe('1:1');
  expect(screen.queryByTestId('card-picture')).toBeNull();
  act(() => items.selectPosition(2));
  expect(screen.getByTestId('bible-picture').textContent).toBe('1:2');
  view.unmount();
  items.dispose();
  await editor.dispose();
});

it('applies one transition to a Bible card and selected parts and undoes them together', async () => {
  const {view, items, editor} = await setup('bible-card');
  act(() => {
    items.setCardSelected(true);
    items.setBibleSelection([0, 1]);
    items.selectPosition(1);
  });
  await userEvent.click(
    screen.getByRole('button', {name: '\uB514\uC878\uBE0C'}),
  );
  await waitFor(() => {
    expect(items.getSnapshot().item).toMatchObject({
      sectionCard: {transition: {kind: 'dissolve'}},
      bibleTransitions: [
        {part: 1, transition: {kind: 'dissolve'}},
        {part: 1, transition: {kind: 'dissolve'}},
      ],
    });
  });
  await act(() => items.replayItemEdit('undo'));
  await waitFor(() => {
    const item = items.getSnapshot().item;
    expect(item).not.toHaveProperty('sectionCard.transition');
    expect(item).not.toHaveProperty('bibleTransitions');
  });
  view.unmount();
  items.dispose();
  await editor.dispose();
});
