import {win32} from 'node:path';
import type {
  TextImportDraft,
  TextImportOptions,
  TextImportPreviewRequest,
  TextImportPreviewResult,
} from '@shared/schema/textImport';
import {TEXT_IMPORT_LIMITS} from './limits';

type DraftSlide = TextImportDraft['slides'][number];
type Unit = readonly string[] | null;

interface Section {
  readonly label: string | null;
  readonly lines: readonly string[];
}

function bracketLabel(
  line: string,
  labels: TextImportOptions['labels'],
): string | null {
  if (labels === 'off') return null;
  const name = /^\[([^[\]]+)\]$/u.exec(line.trim())?.[1]?.trim();
  return name === undefined || name === '' ? null : name;
}

function normalizeLines(text: string): string[] | null {
  const lines = text
    .replace(/^\uFEFF/u, '')
    .replace(/\r\n?/gu, '\n')
    .replaceAll('\t', ' ')
    .split('\n', TEXT_IMPORT_LIMITS.lines + 1)
    .map(line => line.trimEnd());
  if (lines.length > TEXT_IMPORT_LIMITS.lines) return null;
  while (lines.at(-1) === '') lines.pop();
  let first = 0;
  while (lines[first] === '') first++;
  return lines.slice(first);
}

function* sections(
  lines: readonly string[],
  labels: TextImportOptions['labels'],
): Generator<Section> {
  let label: string | null = null;
  let content: string[] = [];
  for (const line of lines) {
    const nextLabel = bracketLabel(line, labels);
    if (nextLabel === null) {
      content.push(line);
      continue;
    }
    if (content.some(line => line !== '')) yield {label, lines: content};
    content = [];
    label = nextLabel;
  }
  if (content.some(line => line !== '')) yield {label, lines: content};
}

function paragraphUnits(lines: readonly string[]): Unit[] {
  const units: Unit[] = [];
  let paragraph: string[] = [];
  for (const line of lines) {
    if (line !== '') paragraph.push(line);
    else if (paragraph.length > 0) {
      units.push(paragraph);
      paragraph = [];
    }
  }
  if (paragraph.length > 0) units.push(paragraph);
  return units;
}

function splitUnits(
  lines: readonly string[],
  options: TextImportOptions,
): readonly Unit[] | null {
  switch (options.split) {
    case 'blankLine':
      return paragraphUnits(lines);
    case 'lineBreak':
      return lines.map(line => (line === '' ? null : [line]));
    case 'symbol': {
      const chunks = lines
        .join('\n')
        .split(options.symbol ?? '/', TEXT_IMPORT_LIMITS.units + 1);
      if (chunks.length > TEXT_IMPORT_LIMITS.units) return null;
      return chunks
        .map(chunk => chunk.trim())
        .filter(chunk => chunk !== '')
        .map(chunk => chunk.split('\n'));
    }
    default: {
      const unhandled: never = options.split;
      return unhandled;
    }
  }
}

class DraftSlides {
  readonly slides: DraftSlide[] = [];
  overflow = false;
  private lines: string[] = [];
  private units = 0;
  private totalUnits = 0;
  private label: string | null = null;

  constructor(private readonly options: TextImportOptions) {}

  startSection(label: string | null): void {
    this.flush();
    this.label = label;
  }

  append(lines: readonly string[]): void {
    this.totalUnits++;
    if (this.totalUnits > TEXT_IMPORT_LIMITS.units) {
      this.overflow = true;
      return;
    }
    if (this.units > 0 && this.options.split === 'blankLine') {
      this.lines.push('');
    }
    for (const line of lines) this.lines.push(line);
    this.units++;
    if (this.units >= this.options.unitsPerSlide) this.flush();
  }

  flush(): void {
    if (this.lines.length === 0) return;
    if (this.slides.length >= TEXT_IMPORT_LIMITS.slides) {
      this.overflow = true;
      return;
    }
    this.slides.push(
      this.label === null
        ? {lines: this.lines}
        : {label: this.label, lines: this.lines},
    );
    this.label = null;
    this.lines = [];
    this.units = 0;
  }
}

function invalidSize(): TextImportPreviewResult {
  return {
    ok: false,
    error: {
      reason: 'invalid',
      message: 'The text import exceeds its size limit',
    },
  };
}

/** Builds an unsaved draft without changing songs, settings, or label lists. */
export function convertTextImport({
  source,
  options,
}: TextImportPreviewRequest): TextImportPreviewResult {
  if (
    source.text.length > TEXT_IMPORT_LIMITS.characters ||
    options.unitsPerSlide > TEXT_IMPORT_LIMITS.unitsPerSlide
  ) {
    return invalidSize();
  }
  if (source.text.includes('\uFFFD')) {
    return {
      ok: false,
      error: {
        reason: 'decode-failed',
        message: 'The text contains replacement characters',
      },
    };
  }
  const lines = normalizeLines(source.text);
  if (lines === null) return invalidSize();
  let title = source.source === 'file' ? win32.parse(source.fileName).name : '';
  if (source.source === 'clipboard' && options.firstLine === 'title') {
    const index = lines.findIndex(
      line => line !== '' && bracketLabel(line, options.labels) === null,
    );
    if (index >= 0) title = lines.splice(index, 1)[0]?.trim() ?? '';
  }
  const draft = new DraftSlides(options);
  for (const section of sections(lines, options.labels)) {
    draft.startSection(section.label);
    const units = splitUnits(section.lines, options);
    if (units === null) return invalidSize();
    for (const unit of units) {
      if (unit === null) draft.flush();
      else draft.append(unit);
      if (draft.overflow) return invalidSize();
    }
    draft.flush();
    if (draft.overflow) return invalidSize();
  }
  if (draft.slides.length === 0) {
    return {
      ok: false,
      error: {reason: 'empty', message: 'The import has no lyric lines'},
    };
  }
  return {ok: true, value: {title, slides: draft.slides}};
}
