import {checkPart} from '@core/schema/fileFormat';
import {SLIDE_CLIPBOARD_LIMITS} from '@core/schema/slideClipboard';
import {slideRowsClipboardSchema} from '@core/schema/slideRowsClipboard';
import type {SlideClipboard} from '@core/songs/slideListEdits';
import type {Slide, SlidesDraft, SlidesItem} from '@core/services/slidesEdits';

export const SLIDE_ROWS_MIME = 'application/x-llp-slide-rows';
const HTML_LIMIT = SLIDE_CLIPBOARD_LIMITS.characters * 12;

export interface RowClipboardData {
  readonly text: string;
  readonly rows: string;
}

export function rowClipboardData(
  form: SlidesItem['slides']['form'],
  copied: SlideClipboard<Slide>,
): RowClipboardData | null {
  const rows = JSON.stringify({
    format: 'llp-slide-rows',
    version: 1,
    content: {form, name: '', slides: copied.slides},
  });
  return rows.length <= SLIDE_CLIPBOARD_LIMITS.characters
    ? {text: copied.text, rows}
    : null;
}

export function pasteRowClipboard(
  draft: SlidesDraft,
  data: RowClipboardData,
): boolean {
  if (
    data.text.length > SLIDE_CLIPBOARD_LIMITS.characters ||
    data.rows.length > SLIDE_CLIPBOARD_LIMITS.characters
  ) {
    return false;
  }
  if (data.rows === '') return draft.pasteText(data.text);
  try {
    const parsed = checkPart(slideRowsClipboardSchema, JSON.parse(data.rows));
    return (
      parsed.ok &&
      parsed.value.content.form === draft.snapshot.item.slides.form &&
      draft.commandRows({type: 'paste', slides: parsed.value.content.slides})
    );
  } catch {
    return false;
  }
}

function clipboardHtml(data: RowClipboardData): string {
  const text = data.text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return `<div data-llp-slide-rows="${encodeURIComponent(data.rows)}">${text}</div>`;
}

function rowsFromHtml(html: string): string {
  if (html.length > HTML_LIMIT) return 'invalid';
  const encoded = /data-llp-slide-rows="([^"]*)"/.exec(html)?.[1];
  if (encoded === undefined) return '';
  try {
    return decodeURIComponent(encoded);
  } catch {
    return 'invalid';
  }
}

export function readRowClipboardEvent(
  data: Pick<DataTransfer, 'getData'>,
): RowClipboardData {
  return {
    text: data.getData('text/plain'),
    rows:
      data.getData(SLIDE_ROWS_MIME) || rowsFromHtml(data.getData('text/html')),
  };
}

export function writeRowClipboardEvent(
  target: Pick<DataTransfer, 'setData'>,
  data: RowClipboardData,
): void {
  target.setData('text/plain', data.text);
  target.setData(SLIDE_ROWS_MIME, data.rows);
  target.setData('text/html', clipboardHtml(data));
}

/** HTML carries validated row metadata across windows while plain text stays readable outside the app. */
export async function writeRowClipboard(data: RowClipboardData): Promise<void> {
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([data.text], {type: 'text/plain'}),
      'text/html': new Blob([clipboardHtml(data)], {type: 'text/html'}),
    }),
  ]);
}

export async function readRowClipboard(): Promise<RowClipboardData> {
  const entries = await navigator.clipboard.read();
  for (const entry of entries) {
    const text = entry.types.includes('text/plain')
      ? await (await entry.getType('text/plain')).text()
      : '';
    const html = entry.types.includes('text/html')
      ? await (await entry.getType('text/html')).text()
      : '';
    if (text !== '' || html !== '') return {text, rows: rowsFromHtml(html)};
  }
  return {text: '', rows: ''};
}
