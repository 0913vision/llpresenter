import {checkPart} from '@core/schema/fileFormat';
import {
  songLyricFormatSchema,
  type SongLyricFormat,
} from '@core/schema/songLyricFormat';
import {children, descendants, named} from './powerpointXml';

type Xml = Element | undefined;
const child = (element: Xml, name: string): Xml =>
  element && named(element, name)[0];
const firstValue = (
  elements: readonly Xml[],
  name: string,
): string | undefined => {
  for (const element of elements) {
    const value = element?.getAttribute(name);
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return undefined;
};
const index = (shape: Element): string =>
  descendants(shape, 'ph')[0]?.getAttribute('idx') ?? '0';
const bodyShapes = (root: Xml): Element[] =>
  root
    ? descendants(root, 'sp').filter(shape => {
        const ph = descendants(shape, 'ph')[0];
        const type = ph?.getAttribute('type') ?? '';
        return (
          ph !== undefined && (type === '' || type === 'body' || type === 'obj')
        );
      })
    : [];

/** Resolve paragraph and run typography through matching layout and master placeholders. */
export function powerpointTextFormat(
  shape: Element,
  {layout, master, theme}: {layout: Xml; master: Xml; theme: Xml},
  slideWidth: number,
): SongLyricFormat | undefined {
  const parent = bodyShapes(layout).find(
    candidate => index(candidate) === index(shape),
  );
  const masterShape = bodyShapes(master).find(
    candidate =>
      descendants(candidate, 'ph')[0]?.getAttribute('type') === 'body',
  );
  const inherited = [parent, masterShape];
  const shapeWidth = [shape, ...inherited]
    .map(candidate =>
      child(child(child(candidate, 'spPr'), 'xfrm'), 'ext')?.getAttribute('cx'),
    )
    .find(value => value !== null && value !== undefined);
  const boxWidth = (Number(shapeWidth) * 1920) / slideWidth;
  if (!(boxWidth > 0)) return undefined;
  const body = child(shape, 'txBody');
  if (!body) return undefined;
  const points = (1920 * 12700) / slideWidth;
  const origin = [shape, ...inherited]
    .map(candidate =>
      child(child(child(candidate, 'spPr'), 'xfrm'), 'off')?.getAttribute('y'),
    )
    .find(value => value !== null && value !== undefined);
  const originX = [shape, ...inherited]
    .map(candidate =>
      child(child(child(candidate, 'spPr'), 'xfrm'), 'off')?.getAttribute('x'),
    )
    .find(value => value !== null && value !== undefined && value !== '');
  const left =
    originX === undefined ? undefined : (Number(originX) * 1920) / slideWidth;
  const bodyProps = child(body, 'bodyPr');
  const insetValue = bodyProps?.getAttribute('tIns');
  const inset = insetValue ? Number(insetValue) : 45720;
  let top =
    origin === undefined
      ? undefined
      : ((Number(origin) + inset) * 1920) / slideWidth;
  const lines: Array<{
    boxWidth: number;
    left?: number;
    top?: number;
    runs: Array<{
      text: string;
      size?: number;
      tracking?: number;
      weight?: number;
      font?: string;
    }>;
    spacing?: {kind: 'ratio' | 'pixels'; value: number};
    paragraphGap?: number;
  }> = [];
  let previousAfter = 0;
  for (const [paragraphIndex, paragraph] of named(body, 'p').entries()) {
    const properties = child(paragraph, 'pPr');
    const level = Math.max(
      1,
      Math.min(9, Number(properties?.getAttribute('lvl') ?? 0) + 1),
    );
    const levelName = `lvl${level}pPr`;
    const style = (candidate: Xml): Xml =>
      child(child(child(candidate, 'txBody'), 'lstStyle'), levelName);
    const ancestorParagraph = (candidate: Xml): Xml =>
      child(child(candidate, 'txBody'), 'p');
    const inheritedProperties = inherited.flatMap(candidate => [
      child(ancestorParagraph(candidate), 'pPr'),
      style(candidate),
    ]);
    const masterLevel = master && descendants(master, 'bodyStyle')[0];
    const baseLevel = child(masterLevel, levelName);
    const paragraphProps = [
      properties,
      style(shape),
      ...inheritedProperties,
      baseLevel,
    ];
    const spacingNode = paragraphProps
      .map(value => child(value, 'lnSpc'))
      .find(value => value !== undefined);
    const pct = child(spacingNode, 'spcPct')?.getAttribute('val');
    const pts = child(spacingNode, 'spcPts')?.getAttribute('val');
    const spacing = pct
      ? {kind: 'ratio' as const, value: (Number(pct) / 100000) * 1.2}
      : pts
        ? {kind: 'pixels' as const, value: (Number(pts) / 100) * points}
        : undefined;
    const paragraphSpacing = (name: string, size: number): number => {
      const node = paragraphProps
        .map(value => child(value, name))
        .find(value => value !== undefined);
      const pctValue = child(node, 'spcPct')?.getAttribute('val');
      const ptsValue = child(node, 'spcPts')?.getAttribute('val');
      return pctValue
        ? (Number(pctValue) / 100000) * size * 1.2
        : (Number(ptsValue ?? 0) / 100) * points;
    };
    let firstLine = true;
    let runs: Array<{
      text: string;
      size?: number;
      tracking?: number;
      weight?: number;
      font?: string;
    }> = [];
    const flush = (): void => {
      while (runs.length && runs[runs.length - 1]?.text.trimEnd() === '') {
        runs.pop();
      }
      const last = runs[runs.length - 1];
      if (last) last.text = last.text.trimEnd();
      const maxSize = Math.max(0, ...runs.map(run => run.size ?? 0));
      const gap =
        firstLine && paragraphIndex > 0
          ? previousAfter + paragraphSpacing('spcBef', maxSize)
          : 0;
      if (top !== undefined && runs.length) top += gap;
      if (runs.length) {
        lines.push({
          boxWidth,
          ...(left === undefined ? {} : {left}),
          ...(top === undefined ? {} : {top}),
          runs,
          ...(spacing === undefined ? {} : {spacing}),
          ...(gap === 0 ? {} : {paragraphGap: gap}),
        });
      }
      if (top !== undefined && runs.length) {
        top +=
          spacing?.kind === 'pixels'
            ? spacing.value
            : maxSize * (spacing?.value ?? 1.2);
      }
      if (runs.length) {
        previousAfter = paragraphSpacing('spcAft', maxSize);
        firstLine = false;
      }
      runs = [];
    };
    for (const part of children(paragraph)) {
      if (part.localName === 'br') {
        flush();
        continue;
      }
      if (part.localName !== 'r' && part.localName !== 'fld') continue;
      const text = named(part, 't')
        .map(node => node.textContent)
        .join('');
      if (!text) continue;
      const props = [
        child(part, 'rPr'),
        ...paragraphProps.map(value => child(value, 'defRPr')),
      ];
      const size = firstValue(props, 'sz');
      const tracking = firstValue(props, 'spc');
      const bold = firstValue(props, 'b');
      const font = props
        .flatMap(value => [child(value, 'ea'), child(value, 'latin')])
        .map(value => value?.getAttribute('typeface'))
        .find(value => value);
      const fontScheme = theme && descendants(theme, 'fontScheme')[0];
      const themeFont = font?.startsWith('+')
        ? child(
            child(
              fontScheme,
              font.startsWith('+mj') ? 'majorFont' : 'minorFont',
            ),
            font.endsWith('-ea') ? 'ea' : 'latin',
          )?.getAttribute('typeface')
        : undefined;
      const resolvedFont = font?.startsWith('+') ? themeFont : font;
      runs.push({
        text,
        ...(size === undefined ? {} : {size: (Number(size) / 100) * points}),
        ...(tracking === undefined
          ? {}
          : {tracking: (Number(tracking) / 100) * points}),
        ...(bold === undefined
          ? {}
          : {weight: bold === '1' || bold === 'true' ? 700 : 400}),
        ...(resolvedFont ? {font: resolvedFont} : {}),
      });
    }
    flush();
  }
  if (!lines.length) return undefined;
  const result = checkPart(songLyricFormatSchema, {lines});
  return result.ok ? result.value : undefined;
}
