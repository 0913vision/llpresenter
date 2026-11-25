import {parse, type DefaultTreeAdapterTypes} from 'parse5';
import {BIBLE_BOOKS} from '@core/bible';

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

/**
 * The verse texts of one chapter, in order, read from the HTML of the live
 * Bible site, or `null` when the page holds no chapter.
 */
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

/** One chapter from the web: its verses, or why it could not be had. */
export type LiveChapterFetch =
  | {readonly ok: true; readonly verses: readonly string[]}
  | {readonly ok: false; readonly reason: string};

/**
 * Downloads one chapter from the Korean Bible Society site and returns its
 * verse texts, or why not: a book or chapter that does not exist, a failed or
 * slow request (10 seconds), or a page that cannot be read.
 */
export async function fetchLiveChapter(
  book: number,
  chapter: number,
): Promise<LiveChapterFetch> {
  const metadata = BIBLE_BOOKS.find(item => item.id === book);
  if (
    !metadata ||
    !Number.isSafeInteger(chapter) ||
    chapter < 1 ||
    chapter > metadata.chapters
  ) {
    return {ok: false, reason: 'no such book or chapter'};
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
    if (!response.ok) return {ok: false, reason: `HTTP ${response.status}`};
    const verses = parseLiveChapter(await response.text());
    return verses === null
      ? {ok: false, reason: 'the page has no verses'}
      : {ok: true, verses};
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error),
    };
  }
}
