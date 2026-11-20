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
import {
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {OtherSlideInspector} from '@renderer/features/service/slideInspector/OtherSlideInspector';
import {useContext, useLayoutEffect, useRef, useSyncExternalStore} from 'react';
import {SongSession} from '@renderer/features/songs/editor/songSession';
import {editorDeckSong} from '@fixtures/renderer/features/songs/editor/editorFixture';
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
  SlidePicture: ({
    slide,
    mediaOnly,
    background,
  }: {
    slide: {label: string; sectionCard?: unknown};
    mediaOnly?: boolean;
    background?: string;
  }) => {
    const ready = useContext(PictureReadiness);
    const source = useRef({});
    useLayoutEffect(() => {
      ready?.(source.current);
    }, [ready]);
    if (mediaOnly) {
      return <div data-testid="media-picture" data-background={background} />;
    }
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
    | 'song-card'
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
          : kind === 'song-card'
            ? {
                id: itemId,
                song: editorDeckSong(1).song.id,
                slides: [],
                sectionCard: {
                  name: 'Opening',
                  english: 'WELCOME',
                  theme: createThemeId('00000000-0000-4000-8000-000000000100'),
                },
              }
            : kind === 'slide-card'
              ? {
                  id: itemId,
                  sectionCard: {
                    name: '예배 시작',
                    english: 'WELCOME',
                    theme: createThemeId(
                      '00000000-0000-4000-8000-000000000100',
                    ),
                  },
                  slides: {form: 'blank' as const, name: 'Section', slides: []},
                }
              : {
                  id: itemId,
                  media:
                    kind === 'image' ? fixtureMedia.warm : fixtureMedia.dawn,
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
  await userEvent.click(screen.getByRole('button', {name: '디졸브'}));
  await waitFor(() =>
    expect(items.getSnapshot().item).toMatchObject({
      sermon: {openingTransition: {kind: 'dissolve'}},
    }),
  );
  act(() => {
    items.setBibleSelection([2]);
    items.selectPosition(2);
  });
  await userEvent.click(screen.getByRole('button', {name: '밀어내기'}));
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
  expect(screen.getAllByTestId('card-picture')[0]?.textContent).toBe(
    '예배 시작',
  );
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
    expect(screen.getAllByTestId('media-picture')).toHaveLength(3);
    expect(
      screen
        .getAllByTestId('media-picture')[0]
        ?.getAttribute('data-background'),
    ).toBe(fixtureMedia[kind === 'image' ? 'warm' : 'dawn']);
    view.unmount();
    items.dispose();
    await editor.dispose();
  },
);
it('shows the selected Bible picture, label and transition picker', async () => {
  const {view, items, editor} = await setup('bible');
  expect(screen.getAllByTestId('bible-picture')[0]).toBeTruthy();
  expect(screen.getAllByText('1:1')).toHaveLength(4);
  expect(screen.getByLabelText('효과')).toBeTruthy();
  act(() => items.show(null));
  expect(screen.queryByTestId('bible-picture')).toBeNull();
  expect(screen.queryByText('1:1')).toBeNull();
  view.unmount();
  items.dispose();
  await editor.dispose();
});

it('stores a label on selected liturgy slides and undoes it as one edit', async () => {
  showTiles.value = [
    {label: null, labelColor: 'none', lines: ['First']},
    {label: null, labelColor: 'none', lines: ['Second']},
  ];
  const {view, items, editor} = await setup('creed');
  try {
    act(() => {
      items.setBibleSelection([0, 1]);
      items.selectPosition(1);
    });
    await userEvent.click(screen.getByRole('button', {name: '이름표'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '이름 적기…'}));
    await userEvent.type(
      screen.getByLabelText('이름 적기'),
      'New label{Enter}',
    );
    await waitFor(() => {
      const item = items.getSnapshot().item;
      if (item === null || !isItemOfKind(item, 'liturgy')) {
        throw Error('Missing liturgy');
      }
      expect(item.liturgy.labels).toEqual([
        {index: 0, label: 'New label'},
        {index: 1, label: 'New label'},
      ]);
    });
    await act(() => items.replayItemEdit('undo'));
    await waitFor(() => {
      const item = items.getSnapshot().item;
      if (item === null || !isItemOfKind(item, 'liturgy')) {
        throw Error('Missing liturgy');
      }
      expect(item.liturgy.labels).toBeUndefined();
    });
  } finally {
    showTiles.value = [];
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});

it.each(['sermon', 'bible-card', 'slide-card'] as const)(
  'stores an assigned label on the selected %s title',
  async kind => {
    const {view, items, editor} = await setup(kind);
    try {
      await userEvent.click(screen.getByRole('button', {name: '이름표'}));
      await userEvent.click(screen.getByRole('menuitem', {name: '이름 적기…'}));
      await userEvent.type(
        screen.getByLabelText('이름 적기'),
        'New label{Enter}',
      );
      await waitFor(() => {
        const item = items.getSnapshot().item;
        if (item === null) throw Error('Missing item');
        if (isItemOfKind(item, 'sermon')) {
          expect(item.sermon.openingLabel).toBe('New label');
        } else {
          expect('sectionCard' in item && item.sectionCard.label).toBe(
            'New label',
          );
        }
      });
    } finally {
      view.unmount();
      items.dispose();
      await editor.dispose();
    }
  },
);

it('stores a label for an image item', async () => {
  const {view, items, editor} = await setup('image');
  try {
    await userEvent.click(screen.getByRole('button', {name: '이름표'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '이름 적기…'}));
    await userEvent.type(screen.getByLabelText('이름 적기'), 'Picture{Enter}');
    await waitFor(() => {
      const item = items.getSnapshot().item;
      if (item === null || !isItemOfKind(item, 'media')) {
        throw Error('Missing media');
      }
      expect(item.slideLabel).toBe('Picture');
    });
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});

it('shows the Bible opening card and offsets verse positions past it', async () => {
  const {view, items, editor} = await setup('bible-card');
  expect(screen.getAllByTestId('card-picture')[0]?.textContent).toBe(
    '예배 시작',
  );
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(screen.queryByTestId('bible-picture')).toBeNull();
  act(() => items.selectPosition(1));
  expect(screen.getAllByTestId('bible-picture')[0]?.textContent).toBe('1:1');
  expect(screen.queryByTestId('card-picture')).toBeNull();
  act(() => items.selectPosition(2));
  expect(screen.getAllByTestId('bible-picture')[0]?.textContent).toBe('1:2');
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
  await userEvent.click(screen.getByRole('button', {name: '디졸브'}));
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

it.each(['bible', 'sermon', 'creed', 'prayer', 'bible-card'] as const)(
  'replays %s item transition history from a focused inspector control',
  async kind => {
    showTiles.value = [
      {label: null, labelColor: 'none', lines: ['First']},
      {label: null, labelColor: 'none', lines: ['Second']},
    ];
    const {view, items, editor} = await setup(kind);
    try {
      const before = structuredClone(items.getSnapshot().item);
      const effect = await screen.findByRole('button', {
        name: '밀어내기',
      });
      await userEvent.click(effect);
      let changed: typeof before = null;
      await waitFor(() => {
        changed = structuredClone(items.getSnapshot().item);
        expect(changed).not.toEqual(before);
      });
      effect.focus();
      expect(document.activeElement).toBe(effect);
      fireEvent.keyDown(effect, {key: 'z', ctrlKey: true});
      await waitFor(() => expect(items.getSnapshot().item).toEqual(before));
      fireEvent.keyDown(effect, {key: 'y', ctrlKey: true});
      await waitFor(() => expect(items.getSnapshot().item).toEqual(changed));
    } finally {
      showTiles.value = [];
      view.unmount();
      items.dispose();
      await editor.dispose();
    }
  },
);

it('replays a song card transition through draft history from a focused inspector control', async () => {
  const {view, items, editor, fixture} = await setup('song-card');
  const session = new SongSession({
    document: {...editorDeckSong(1), itemCardTransition: null},
    api: fixture.api.content,
    changed: () => undefined,
    problem: () => undefined,
    persistence: 'manual',
    itemSession: true,
  });
  function DraftInspector() {
    const model = useSyncExternalStore(
      session.slideModel.subscribe,
      session.slideModel.getSnapshot,
    );
    return (
      <OtherSlideInspector
        items={items}
        editor={editor}
        cardTransition={model.context?.cardTransition}
        changeSelected={change => session.changeItemTransitions(change, true)}
        replayDraft={action => session.edit(action)}
      />
    );
  }
  try {
    view.rerender(<DraftInspector />);
    const effect = await screen.findByRole('button', {
      name: '디졸브',
    });
    await userEvent.click(effect);
    expect(session.slideModel.getSnapshot().context?.cardTransition?.kind).toBe(
      'dissolve',
    );
    effect.focus();
    expect(document.activeElement).toBe(effect);
    fireEvent.keyDown(effect, {key: 'z', ctrlKey: true});
    expect(session.slideModel.getSnapshot().context?.cardTransition).toBeNull();
    fireEvent.keyDown(effect, {key: 'y', ctrlKey: true});
    expect(session.slideModel.getSnapshot().context?.cardTransition?.kind).toBe(
      'dissolve',
    );
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});
