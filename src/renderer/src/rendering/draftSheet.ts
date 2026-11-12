import {OpenSheetMusicDisplay} from 'opensheetmusicdisplay';
import {parseDraftSheet, type Draft} from '@core/schema/draftSheet';
import type {SlideLayer} from '@core/live/state';
import type {ResolvedThemeElement} from '@core/themes/songTitle';
import type {RenderFrame} from './layer';

let draft: Draft | null = null;

export function setDraftSheet(value: unknown): void {
  draft = parseDraftSheet(value);
}

function chordsLine(
  xml: Document,
  line: string,
  range: readonly [number, number],
): HTMLElement {
  const row = document.createElement('div');
  Object.assign(row.style, {whiteSpace: 'pre', lineHeight: '1.25'});
  const measures = Array.from(xml.querySelectorAll('part > measure'));
  let cursor = 0;
  for (let number = range[0]; number <= range[1]; number += 1) {
    const measure = measures.find(
      entry => Number(entry.getAttribute('number')) === number,
    );
    const syllable = measure?.querySelector('note lyric text')?.textContent;
    const root = measure?.querySelector('harmony root-step')?.textContent;
    if (!syllable) continue;
    const index = line.indexOf(syllable, cursor);
    if (index < 0) continue;
    row.append(document.createTextNode(line.slice(cursor, index)));
    const span = document.createElement('span');
    span.textContent = syllable;
    span.style.position = 'relative';
    if (root) {
      const chord = document.createElement('span');
      const kind = measure.querySelector('harmony kind')?.textContent;
      const alter = measure.querySelector('harmony root-alter')?.textContent;
      chord.textContent =
        root +
        (alter === '-1' ? '?' : alter === '1' ? '?' : '') +
        (kind === 'minor' ? 'm' : kind === 'dominant' ? '7' : '');
      Object.assign(chord.style, {
        position: 'absolute',
        left: '0',
        bottom: '100%',
        color: '#FFD400',
        fontSize: '0.6em',
        fontWeight: '700',
        lineHeight: '1',
      });
      span.append(chord);
    }
    row.append(span);
    cursor = index + syllable.length;
  }
  row.append(document.createTextNode(line.slice(cursor)));
  return row;
}

async function drawSystem(
  parent: HTMLElement,
  data: Draft,
  range: readonly [number, number],
): Promise<void> {
  const holder = document.createElement('div');
  Object.assign(holder.style, {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  });
  parent.append(holder);
  const score = new OpenSheetMusicDisplay(holder, {
    autoResize: false,
    backend: 'svg',
    drawTitle: false,
    drawCredits: false,
    drawPartNames: false,
    drawMeasureNumbers: false,
    defaultColorMusic: '#FFFFFF',
    defaultColorLabel: '#FFFFFF',
    defaultFontFamily: 'Pretendard Variable',
    drawFromMeasureNumber: range[0] + 1,
    drawUpToMeasureNumber: range[1] + 1,
    renderSingleHorizontalStaffline: true,
    stretchLastSystemLine: true,
    drawingParameters: 'compacttight',
    disableCursor: true,
  });
  try {
    await score.load(data.xml);
    score.render();
    const svg = holder.querySelector('svg');
    if (svg) {
      const width = Number.parseFloat(svg.getAttribute('width') ?? '0');
      const height = Number.parseFloat(svg.getAttribute('height') ?? '0');
      if (width > 0 && height > 0) {
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('preserveAspectRatio', 'xMinYMid meet');
      }
    }
  } finally {
    score.dispose();
  }
}

export class DraftSheetView {
  private overlay: HTMLElement | null = null;
  private key = '';

  render(
    box: HTMLElement,
    element: ResolvedThemeElement,
    {slide, frame}: {slide: SlideLayer | null; frame: RenderFrame},
  ): void {
    const data = draft;
    const item = frame.theme?.item;
    const next = element.kind === 'nextText';
    const index = (slide?.position ?? -1) + (next ? 1 : 0);
    const selected = data?.slides.slides[index];
    const active =
      data !== null &&
      frame.screen?.kind === 'stage' &&
      !frame.standby &&
      item?.kind === 'song' &&
      item.title === data.slides.song &&
      !item.contentCleared &&
      slide !== null &&
      slide.sectionCard === undefined &&
      selected !== undefined &&
      (element.kind === 'currentText' ||
        (next && data.mode === 'staff-next' && slide.next !== undefined));
    if (!active) {
      this.clear(box);
      return;
    }
    const key = `${data.mode}:${index}:${element.kind}`;
    if (this.key === key && this.overlay?.isConnected) return;
    this.clear(box);
    this.key = key;
    const overlay = document.createElement('div');
    this.overlay = overlay;
    Object.assign(overlay.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-evenly',
      overflow: 'hidden',
      color: 'white',
      fontFamily: 'Pretendard Variable, sans-serif',
    });
    for (const child of Array.from(box.children)) {
      if (child instanceof HTMLElement) child.style.visibility = 'hidden';
    }
    box.hidden = false;
    box.append(overlay);
    if (data.mode === 'chords' && element.kind === 'currentText') {
      const size = element.text.size;
      Object.assign(overlay.style, {
        fontSize: `${size}px`,
        fontWeight: String(element.text.weight),
        alignItems:
          element.text.align === 'center'
            ? 'center'
            : element.text.align === 'right'
              ? 'flex-end'
              : 'flex-start',
      });
      const xml = new DOMParser().parseFromString(data.xml, 'application/xml');
      selected.lines.forEach((line, i) => {
        const range = selected.systems[i];
        if (range) overlay.append(chordsLine(xml, line, range));
      });
    } else {
      for (const range of next
        ? selected.systems.slice(0, 1)
        : selected.systems) {
        const row = document.createElement('div');
        Object.assign(row.style, {width: '100%', flex: '1', minHeight: '0'});
        overlay.append(row);
        void drawSystem(row, data, range).catch((error: unknown) =>
          console.error('Could not render draft sheet', error),
        );
      }
    }
  }

  private clear(box: HTMLElement): void {
    if (this.overlay === null) return;
    this.overlay.remove();
    this.overlay = null;
    this.key = '';
    for (const child of Array.from(box.children)) {
      if (child instanceof HTMLElement) child.style.visibility = '';
    }
  }

  dispose(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
