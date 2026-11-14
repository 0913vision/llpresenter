import {powerpointTextFormat} from './powerpointTextFormat';
import {createHash} from 'node:crypto';
import {
  POWERPOINT_BACKGROUND_LIMITS as LIMITS,
  type PowerPointFill,
  type PowerPointLayer,
  type PowerPointLayers,
  type PowerPointMatrix,
  type PowerPointScene,
} from '@core/songs/powerpointLayers';
import {
  fillColor,
  resolveColor,
  insets,
  readFill,
  type PowerPointPalette,
} from './powerpointColors';
import {groupTransform, multiply, shapeTransform} from './powerpointTransform';
import {
  children,
  descendants,
  named,
  numberAttribute,
  relationships,
  xml,
} from './powerpointXml';
import type {PowerPointZip} from './powerpointZip';
import {boundedPowerPointImage} from './powerpointImage';

interface Part {
  readonly path: string;
  readonly root: Element;
  readonly rels: ReturnType<typeof relationships>;
}
interface Context {
  readonly part: Part;
  readonly palette: PowerPointPalette;
  readonly theme: Element | undefined;
  readonly matrix: PowerPointMatrix;
  readonly scope: string;
}
const DEFAULT_MAPPING = new Map([
  ['bg1', 'lt1'],
  ['tx1', 'dk1'],
  ['bg2', 'lt2'],
  ['tx2', 'dk2'],
]);
const isOff = (value: string | null) => value === '0' || value === 'false';

/** Resolves XML into bounded drawing data without using a graphics API. */
export class PowerPointLayerReader {
  private readonly parts = new Map<string, Part>();
  constructor(private readonly zip: PowerPointZip) {}

  private part(path: string): Part {
    const cached = this.parts.get(path);
    if (cached) return cached;
    const part = {
      path,
      root: xml(this.zip, path).documentElement,
      rels: relationships(this.zip, path),
    };
    this.parts.set(path, part);
    return part;
  }

  private related(part: Part | undefined, kind: string): Part | undefined {
    const rel =
      part &&
      [...part.rels.values()].find(item => item.type.endsWith(`/${kind}`));
    return rel ? this.part(rel.target) : undefined;
  }

  private palette(
    parts: readonly Part[],
    theme: Element | undefined,
  ): PowerPointPalette {
    const colors = new Map<string, Element>();
    const scheme = theme && descendants(theme, 'clrScheme')[0];
    if (scheme) {
      for (const entry of children(scheme)) {
        const color = children(entry)[0];
        if (color) colors.set(entry.localName, color);
      }
    }
    let mapping = new Map(DEFAULT_MAPPING);
    let masterMapping = new Map(mapping);
    for (const part of parts) {
      const override = named(part.root, 'clrMapOvr')[0];
      if (override && named(override, 'masterClrMapping').length > 0) {
        mapping = new Map(masterMapping);
        continue;
      }
      const map =
        (override && named(override, 'overrideClrMapping')[0]) ??
        named(part.root, 'clrMap')[0];
      if (!map) continue;
      for (const attr of Array.from(map.attributes)) {
        mapping.set(attr.name, attr.value);
      }
      if (part.root.localName === 'sldMaster') masterMapping = new Map(mapping);
    }
    return {colors, mapping};
  }

  lyricFormat(path: string, shape: Element, width: number) {
    const slide = this.part(path);
    const layout = this.related(slide, 'slideLayout');
    const master = this.related(layout, 'slideMaster');
    return powerpointTextFormat(
      shape,
      {
        layout: layout?.root,
        master: master?.root,
        theme: this.related(master, 'theme')?.root,
      },
      width,
    );
  }

