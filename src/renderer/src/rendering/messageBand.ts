import type {MessageBand} from '@core/screens/messageStyle';
import {classes} from './classes';
import {fontFamilyFor, SLIDE_DISSOLVE_MS} from './slideLayer';

/**
 * The built-in 기본 메시지 style: a full-width band at the top edge with the
 * text centered in it, at most `maxLines` lines and then an ellipsis. The
 * band's sizes are reference px that scale with the screen.
 */
export class MessageBandView {
  private readonly element = document.createElement('div');
  private readonly text = document.createElement('div');
  private shown: string | null = null;
  private background = '';

  constructor(
    parent: HTMLElement,
    private readonly band: MessageBand,
  ) {
    this.element.className = classes.band;
    this.text.className = classes.bandText;
    this.element.style.setProperty(
      '--slide-dissolve',
      `${SLIDE_DISSOLVE_MS}ms`,
    );
    this.setBackground(band.background);
    this.element.style.color = band.color;
    this.element.style.fontFamily = fontFamilyFor(band.font);
    this.element.style.fontWeight = String(band.weight);
    this.element.style.lineHeight = String(band.lineHeight);
    this.text.style.setProperty('-webkit-line-clamp', String(band.maxLines));
    this.element.append(this.text);
    parent.append(this.element);
    this.rescale(1);
  }

  /** Draws the band's background, such as opaque over the chroma green. */
  setBackground(background: MessageBand['background']): void {
    const value = `color-mix(in srgb, ${background.color} ${background.opacity}%, transparent)`;
    if (value === this.background) return;
    this.background = value;
    this.element.style.backgroundColor = value;
  }

  /** Shows the text in the band with a dissolve, or hides the band for null. */
  show(text: string | null): void {
    if (text === this.shown) return;
    this.shown = text;
    if (text === null) {
      this.element.classList.remove(classes.shown);
      return;
    }
    this.text.textContent = text;
    this.element.classList.add(classes.shown);
  }

  rescale(scale: number): void {
    const {band} = this;
    this.element.style.fontSize = `${band.size * scale}px`;
    this.element.style.padding = `${band.paddingY * scale}px ${band.paddingX * scale}px`;
  }

  dispose(): void {
    this.element.remove();
  }
}
