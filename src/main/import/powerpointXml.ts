import {posix} from 'node:path';
import {DOMParser} from '@xmldom/xmldom';
import {POWERPOINT_IMPORT_LIMITS} from '@core/songs/textImportLimits';
import type {PowerPointZip} from './powerpointZip';

export function children(node: Node): Element[] {
  return Array.from(node.childNodes).filter(
    (child): child is Element => child.nodeType === 1,
  );
}
export function named(node: Node, name: string): Element[] {
  return children(node).filter(child => child.localName === name);
}
export function descendants(node: Node, name: string): Element[] {
  return children(node).flatMap(child => [
    ...(child.localName === name ? [child] : []),
    ...descendants(child, name),
  ]);
}
export function xml(zip: PowerPointZip, name: string): Document {
  const bytes = zip.read(name);
  if (bytes === undefined || bytes.length > POWERPOINT_IMPORT_LIMITS.xmlBytes) {
    throw new Error('Missing or oversized PowerPoint XML');
  }
  const content = bytes.toString('utf8');
  if (/<!DOCTYPE/i.test(content)) throw new Error('Invalid PowerPoint XML');
  return new DOMParser({
    errorHandler: () => {
      throw new Error('Invalid PowerPoint XML');
    },
  }).parseFromString(content, 'application/xml');
}
export interface PowerPointRelationship {
  readonly target: string;
  readonly type: string;
}
export function relationships(
  zip: PowerPointZip,
  part: string,
): Map<string, PowerPointRelationship> {
  const name = posix.join(
    posix.dirname(part),
    '_rels',
    `${posix.basename(part)}.rels`,
  );
  if (zip.read(name) === undefined) return new Map();
  return new Map(
    descendants(xml(zip, name), 'Relationship')
      .filter(e => e.getAttribute('TargetMode') !== 'External')
      .map(e => {
        const target = e.getAttribute('Target') ?? '';
        return [
          e.getAttribute('Id') ?? '',
          {
            target: posix.normalize(
              target.startsWith('/')
                ? target.slice(1)
                : posix.join(posix.dirname(part), target),
            ),
            type: e.getAttribute('Type') ?? '',
          },
        ];
      }),
  );
}
export function numberAttribute(
  node: Element | undefined,
  name: string,
  fallback = 0,
): number {
  const value = node?.getAttribute(name);
  if (value === null || value === undefined || value === '') return fallback;
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}