  lyricColor(path: string): number | null {
    const slide = this.part(path);
    const layout = this.related(slide, 'slideLayout');
    const master = this.related(layout, 'slideMaster');
    const theme = this.related(master, 'theme')?.root;
    const parts = [master, layout, slide].filter(
      (part): part is Part => part !== undefined,
    );
    const palette = this.palette(parts, theme);
    const isBodyShape = (shape: Element): boolean => {
      const ph = descendants(shape, 'ph')[0];
      const type = ph?.getAttribute('type') ?? '';
      return (
        ph !== undefined && (type === '' || type === 'body' || type === 'obj')
      );
    };
    const bodyShapes = (root: Element | undefined): Element[] =>
      root ? descendants(root, 'sp').filter(isBodyShape) : [];
    const slideShape = bodyShapes(slide.root).find(shape =>
      descendants(shape, 't').some(
        text => text.textContent.trimEnd().length > 0,
      ),
    );
    if (!slideShape) return null;
    const placeholderIndex = (shape: Element): string => {
      const value = descendants(shape, 'ph')[0]?.getAttribute('idx');
      if (value === '') return '0';
      return value ?? '0';
    };
    const index = placeholderIndex(slideShape);
    const layoutShape = bodyShapes(layout?.root).find(
      shape => placeholderIndex(shape) === index,
    );
    const masterShape = bodyShapes(master?.root).find(
      shape => descendants(shape, 'ph')[0]?.getAttribute('type') === 'body',
    );
    const shapeColor = (shape: Element | undefined): Element | undefined => {
      if (!shape) return undefined;
      const body = named(shape, 'txBody')[0];
      if (!body) return undefined;
      const paragraph = named(body, 'p')[0];
      const run = paragraph && named(paragraph, 'r')[0];
      const level = descendants(body, 'lvl1pPr')[0];
      const props = [
        run && named(run, 'rPr')[0],
        paragraph &&
          named(named(paragraph, 'pPr')[0] ?? paragraph, 'defRPr')[0],
        level && named(level, 'defRPr')[0],
      ];
      return props.flatMap(prop => (prop ? named(prop, 'solidFill') : []))[0];
    };
    const bodyStyle = master && descendants(master.root, 'bodyStyle')[0];
    const defaultProps = bodyStyle && descendants(bodyStyle, 'lvl1pPr')[0];
    const defaultRun = defaultProps && named(defaultProps, 'defRPr')[0];
    const fill =
      shapeColor(slideShape) ??
      shapeColor(layoutShape) ??
      shapeColor(masterShape) ??
      (defaultRun && named(defaultRun, 'solidFill')[0]);
    const node =
      fill && children(fill).find(child => child.localName.endsWith('Clr'));
    if (!node) return null;
    const color = resolveColor(node, palette);
    return (
      Math.round(color.r * 255) * 65536 +
      Math.round(color.g * 255) * 256 +
      Math.round(color.b * 255)
    );
  }

  read(
    path: string,
    size: {readonly width: number; readonly height: number},
  ): PowerPointLayers {
    const slide = this.part(path);
    const layout = this.related(slide, 'slideLayout');
    const master = this.related(layout, 'slideMaster');
    const theme = this.related(master, 'theme')?.root;
    const parts = [master, layout, slide].filter(
      (part): part is Part => part !== undefined,
    );
    const palette = this.palette(parts, theme);
    const matrix = {
      a: LIMITS.width / size.width,
      b: 0,
      c: 0,
      d: LIMITS.height / size.height,
      e: 0,
      f: 0,
    };
    const layers: PowerPointLayer[] = [];
    let skipped = 0;
    const append = (layer: PowerPointLayer | null) => {
      if (!layer) return;
      if (layers.length < LIMITS.layers) layers.push(layer);
      else skipped++;
    };
    const backgroundPart = [...parts]
      .reverse()
      .find(part => descendants(part.root, 'bg')[0]);
    if (backgroundPart) {
      append(
        this.background(
          {part: backgroundPart, palette, theme, matrix, scope: 'background'},
          size,
        ),
      );
    }
    for (const part of parts) {
      if (
        part === master &&
        (isOff(slide.root.getAttribute('showMasterSp')) ||
          isOff(layout?.root.getAttribute('showMasterSp') ?? null))
      ) {
        continue;
      }
      const scope = part === slide ? 'slide' : part.path;
      const tree = descendants(part.root, 'spTree')[0];
      if (!tree) continue;
      const context = {part, palette, theme, matrix, scope};
      const unsupported = this.walk(tree, context, append);
      skipped += unsupported;
    }
    const key = createHash('sha256')
      .update(JSON.stringify(layers))
      .digest('hex');
    return {key, layers, skipped};
  }

  scene(
    path: string,
    size: {readonly width: number; readonly height: number},
  ): PowerPointScene {
    const result = this.read(path, size);
    const pictures: Array<PowerPointScene['pictures'][number]> = [];
    const seen = new Set<string>();
    let total = 0;
    const layers = result.layers.filter(layer => {
      if (layer.kind !== 'picture') return true;
      if (seen.has(layer.part)) return true;
      const bytes = this.zip.read(layer.part, LIMITS.imageBytes);
      if (
        !bytes ||
        !boundedPowerPointImage(bytes) ||
        total + bytes.length > LIMITS.totalImageBytes
      ) {
        return false;
      }
      total += bytes.length;
      seen.add(layer.part);
      pictures.push({
        part: layer.part,
        mime: /\.png$/i.test(layer.part) ? 'image/png' : 'image/jpeg',
        bytes: new Uint8Array(bytes),
      });
      return true;
    });
    return {
      ...result,
      layers,
      pictures,
      skipped: result.skipped + result.layers.length - layers.length,
    };
  }

