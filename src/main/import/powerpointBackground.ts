import {createHash} from 'node:crypto';
import {DOMParser, XMLSerializer} from '@xmldom/xmldom';
import {children, descendants, named, numberAttribute} from './powerpointXml';
import type {PowerPointPart, PowerPointSlideParts} from './powerpointParts';

const DRAWN = new Set(['sp', 'pic', 'grpSp', 'cxnSp', 'graphicFrame']);

function isText(shape: Element): boolean {
  return (
    shape.localName === 'sp' &&
    (descendants(shape, 'ph').length > 0 ||
      descendants(shape, 't').some(text => text.textContent.length > 0))
  );
}

/** Takes away what an export without text takes away. */
function withoutText(parent: Element): void {
  for (const shape of children(parent)) {
    if (shape.localName === 'grpSp') withoutText(shape);
    else if (isText(shape)) parent.removeChild(shape);
  }
}

/** What is drawn behind the texts of a part, and which pictures it uses. */
function drawnOf(part: PowerPointPart): string {
  const copy = new DOMParser().parseFromString(
    new XMLSerializer().serializeToString(part.root),
    'application/xml',
  ).documentElement;
  const tree = descendants(copy, 'spTree')[0];
  if (tree) withoutText(tree);
  for (const shape of descendants(copy, 'cNvPr')) {
    for (const name of ['id', 'name', 'descr']) shape.removeAttribute(name);
  }
  for (const extra of ['extLst', 'timing', 'transition']) {
    for (const node of descendants(copy, extra)) {
      node.parentNode?.removeChild(node);
    }
  }
  const background = descendants(copy, 'bg')
    .map(node => new XMLSerializer().serializeToString(node))
    .join('');
  const shapes = tree ? new XMLSerializer().serializeToString(tree) : '';
  const drawn = background + shapes;
  return drawn.replace(
    /r:(?:embed|link|id)="([^"]+)"/gu,
    (whole, id: string) => part.rels.get(id)?.target ?? whole,
  );
}

/** Names what is behind the texts of a slide; the same for the same picture. */
export function backgroundKey({
  slide,
  layout,
  master,
}: PowerPointSlideParts): string {
  const hash = createHash('sha256').update(drawnOf(slide));
  for (const part of [layout, master]) {
    if (part !== undefined) hash.update(part.path);
  }
  return hash.digest('hex');
}

function drawsShapes(part: PowerPointPart | undefined): boolean {
  const tree = part && descendants(part.root, 'spTree')[0];
  return (tree ? children(tree) : []).some(
    shape => DRAWN.has(shape.localName) && !isText(shape),
  );
}

function pictureIn(part: PowerPointPart, fill: Element): string | undefined {
  const blip = named(fill, 'blip')[0];
  if (blip === undefined || children(blip).some(isEffect)) return undefined;
  const crop = named(fill, 'srcRect')[0];
  const sides = ['l', 't', 'r', 'b'];
  if (sides.some(side => numberAttribute(crop, side) !== 0)) return undefined;
  const stretch = named(fill, 'stretch')[0];
  if (stretch === undefined) return undefined;
  const rect = named(stretch, 'fillRect')[0];
  if (sides.some(side => numberAttribute(rect, side) !== 0)) return undefined;
  return part.rels.get(blip.getAttribute('r:embed') ?? '')?.target;
}

function isEffect(node: Element): boolean {
  return node.localName !== 'extLst';
}

/** The picture a slide is, when nothing else is behind its texts. */
export function plainPicture(
  {slide, layout, master}: PowerPointSlideParts,
  size: {readonly width: number; readonly height: number},
): string | undefined {
  if (drawsShapes(layout) || drawsShapes(master)) return undefined;
  const tree = descendants(slide.root, 'spTree')[0];
  const shapes = (tree ? children(tree) : []).filter(
    shape => DRAWN.has(shape.localName) && !isText(shape),
  );
  const [only, more] = shapes;
  if (more !== undefined) return undefined;
  if (only === undefined) {
    const background = [slide, layout, master]
      .flatMap(part =>
        part === undefined
          ? []
          : descendants(part.root, 'bg').map(node => ({part, node})),
      )
      .at(0);
    if (background === undefined) return undefined;
    const fill = descendants(background.node, 'blipFill')[0];
    return fill && pictureIn(background.part, fill);
  }
  if (only.localName !== 'pic') return undefined;
  const transform = descendants(only, 'xfrm')[0];
  const off = transform && named(transform, 'off')[0];
  const extent = transform && named(transform, 'ext')[0];
  const near = (value: number, wanted: number, whole: number): boolean =>
    Math.abs(value - wanted) <= whole / 200;
  const fills =
    numberAttribute(transform, 'rot') === 0 &&
    near(numberAttribute(off, 'x'), 0, size.width) &&
    near(numberAttribute(off, 'y'), 0, size.height) &&
    near(numberAttribute(extent, 'cx'), size.width, size.width) &&
    near(numberAttribute(extent, 'cy'), size.height, size.height);
  const geometry = descendants(only, 'prstGeom')[0]?.getAttribute('prst');
  const plain =
    (geometry === undefined || geometry === null || geometry === 'rect') &&
    descendants(only, 'effectLst').length === 0 &&
    descendants(only, 'flipH').length === 0 &&
    transform?.getAttribute('flipH') !== '1' &&
    transform?.getAttribute('flipV') !== '1';
  const fill = named(only, 'blipFill')[0];
  return fills && plain && fill ? pictureIn(slide, fill) : undefined;
}
