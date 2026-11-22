import {paletteOf, resolveColor} from './powerpointColors';
import {children, descendants, named} from './powerpointXml';
import type {PowerPointSlideParts} from './powerpointParts';

function bodyShapes(root: Element | undefined): readonly Element[] {
  return (root ? descendants(root, 'sp') : []).filter(shape => {
    const ph = descendants(shape, 'ph')[0];
    const type = ph?.getAttribute('type') ?? '';
    return ph !== undefined && ['', 'body', 'obj'].includes(type);
  });
}

function placeOf(shape: Element): string {
  return descendants(shape, 'ph')[0]?.getAttribute('idx') ?? '0';
}

function fillOf(shape: Element | undefined): Element | undefined {
  const body = shape && named(shape, 'txBody')[0];
  if (!body) return undefined;
  const paragraph = named(body, 'p')[0];
  const run = paragraph && named(paragraph, 'r')[0];
  const level = descendants(body, 'lvl1pPr')[0];
  return [
    run && named(run, 'rPr')[0],
    paragraph && named(named(paragraph, 'pPr')[0] ?? paragraph, 'defRPr')[0],
    level && named(level, 'defRPr')[0],
  ].flatMap(props => (props ? named(props, 'solidFill') : []))[0];
}

/** The color of the text of a slide, as RGB; null when it says none. */
export function textColorOf({
  slide,
  layout,
  master,
  theme,
}: PowerPointSlideParts): number | null {
  const own =
    bodyShapes(slide.root).find(shape =>
      descendants(shape, 't').some(text => text.textContent.trim() !== ''),
    ) ??
    descendants(slide.root, 'sp').find(shape =>
      descendants(shape, 't').some(text => text.textContent.trim() !== ''),
    );
  if (!own) return null;
  const place = placeOf(own);
  const inLayout = bodyShapes(layout?.root).find(
    shape => placeOf(shape) === place,
  );
  const inMaster = bodyShapes(master?.root).find(
    shape => descendants(shape, 'ph')[0]?.getAttribute('type') === 'body',
  );
  const style = master && descendants(master.root, 'bodyStyle')[0];
  const level = style && descendants(style, 'lvl1pPr')[0];
  const run = level && named(level, 'defRPr')[0];
  const fill =
    fillOf(own) ??
    fillOf(inLayout) ??
    fillOf(inMaster) ??
    (run && named(run, 'solidFill')[0]);
  const node =
    fill && children(fill).find(child => child.localName.endsWith('Clr'));
  if (!node) return null;
  const parts = [master, layout, slide].flatMap(part =>
    part === undefined ? [] : [part.root],
  );
  const color = resolveColor(node, paletteOf(parts, theme?.root));
  return (
    Math.round(color.r * 255) * 65536 +
    Math.round(color.g * 255) * 256 +
    Math.round(color.b * 255)
  );
}
