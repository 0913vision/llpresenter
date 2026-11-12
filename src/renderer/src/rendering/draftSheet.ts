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
  Object.assign(row.style, {
    whiteSpace: 'pre',
    lineHeight: '1.15',
    paddingTop: '0.72em',
  });
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
        bottom: 'calc(100% + 0.05em)',
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

function drawSystem(
  parent: HTMLElement,
  data: Draft,
  range: readonly [number, number],
): () => void {
  const xml = new DOMParser().parseFromString(data.xml, 'application/xml');
  const measures = Array.from(xml.querySelectorAll('part > measure'));
  const first = measures.findIndex(
    measure => Number(measure.getAttribute('number')) === range[0],
  );
  const last = measures.findIndex(
    measure => Number(measure.getAttribute('number')) === range[1],
  );
  if (first < 0 || last < first) {
    console.error('Could not find draft sheet measure range', range);
    return () => xml.replaceChildren();
  }
  const holder = document.createElement('div');
  Object.assign(holder.style, {height: '100%', margin: 'auto'});
  parent.append(holder);
  let score: OpenSheetMusicDisplay | null = null;
  let loaded = false;
  let disposed = false;
  const render = (): void => {
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (disposed || width <= 0 || height <= 0) return;
    holder.style.width = `${width}px`;
    if (score === null) {
      const created = new OpenSheetMusicDisplay(holder, {
        autoResize: false,
        backend: 'svg',
        drawTitle: false,
        drawCredits: false,
        drawPartNames: false,
        drawMeasureNumbers: false,
        defaultColorMusic: '#FFFFFF',
        defaultColorNotehead: '#FFFFFF',
        defaultColorStem: '#FFFFFF',
        defaultColorRest: '#FFFFFF',
        defaultColorLabel: '#FFFFFF',
        defaultFontFamily: 'Pretendard Variable',
        drawTimeSignatures: first === 0,
        stretchLastSystemLine: true,
        drawingParameters: 'compacttight',
        disableCursor: true,
      });
      score = created;
      Object.assign(created.EngravingRules, {
        DefaultColorMusic: '#FFFFFF',
        DefaultColorNotehead: '#FFFFFF',
        DefaultColorStem: '#FFFFFF',
        DefaultColorRest: '#FFFFFF',
        DefaultColorLabel: '#FFFFFF',
        DefaultColorChordSymbol: '#FFFFFF',
        DefaultColorLyrics: '#FFFFFF',
        LyricsHeight: 5.5,
        ChordSymbolTextHeight: 4,
        RenderClefsAtBeginningOfStaffline: true,
        RenderKeySignatures: true,
      });
      void created
        .load(data.xml)
        .then(() => {
          if (disposed) return;
          created.EngravingRules.MinMeasureToDrawIndex = first;
          created.EngravingRules.MaxMeasureToDrawIndex = last;
          loaded = true;
          render();
        })
        .catch((error: unknown) =>
          console.error('Could not load draft sheet', error),
        );
      return;
    }
    if (!loaded) return;
    try {
      score.Zoom = 2.2;
      score.render();
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const systems = score.GraphicSheet.MusicPages.reduce(
          (count, page) => count + page.MusicSystems.length,
          0,
        );
        if (systems <= 1) break;
        score.Zoom *= 0.8;
        score.render();
      }
      const svg = holder.querySelector('svg');
      if (!svg) return;
      const bounds = svg.getBBox();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const pad = 4;
      const graphicWidth = bounds.width + 2 * pad;
      const graphicHeight = bounds.height + 2 * pad;
      const scale = Math.min(width / graphicWidth, height / graphicHeight);
      svg.setAttribute(
        'viewBox',
        `${bounds.x - pad} ${bounds.y - pad} ${graphicWidth} ${graphicHeight}`,
      );
      svg.setAttribute('width', String(graphicWidth * scale));
      svg.setAttribute('height', String(graphicHeight * scale));
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      Object.assign(svg.style, {display: 'block', margin: 'auto'});
    } catch (error) {
      console.error('Could not render draft sheet', error);
    }
  };
  const observer = new ResizeObserver(render);
  observer.observe(parent);
  render();
  return () => {
    disposed = true;
    observer.disconnect();
    score?.dispose();
  };
}

function matchingSlide(
  data: Draft,
  lines: readonly string[] | undefined,
): number {
  if (lines === undefined) return -1;
  return data.slides.slides.findIndex(
    candidate =>
      candidate.lines.length === lines.length &&
      candidate.lines.every(
        (line, index) => line.trim() === lines[index]?.trim(),
      ),
  );
}

function fitChords(overlay: HTMLElement, maximum: number): () => void {
  const fit = (): void => {
    if (overlay.clientWidth <= 0 || overlay.clientHeight <= 0) return;
    overlay.style.fontSize = `${maximum}px`;
    const rows = Array.from(overlay.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    const width = Math.max(...rows.map(row => row.scrollWidth), 1);
    const height = rows.reduce((total, row) => total + row.offsetHeight, 0);
    const scale = Math.min(
      1,
      overlay.clientWidth / width,
      overlay.clientHeight / Math.max(height, 1),
    );
    overlay.style.fontSize = `${maximum * scale}px`;
  };
  const observer = new ResizeObserver(fit);
  observer.observe(overlay);
  fit();
  return () => observer.disconnect();
}

export class DraftSheetView {
  private overlay: HTMLElement | null = null;
  private key = '';
  private stops: Array<() => void> = [];

  render(
    box: HTMLElement,
    element: ResolvedThemeElement,
    {slide, frame}: {slide: SlideLayer | null; frame: RenderFrame},
  ): void {
    const data = draft;
    const item = frame.theme?.item;
    const next = element.kind === 'nextText';
    const index =
      data === null
        ? -1
        : matchingSlide(data, next ? slide?.next?.lines : slide?.lines);
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
      this.stops.push(fitChords(overlay, size));
    } else {
      for (const range of next
        ? selected.systems.slice(0, 1)
        : selected.systems) {
        const row = document.createElement('div');
        Object.assign(row.style, {
          width: next ? '60%' : '100%',
          flex: '1',
          minHeight: '0',
          alignSelf: 'center',
        });
        overlay.append(row);
        this.stops.push(drawSystem(row, data, range));
      }
    }
  }

  private clear(box: HTMLElement): void {
    if (this.overlay === null) return;
    for (const stop of this.stops) stop();
    this.stops = [];
    this.overlay.remove();
    this.overlay = null;
    this.key = '';
    for (const child of Array.from(box.children)) {
      if (child instanceof HTMLElement) child.style.visibility = '';
    }
  }

  dispose(): void {
    for (const stop of this.stops) stop();
    this.stops = [];
    this.overlay?.remove();
    this.overlay = null;
  }
}
