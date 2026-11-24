import {THEME_CANVAS} from '@core/schema/screens/screens';
import {DEFAULT_TEXT_STYLE, TEXT_EFFECTS, type TextStyle} from '@core/overlays';
import type {ThemeTextStyle} from '@core/schema/screens/theme';
import {measuredText} from '../theme/measureRows';
import {sizeRows, writeRows, type RowsText} from '../theme/textRows';

const FADE_IN_MS = 200;
const MIN_SIZE = 12;

/** The style of overlay text with no style of its own (the 무대 메시지; 소품 text supplies its stored style). */
export const DEFAULT_OVERLAY_TEXT_STYLE: TextStyle = DEFAULT_TEXT_STYLE;

function rowsStyle(style: TextStyle): ThemeTextStyle {
  return {
    font: style.font,
    weight: style.weight,
    size: style.size,
    color: style.color,
    lineHeight: style.lineHeight,
    tracking: style.tracking ?? 0,
    align: style.align,
    vAlign: style.vAlign,
    ...(style.bullets === undefined ? {} : {bullets: style.bullets}),
    shadow:
      typeof style.shadow === 'boolean'
        ? {
            on: style.shadow,
            color: '#000000',
            opacity: TEXT_EFFECTS.shadowOpacity * 100,
            angle: 45,
            blur: TEXT_EFFECTS.shadowBlur,
            distance: TEXT_EFFECTS.shadowDistance,
          }
        : style.shadow,
    outline:
      typeof style.outline === 'boolean'
        ? {
            on: style.outline,
            color: '#000000',
            width: TEXT_EFFECTS.outlineWidth,
          }
        : style.outline,
  };
}

/** Text of a 메시지 or 소품 in its own style; it fades in. */
export class OverlayTextView {
  private readonly canvas = document.createElement('div');
  private readonly block = document.createElement('div');
  private style: TextStyle = DEFAULT_OVERLAY_TEXT_STYLE;
  private text: string | null = null;

  constructor(private readonly parent: HTMLElement) {
    Object.assign(this.canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: `${THEME_CANVAS.width}px`,
      height: `${THEME_CANVAS.height}px`,
      transformOrigin: 'top left',
    });
    this.canvas.dataset['overlayText'] = '';
    this.block.style.position = 'absolute';
    this.canvas.hidden = true;
    this.canvas.append(this.block);
    parent.append(this.canvas);
  }

  show(
    text: string | null,
    style: TextStyle = DEFAULT_OVERLAY_TEXT_STYLE,
  ): void {
    const appears = text !== null && text !== this.text;
    this.style = style;
    this.text = text;
    this.draw();
    if (appears && typeof this.parent.animate === 'function') {
      this.parent.animate([{opacity: 0}, {}], FADE_IN_MS);
    }
  }

  /**
   * Changes the shown text in place, without a fade, as a ticking 타이머 does.
   * With no style given, the text keeps the style it has.
   */
  replace(text: string, style?: TextStyle): void {
    if (style !== undefined) this.style = style;
    if (this.text === null) return;
    this.text = text;
    this.draw();
  }

  rescale(scale: number): void {
    this.canvas.style.transform = `scale(${scale})`;
  }

  dispose(): void {
    this.canvas.remove();
  }

  private draw(): void {
    const {text, style} = this;
    this.canvas.hidden = text === null;
    if (text === null) return;
    const marginX = (THEME_CANVAS.width * style.margin) / 100;
    const marginY = (THEME_CANVAS.height * style.margin) / 100;
    const width = THEME_CANVAS.width - 2 * marginX;
    const room = THEME_CANVAS.height - 2 * marginY;
    const rows: RowsText = {
      text,
      style: rowsStyle(style),
      width,
      wrap: 'normal',
      continued: false,
    };
    const measured = measuredText(rows);
    let {size} = style;
    let {height} = measured.at(size, false);
    while (
      size > MIN_SIZE &&
      (height > room + 1 ||
        height > style.maxLines * size * style.lineHeight + 1)
    ) {
      size -= 1;
      ({height} = measured.at(size, false));
    }
    writeRows(this.block, rows);
    sizeRows(this.block, size, false);
    const spare = room - height;
    Object.assign(this.block.style, {
      left: `${marginX}px`,
      width: `${width}px`,
      top: `${
        marginY +
        (style.vAlign === 'middle'
          ? spare / 2
          : style.vAlign === 'bottom'
            ? spare
            : 0)
      }px`,
    });
  }
}
