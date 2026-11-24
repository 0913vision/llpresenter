import {relationships, xml} from './powerpointXml';
import type {PowerPointZip} from './powerpointZip';

/** One XML part of a presentation, with what it refers to. */
export interface PowerPointPart {
  readonly path: string;
  readonly root: Element;
  readonly rels: ReturnType<typeof relationships>;
}

/** A slide with the layout, master and theme it is drawn with. */
export interface PowerPointSlideParts {
  readonly slide: PowerPointPart;
  readonly layout: PowerPointPart | undefined;
  readonly master: PowerPointPart | undefined;
  readonly theme: PowerPointPart | undefined;
}

/** Reads the parts of a presentation once each. */
export class PowerPointParts {
  private readonly parts = new Map<string, PowerPointPart>();

  constructor(private readonly zip: PowerPointZip) {}

  part(path: string): PowerPointPart {
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

  slide(path: string): PowerPointSlideParts {
    const slide = this.part(path);
    const layout = this.related(slide, 'slideLayout');
    const master = this.related(layout, 'slideMaster');
    return {slide, layout, master, theme: this.related(master, 'theme')};
  }

  private related(
    part: PowerPointPart | undefined,
    kind: string,
  ): PowerPointPart | undefined {
    const rel =
      part &&
      [...part.rels.values()].find(item => item.type.endsWith(`/${kind}`));
    return rel ? this.part(rel.target) : undefined;
  }
}
