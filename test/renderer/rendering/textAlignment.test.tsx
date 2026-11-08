import {cleanup, render} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {
  sundaySectionLayout,
  SECTION_THEME_ID,
} from '@core/themes/sundaySections';
import {themeTextVAlign} from '@core/themes/textAlignment';
import {createScreenId} from '@core/schema/ids';
import {emptyLayers} from '@core/live/state';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {ThemeCompositionView} from '@renderer/rendering/themeComposition';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {classes} from '@renderer/rendering/classes';
import {mediaUrl} from '@contracts/ipc/mediaUrls';

afterEach(cleanup);

it('centers the same item name only while its English line is empty in output and thumbnails', () => {
  const source = sundaySectionLayout();
  const layout = {
    ...source,
    elements: source.elements.filter(
      element => element.kind === 'itemName' || element.kind === 'currentText',
    ),
  };
  const item = {
    id: 'meditation',
    kind: 'blank' as const,
    source: 'service' as const,
    title: '묵상기도',
  };
  const screen = {
    id: createScreenId('00000000-0000-4000-8000-000000000001'),
    kind: 'audience' as const,
  };
  const frame = {
    screen,
    transitions: false,
    theme: {
      layout,
      item,
      sourceScreenId: screen.id,
      emptyColor: '#000000',
      themeId: SECTION_THEME_ID,
      revision: 0,
      missing: [],
    },
  };
  const root = document.createElement('div');
  const output = new ThemeCompositionView(root, {
    textStyle: DEFAULT_TEXT_STYLE,
    mediaUrl,
    onError: vi.fn(),
  });
  const slide = {itemId: item.id, position: 0, label: null, lines: ['English']};
  const picture = render(
    <SlidePicture slide={slide} layout={layout} item={item} />,
  );
  let namePage: Element | null = null;
  for (const [text, expected] of [
    ['English', 'flex-start'],
    ['', 'center'],
    [' \n ', 'center'],
    ['English again', 'flex-start'],
  ] as const) {
    const current = {...slide, lines: [text]};
    output.render({...emptyLayers(), slide: current}, frame);
    const page = root.querySelector<HTMLElement>(
      `[data-kind="itemName"] .${classes.shown}`,
    );
    expect(page?.style.justifyContent).toBe(expected);
    if (namePage !== null) expect(page).toBe(namePage);
    namePage = page;
    picture.rerender(
      <SlidePicture slide={current} layout={layout} item={item} />,
    );
    expect(
      picture
        .getByText(item.title)
        .closest<HTMLElement>('[style*="justify-content"]')?.style
        .justifyContent,
    ).toBe(expected);
  }
  output.dispose();
});

it('leaves ordinary item-name alignment unchanged when the option is absent or off', () => {
  const source = sundaySectionLayout().elements.find(
    element => element.kind === 'itemName',
  );
  if (source?.kind !== 'itemName') throw Error('Missing name');
  const {centerWhenTextEmpty: _centerWhenTextEmpty, ...plain} = source;
  expect(themeTextVAlign(plain, '')).toBe('top');
  expect(themeTextVAlign({...source, centerWhenTextEmpty: false}, '')).toBe(
    'top',
  );
  expect(themeTextVAlign(source, 'English')).toBe('top');
});
