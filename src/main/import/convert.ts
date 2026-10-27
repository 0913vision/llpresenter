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
  readonly section: number;
}

type BracketMatch =
  | {readonly kind: 'label'; readonly name: string}
  | {readonly kind: 'oversized'}
  | {readonly kind: 'none'};

function parseBracketLabel(
  line: string,
  labels: TextImportOptions['labels'],
): BracketMatch {
  if (labels === 'off') return {kind: 'none'};
  const match = /^\[([^[\]]+)\]$/u.exec(line.trim());
  if (!match) return {kind: 'none'};
  const name = match[1]?.trim();
  if (name === undefined || name === '') return {kind: 'none'};
  if (name.length > TEXT_IMPORT_LIMITS.label) return {kind: 'oversized'};
  return {kind: 'label', name};
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
): Generator<Section | 'oversized'> {
  let label: string | null = null;
  let content: string[] = [];
  let section = 0;
  for (const line of lines) {
    const match = parseBracketLabel(line, labels);
    if (match.kind === 'oversized') {
      yield 'oversized';
      return;
    }
    if (match.kind === 'none') {
      content.push(line);
      continue;
    }
    if (content.some(line => line !== '')) {
      yield {label, lines: content, section: section++};
    }
    content = [];
    label = match.name;
  }
  if (content.some(line => line !== '')) {
    yield {label, lines: content, section};
  }
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
  private section = 0;
  private totalCharacters: number;

  constructor(
    private readonly options: TextImportOptions,
    initialCharacters: number,
  ) {
    this.totalCharacters = initialCharacters;
  }

  startSection(label: string | null, section: number): void {
    this.flush();
    this.label = label;
    this.section = section;
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
    const slide: DraftSlide =
      this.label === null
        ? {lines: this.lines, section: this.section}
        : {label: this.label, lines: this.lines, section: this.section};
    const slideCharacters =
      JSON.stringify(slide).length + (this.slides.length === 0 ? 0 : 1);
    if (
      this.totalCharacters + slideCharacters >
      TEXT_IMPORT_LIMITS.draftCharacters
    ) {
      this.overflow = true;
      return;
    }
    this.totalCharacters += slideCharacters;
    this.slides.push(slide);
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
      line =>
        line !== '' && parseBracketLabel(line, options.labels).kind === 'none',
    );
    if (index >= 0) title = lines.splice(index, 1)[0]?.trim() ?? '';
  }
  const draft = new DraftSlides(
    options,
    JSON.stringify({title: title.trim() || '가져온 곡', slides: []}).length,
  );
  for (const section of sections(lines, options.labels)) {
    if (section === 'oversized') return invalidSize();
    draft.startSection(section.label, section.section);
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
