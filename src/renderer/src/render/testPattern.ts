import type {RenderMode} from './backgroundLayer';
import type {RenderScreen} from './layer';
import styles from './testPattern.module.css';

/** The seven bars at full strength, left to right (docs/spec/06-settings.md). */
export const PATTERN_BARS = [
  '#FFFFFF',
  '#FFFF00',
  '#00FFFF',
  '#00FF00',
  '#FF00FF',
  '#FF0000',
  '#0000FF',
] as const;

/** The gray ramp's steps from black to white. */
export const PATTERN_RAMP_STEPS = 11;

const LABEL_SIZE_AT_1080 = 48;

function classOf(key: string): string {
  return styles[key] ?? key;
}

function rampGray(step: number): string {
  const value = Math.round((255 * step) / (PATTERN_RAMP_STEPS - 1));
  return `rgb(${value}, ${value}, ${value})`;
}

function stripe(className: string, colors: readonly string[]): HTMLElement {
  const row = document.createElement('div');
  row.className = classOf(className);
  for (const color of colors) {
    const cell = document.createElement('div');
    cell.style.background = color;
    row.append(cell);
  }
  return row;
}

/**
 * The 테스트 패턴: color bars over a gray ramp, a white border at the picture
 * edge, and the screen name and resolution in the centre. An output window
 * prints its own device pixels as the resolution; a preview prints the name
 * only. It is built once and only shown, hidden, and relabeled after that.
 */
export class TestPatternView {
  private readonly element = document.createElement('div');
  private readonly label = document.createElement('div');
  private screen: RenderScreen | undefined;
  private text = '';

  constructor(
    private readonly parent: HTMLElement,
    private readonly mode: RenderMode = 'output',
  ) {
    this.element.className = classOf('pattern');
    this.element.hidden = true;
    this.label.className = classOf('label');
    this.element.append(
      stripe('bars', PATTERN_BARS),
      stripe(
        'ramp',
        Array.from({length: PATTERN_RAMP_STEPS}, (_, step) => rampGray(step)),
      ),
      this.label,
    );
    parent.append(this.element);
  }

  show(screen: RenderScreen | undefined, shown: boolean): void {
    this.element.hidden = !shown;
    this.screen = screen;
    if (shown) this.relabel();
  }

  rescale(scale: number): void {
    this.label.style.fontSize = `${LABEL_SIZE_AT_1080 * scale}px`;
    if (!this.element.hidden) this.relabel();
  }

  dispose(): void {
    this.element.remove();
  }

  // NOTE(0913vision): A preview can't know the size of the output it copies,
  // so only the output window, which covers the screen, prints a resolution.
  private relabel(): void {
    const lines = [
      ...(this.screen?.name === undefined ? [] : [this.screen.name]),
      ...(this.mode === 'output' ? [this.resolution()] : []),
    ];
    const text = lines.join('\n');
    if (text === this.text) return;
    this.text = text;
    this.label.textContent = text;
    this.label.hidden = text === '';
  }

  private resolution(): string {
    const ratio = window.devicePixelRatio;
    const width = Math.round(this.parent.clientWidth * ratio);
    const height = Math.round(this.parent.clientHeight * ratio);
    return `${width}×${height}`;
  }
}
