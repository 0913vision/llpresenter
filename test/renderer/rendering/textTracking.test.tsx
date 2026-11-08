import {cleanup, render} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {sundaySectionLayout} from '@core/themes/sundaySections';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {SlideLayerView} from '@renderer/rendering/slideLayer';
import {ThemePicture} from '@renderer/rendering/ThemePicture';
import {classes} from '@renderer/rendering/classes';
import {bibleMeasure} from '@renderer/rendering/bibleMeasure';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {CONT_MARKER} from '@core/bible/split/layout';

afterEach(cleanup);

it('keeps short-name tracking and center compensation identical in output and thumbnails through text, scale and style changes', () => {
  const source = sundaySectionLayout().elements.find(
    element => element.kind === 'itemName',
  );
  if (source?.kind !== 'itemName') throw Error('Missing section name');
  const parent = document.createElement('div');
  const style = {...DEFAULT_TEXT_STYLE, ...source.text};
  const output = new SlideLayerView(parent, style);
  const picture = render(
    <ThemePicture
      background="#000000"
      elements={[source]}
      samples={{itemName: '찬양'}}
    />,
  );
  const block = () =>
    parent.querySelector<HTMLElement>(`.${classes.shown} .${classes.block}`);
  const thumb = () =>
    picture.container.querySelector<HTMLElement>('[style*="letter-spacing"]');
  output.show({itemId: 'card', position: 0, label: null, lines: ['찬양']});
  expect(block()?.style.letterSpacing).toBe('152px');
  expect(thumb()?.style.letterSpacing).toBe('152px');
  expect(block()?.style.textIndent).toBe('100px');
  expect(thumb()?.style.textIndent).toBe('100px');
  output.replaceLines(['찬', '양']);
  picture.rerender(
    <ThemePicture
      background="#000000"
      elements={[source]}
      samples={{itemName: '찬\n양'}}
    />,
  );
  expect(picture.getByText('양').parentElement?.style.textIndent).toBe('100px');
  expect(block()?.style.textIndent).toBe('100px');
  output.rescale(0.5);
  expect(block()?.style.letterSpacing).toBe('76px');
  expect(block()?.style.textIndent).toBe('50px');
  output.replaceLines(['합심기도']);
  picture.rerender(
    <ThemePicture
      background="#000000"
      elements={[source]}
      samples={{itemName: '합심기도'}}
    />,
  );
  expect(block()?.style.letterSpacing).toBe('26px');
  expect(thumb()?.style.letterSpacing).toBe('52px');
  expect(block()?.style.textIndent).toBe('0px');
  output.replaceLines(['봉헌']);
  output.setStyle({...style, shortTracking: {maxCharacters: 2, tracking: 160}});
  expect(block()?.style.letterSpacing).toBe('80px');
  expect(block()?.style.textIndent).toBe('54px');
  const {shortTracking: _shortTracking, ...plain} = style;
  output.setStyle(plain);
  picture.rerender(
    <ThemePicture
      background="#000000"
      elements={[{...source, text: plain}]}
      samples={{itemName: '봉헌'}}
    />,
  );
  expect(block()?.style.letterSpacing).toBe('26px');
  expect(block()?.style.textIndent).toBe('0px');
  expect(thumb()?.style.letterSpacing).toBe('52px');
  output.dispose();
});

it('includes short-text spacing in Bible measurement when that option is explicitly enabled', () => {
  const source = sundaySectionLayout().elements.find(
    element => element.kind === 'currentText',
  );
  if (source?.kind !== 'currentText') throw Error('Missing text');
  const layout = bibleMeasure(
    {
      ...source,
      frame: {x: 0, y: 0, w: 1920, h: 1080},
      text: {
        ...source.text,
        tracking: 52,
        shortTracking: {maxCharacters: 2, tracking: 152},
      },
    },
    {font: '', measureText: value => ({width: Array.from(value).length * 10})},
  );
  expect(
    layout.measure('점검', {...layout.spec, marker: '', markerSize: 20})
      .lineWidths,
  ).toEqual([172]);
});

it.each([
  {
    text: '가나 다라',
    continued: false,
    widths: [24, 24],
    width: 60,
    maxCharacters: 4,
  },
  {
    text: '가 나 다라',
    continued: false,
    widths: [38, 24],
    width: 60,
    maxCharacters: 4,
  },
  {
    text: '가나 다라',
    continued: true,
    widths: [24, 24, 52],
    width: 60,
    maxCharacters: 4,
  },
  {
    text: '가 나 다라',
    continued: true,
    widths: [38, 24, 52],
    width: 60,
    maxCharacters: 4,
  },
  {
    text: '가나다라 마',
    continued: true,
    widths: [52, 76],
    width: 76,
    maxCharacters: 5,
  },
])(
  'keeps measured spacing through wrapping and continuation: $text / $continued',
  ({text, continued, widths, width, maxCharacters}) => {
    const source = sundaySectionLayout().elements.find(
      element => element.kind === 'currentText',
    );
    if (source?.kind !== 'currentText') throw Error('Missing text');
    const element = {
      ...source,
      frame: {x: 0, y: 0, w: width, h: 300},
      text: {
        ...source.text,
        size: 36,
        tracking: 0,
        maxLines: 4,
        shortTracking: {maxCharacters, tracking: 4},
      },
    };
    const layout = bibleMeasure(element, {
      font: '',
      measureText: value => ({width: Array.from(value).length * 10}),
    });
    const measured = layout.measure(text, {
      ...layout.spec,
      marker: continued ? CONT_MARKER : '',
      markerSize: 28,
    });
    expect(measured.lines).toHaveLength(widths.length);
    expect(measured.lineWidths).toEqual(widths);
    expect(measured.fits).toBe(true);
    const slide = {
      itemId: 'measured',
      position: 0,
      label: null,
      lines: measured.lines,
      biblePart: 1,
      continued,
    };
    const parent = document.createElement('div');
    const output = new SlideLayerView(parent, {
      ...DEFAULT_TEXT_STYLE,
      ...element.text,
    });
    output.show(slide);
    const picture = render(
      <SlidePicture
        slide={slide}
        layout={{mode: {kind: 'own'}, elements: [element]}}
      />,
    );
    const block = parent.querySelector<HTMLElement>(
      `.${classes.shown} .${classes.block}`,
    );
    const thumbnail = picture.container.querySelector<HTMLElement>(
      '[style*="letter-spacing"]',
    );
    expect(block?.style.letterSpacing).toBe('4px');
    expect(thumbnail?.style.letterSpacing).toBe('4px');
    expect(block?.style.fontSize).toBe('36px');
    expect(thumbnail?.style.fontSize).toBe('36px');
    expect(
      Array.from(block?.children ?? []).map(row => row.textContent),
    ).toEqual(measured.lines);
    if (continued) {
      expect(
        block?.querySelector('[data-bible-continuation]')?.textContent.trim(),
      ).toBe('(계속)');
      expect(picture.getByText('(계속)').style.fontSize).toBe('28px');
    }
    picture.rerender(
      <ThemePicture
        background="#000000"
        elements={[element]}
        samples={{currentText: 'An unrelated editor sample'}}
        measuredText={{lines: measured.lines, continued, part: 1}}
      />,
    );
    expect(
      picture.container.querySelector<HTMLElement>('[style*="letter-spacing"]')
        ?.style.letterSpacing,
    ).toBe('4px');
    output.dispose();
  },
);