  private walk(
    tree: Element,
    context: Context,
    append: (layer: PowerPointLayer | null) => void,
  ): number {
    let skipped = 0;
    for (const shape of children(tree)) {
      if (shape.localName === 'grpSp') {
        const props = named(shape, 'grpSpPr')[0];
        const transform = props && named(props, 'xfrm')[0];
        skipped += this.walk(
          shape,
          {
            ...context,
            matrix: multiply(context.matrix, groupTransform(transform)),
          },
          append,
        );
        continue;
      }
      if (
        descendants(shape, 'ph').length ||
        descendants(shape, 't').some(text => text.textContent.trim())
      ) {
        continue;
      }
      if (shape.localName !== 'pic' && shape.localName !== 'sp') continue;
      const props = named(shape, 'spPr')[0];
      if (!props) continue;
      const xfrm = named(props, 'xfrm')[0];
      const matrix = multiply(context.matrix, shapeTransform(xfrm));
      if (
        !Object.values(matrix).every(Number.isFinite) ||
        matrix.a * matrix.d - matrix.b * matrix.c === 0
      ) {
        continue;
      }
      const id = `${context.scope}:${descendants(shape, 'cNvPr')[0]?.getAttribute('id') ?? ''}`;
      if (shape.localName === 'pic') {
        const fill = named(shape, 'blipFill')[0];
        const ext = xfrm && named(xfrm, 'ext')[0];
        append(
          fill
            ? this.picture(
                fill,
                {...context, matrix},
                {
                  id,
                  size: {
                    width: numberAttribute(ext, 'cx', 1),
                    height: numberAttribute(ext, 'cy', 1),
                  },
                },
              )
            : null,
        );
        continue;
      }
      const geometry = named(props, 'prstGeom')[0]?.getAttribute('prst');
      if (
        geometry !== 'rect' &&
        geometry !== 'roundRect' &&
        geometry !== 'ellipse'
      ) {
        skipped++;
        continue;
      }
      const blipFill = named(props, 'blipFill')[0];
      const explicitFill = children(props).find(child =>
        child.localName.endsWith('Fill'),
      );
      if (
        explicitFill &&
        !['noFill', 'solidFill', 'gradFill', 'blipFill'].includes(
          explicitFill.localName,
        )
      ) {
        skipped++;
      }
      const fill = this.shapeFill(shape, props, context);
      const line = named(props, 'ln')[0];
      const lineFill = line ? readFill(line, context.palette) : null;
      if (!fill && !lineFill && !blipFill) continue;
      const adjustment = descendants(props, 'gd').find(
        gd => gd.getAttribute('name') === 'adj',
      );
      const radius =
        Number(
          adjustment?.getAttribute('fmla')?.replace(/^val\s+/, '') ?? 16667,
        ) / 100000;
      const ext = xfrm && named(xfrm, 'ext')[0];
      const width = numberAttribute(ext, 'cx', 1);
      const height = numberAttribute(ext, 'cy', 1);
      const shapeRadius = Math.max(
        0,
        Math.min(0.5, Number.isFinite(radius) ? radius : 1 / 6),
      );
      if (blipFill) {
        const picture = this.picture(
          blipFill,
          {...context, matrix},
          {id, size: {width, height}},
        );
        if (picture?.kind === 'picture') {
          append({...picture, geometry, radius: shapeRadius});
        } else {
          skipped++;
        }
      }
      if (!fill && !lineFill) continue;
      append({
        kind: 'shape',
        id,
        matrix,
        geometry,
        radius: shapeRadius,
        fill,
        outline: lineFill
          ? {
              width:
                numberAttribute(line, 'w', 12700) / Math.max(width, height),
              fill: lineFill,
            }
          : null,
      });
    }
    return skipped;
  }

