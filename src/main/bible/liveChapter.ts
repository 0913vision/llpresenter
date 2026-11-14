import {parse} from 'node-html-parser';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';

export function parseLiveChapter(html: string): readonly string[] | null {
  const root = parse(html);
  let elements = root.querySelectorAll('#tdBible1 > span');
  if (elements.length === 0) {
    elements = root.querySelectorAll('#tdBible1 > f > span');
  }
  if (elements.length === 0) return null;
  const verses: string[] = [];
  for (const element of elements) {
    const numberElement = element.querySelector('.number');
    const number = Number(numberElement?.textContent.trim());
    if (!Number.isSafeInteger(number) || number < 1 || number > 40000) {
      return null;
    }
    const numberText = numberElement?.textContent ?? '';
    for (const node of element.querySelectorAll('div, font[size="2"]')) {
      node.remove();
    }
    const text = element.textContent.replace(numberText, '').trim();
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
