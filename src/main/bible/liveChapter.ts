import {parse, type DefaultTreeAdapterTypes} from 'parse5';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;

function element(node: Node): node is Element {
  return 'tagName' in node;
}

function attribute(node: Element, name: string): string | undefined {
  return node.attrs.find(attr => attr.name === name)?.value;
}

function findElement(
  node: Node,
  predicate: (value: Element) => boolean,
): Element | undefined {
  if (element(node) && predicate(node)) return node;
  if (!('childNodes' in node)) return undefined;
  for (const child of node.childNodes) {
    const result = findElement(child, predicate);
    if (result) return result;
  }
  return undefined;
}

function content(node: Node, clean = false): string {
  if (
    element(node) &&
    clean &&
    (node.tagName === 'div' ||
      (node.tagName === 'font' && attribute(node, 'size') === '2'))
  ) {
    return '';
  }
  if (node.nodeName === '#text' && 'value' in node) return node.value;
  return 'childNodes' in node
    ? node.childNodes.map(child => content(child, clean)).join('')
    : '';
}

export function parseLiveChapter(html: string): readonly string[] | null {
  const container = findElement(
    parse(html),
    node => attribute(node, 'id') === 'tdBible1',
  );
  if (!container) return null;
  const direct = container.childNodes.filter(
    node => element(node) && node.tagName === 'span',
  );
  const elements = direct.length
    ? direct
    : container.childNodes.flatMap(node =>
        element(node) && node.tagName === 'f'
          ? node.childNodes.filter(
              child => element(child) && child.tagName === 'span',
            )
          : [],
      );
  if (elements.length === 0) return null;
  const verses: string[] = [];
  for (const verse of elements) {
    const numberElement = findElement(verse, node =>
      (attribute(node, 'class') ?? '').split(/\s+/u).includes('number'),
    );
    const numberText = numberElement ? content(numberElement) : '';
    const number = Number(numberText.trim());
    if (!Number.isSafeInteger(number) || number < 1 || number > 40000) {
      return null;
    }
    const text = content(verse, true).replace(numberText, '').trim();
    while (verses.length < number) verses.push('');
    verses[number - 1] = text;
  }
  return verses;
}

export async function fetchLiveChapter(
  book: number,
  chapter: number,
): Promise<readonly string[] | null> {
  const metadata = BIBLE_BOOKS.find(item => item.id === book);
  if (
    !metadata ||
    !Number.isSafeInteger(chapter) ||
    chapter < 1 ||
    chapter > metadata.chapters
  ) {
    return null;
  }
  const codes: Record<number, string> = {
    26: 'ezk',
    29: 'jol',
    32: 'jnh',
    34: 'nam',
    41: 'mrk',
    43: 'jhn',
    50: 'php',
  };
  try {
    const response = await fetch(
      `https://www.bskorea.or.kr/bible/korbibReadpage.php?version=GAE&book=${codes[book] ?? metadata.englishShort}&chap=${chapter}`,
      {signal: AbortSignal.timeout(10000)},
    );
    if (!response.ok) return null;
    return parseLiveChapter(await response.text());
  } catch {
    return null;
  }
}