  private shapeFill(
    shape: Element,
    props: Element,
    context: Context,
  ): PowerPointFill | null {
    if (children(props).some(child => child.localName.endsWith('Fill'))) {
      return readFill(props, context.palette);
    }
    const fill = readFill(props, context.palette);
    if (fill) return fill;
    const style = named(shape, 'style')[0];
    const ref = style && named(style, 'fillRef')[0];
    const list = context.theme && descendants(context.theme, 'fillStyleLst')[0];
    const target = list && children(list)[numberAttribute(ref, 'idx') - 1];
    if (!ref || !target) return null;
    return this.styleFill(target, {
      ...context.palette,
      placeholder: fillColor(ref, context.palette),
    });
  }

  private styleFill(
    node: Element,
    palette: PowerPointPalette,
  ): PowerPointFill | null {
    return readFill(node, palette);
  }

  private background(
    context: Context,
    size: {readonly width: number; readonly height: number},
  ): PowerPointLayer | null {
    const bg = descendants(context.part.root, 'bg')[0];
    if (!bg) return null;
    const props = named(bg, 'bgPr')[0];
    const matrix = multiply(context.matrix, {
      a: size.width,
      b: 0,
      c: 0,
      d: size.height,
      e: 0,
      f: 0,
    });
    const blipFill = props && named(props, 'blipFill')[0];
    if (blipFill) {
      return this.picture(
        blipFill,
        {...context, matrix},
        {id: 'background', size},
      );
    }
    let fill = props ? readFill(props, context.palette) : null;
    const ref = named(bg, 'bgRef')[0];
    if (ref) {
      const index = numberAttribute(ref, 'idx');
      const list =
        context.theme &&
        descendants(
          context.theme,
          index >= 1001 ? 'bgFillStyleLst' : 'fillStyleLst',
        )[0];
      const target =
        list && children(list)[index >= 1001 ? index - 1001 : index - 1];
      const placeholder = fillColor(ref, context.palette);
      fill = target
        ? this.styleFill(target, {...context.palette, placeholder})
        : {kind: 'solid', color: placeholder};
    }
    return fill
      ? {
          kind: 'shape',
          id: 'background',
          matrix,
          geometry: 'rect',
          radius: 0,
          fill,
          outline: null,
        }
      : null;
  }

  private picture(
    fill: Element,
    context: Context,
    {
      id,
      size,
    }: {
      readonly id: string;
      readonly size: {readonly width: number; readonly height: number};
    },
  ): PowerPointLayer | null {
    const blip = named(fill, 'blip')[0];
    const part = context.part.rels.get(
      blip?.getAttribute('r:embed') ?? '',
    )?.target;
    if (!blip || !part || !/\.(png|jpe?g)$/i.test(part)) return null;
    const stretch = named(fill, 'stretch')[0];
    const lum = named(blip, 'lum')[0];
    const tile = named(fill, 'tile')[0];
    const flip = tile?.getAttribute('flip');
    const align = tile?.getAttribute('algn');
    const bounded = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    return {
      kind: 'picture',
      id,
      matrix: context.matrix,
      part,
      crop: insets(named(fill, 'srcRect')[0]),
      stretch: insets(stretch ? named(stretch, 'fillRect')[0] : undefined),
      alpha: Math.max(
        0,
        Math.min(
          1,
          numberAttribute(named(blip, 'alphaModFix')[0], 'amt', 100000) /
            100000,
        ),
      ),
      brightness: numberAttribute(lum, 'bright') / 100000,
      contrast: numberAttribute(lum, 'contrast') / 100000,
      grayscale: named(blip, 'grayscl').length > 0,
      ...(tile && size.width > 0 && size.height > 0
        ? {
            tile: {
              scaleX:
                (bounded(
                  numberAttribute(tile, 'sx', 100000) / 100000,
                  0.001,
                  100,
                ) *
                  9525) /
                size.width,
              scaleY:
                (bounded(
                  numberAttribute(tile, 'sy', 100000) / 100000,
                  0.001,
                  100,
                ) *
                  9525) /
                size.height,
              offsetX: bounded(
                numberAttribute(tile, 'tx') / size.width,
                -100,
                100,
              ),
              offsetY: bounded(
                numberAttribute(tile, 'ty') / size.height,
                -100,
                100,
              ),
              flip:
                flip === 'x' || flip === 'y' || flip === 'xy' ? flip : 'none',
              align:
                align === 't' ||
                align === 'tr' ||
                align === 'l' ||
                align === 'ctr' ||
                align === 'r' ||
                align === 'bl' ||
                align === 'b' ||
                align === 'br'
                  ? align
                  : 'tl',
            },
          }
        : {}),
    };
  }
}
