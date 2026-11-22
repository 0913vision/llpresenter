import {
  type OwnThemeScreen,
  type SlideBackground,
  type ThemeFill,
  type ThemeFrame,
  type ThemeShape,
  THEME_CANVAS,
} from '@core/schema/theme';
import type {MediaLayer} from '@core/schema/live';
import type {ShapePlacement, ThemePlacement} from '@core/theme/layout';
import {templateTokens} from '@core/theme/template';
import {mediaObjectFit} from '@core/media/objectFit';
import {BackgroundLayerView, type RenderMode} from '../backgroundLayer';
import type {PreviewMediaSource} from '../previewMedia';
import {backgroundPaint} from '../themeBackground';
import {measuredText} from './measureRows';
import {placeTexts} from './placement';
import {isText, type ShownText, type ThemeDrawing} from './shownTexts';
import {sizeRows, writeRows} from './textRows';
import styles from './theme.module.css';

export type {LabelPlace, ThemeDrawing} from './shownTexts';

export interface ThemeViewOptions {
  readonly mediaUrl: (mediaId: string) => string;
  readonly previewMedia?: PreviewMediaSource | undefined;
  readonly mode?: RenderMode;
  readonly transparent?: boolean;
  /** Scales with the `--picture-scale` of the box around it. */
  readonly cssScale?: boolean;
  readonly onError: (message: string, error: unknown) => void;
}

/** How much of each part a clear leaves visible. */
export interface ThemeOpacity {
  readonly slide: number;
  readonly media: number;
}

/** The media a background shows: the one that plays, or its first picture. */
function shownMedia(
  background: SlideBackground,
  media: MediaLayer | null | undefined,
): MediaLayer | null {
  if (media !== undefined) return media;
  return background.kind === 'media'
    ? {
        mediaId: background.media,
        loop: background.loop ?? true,
        startedAt: 0,
      }
    : null;
}

/**
 * Draws one screen of one slide from its theme file. The output, previews,
 * thumbnails and editors all draw with this and nothing else.
 */
export class ThemeView {
  private readonly root = document.createElement('div');
  private readonly backdrop = document.createElement('div');
  private readonly canvas = document.createElement('div');
  private readonly backgroundBox = document.createElement('div');
  private readonly paint = document.createElement('div');
  private readonly mediaBox = document.createElement('div');
  private readonly nodes = new Map<string, HTMLElement>();
  private readonly images = new Set<HTMLImageElement>();
  private media: BackgroundLayerView | null = null;
  private drawing: ThemeDrawing | null = null;
  private built: OwnThemeScreen | null = null;
  private opacity: ThemeOpacity = {slide: 1, media: 1};

  constructor(
    parent: HTMLElement,
    private readonly options: ThemeViewOptions,
  ) {
    this.root.className = styles.layer ?? '';
    this.root.dataset['themeView'] = '';
    this.backdrop.className = styles.layer ?? '';
    this.canvas.className = styles.canvas ?? '';
    this.canvas.style.width = `${THEME_CANVAS.width}px`;
    this.canvas.style.height = `${THEME_CANVAS.height}px`;
    this.backgroundBox.className = styles.element ?? '';
    this.paint.className = styles.layer ?? '';
    this.mediaBox.className = styles.layer ?? '';
    this.backgroundBox.classList.add(styles.background ?? '');
    this.backgroundBox.append(this.paint, this.mediaBox);
    this.canvas.append(this.backgroundBox);
    this.root.append(this.backdrop, this.canvas);
    parent.append(this.root);
    this.rescale();
  }

  /** Draws a slide, or only the empty color when the theme has nothing. */
  draw(drawing: ThemeDrawing | null): void {
    this.drawing = drawing;
    this.canvas.hidden = drawing === null;
    if (drawing === null) {
      this.media?.show(null);
      this.backdrop.style.background = 'transparent';
      return;
    }
    if (this.built !== drawing.screen) this.build(drawing.screen);
    this.backdrop.style.background =
      this.options.transparent === true
        ? 'transparent'
        : (drawing.screen.backdrop ?? drawing.emptyColor);
    this.drawBackground(drawing);
    this.layout(drawing);
  }

  /** Lays the texts out again, when fonts arrived after they were drawn. */
  refit(): void {
    if (this.drawing !== null) this.layout(this.drawing);
  }

  setOpacity(opacity: ThemeOpacity): void {
    if (
      opacity.slide === this.opacity.slide &&
      opacity.media === this.opacity.media
    ) {
      return;
    }
    this.opacity = opacity;
    this.applyOpacity();
  }

  rescale(
    width = this.root.clientWidth,
    height = this.root.clientHeight,
  ): void {
    const scale =
      this.options.cssScale === true
        ? 'var(--picture-scale)'
        : String(
            Math.min(width / THEME_CANVAS.width, height / THEME_CANVAS.height),
          );
    this.canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  ready(): boolean {
    return (
      (this.media?.ready() ?? true) &&
      [...this.images].every(image => image.complete)
    );
  }

  hold(): void {
    this.media?.hold();
  }

  dispose(): void {
    this.media?.dispose();
    this.media = null;
    this.root.remove();
  }

  private build(screen: OwnThemeScreen): void {
    this.built = screen;
    this.images.clear();
    for (const node of this.nodes.values()) node.remove();
    this.nodes.clear();
    for (const element of screen.elements) {
      if (element.kind === 'background') continue;
      const node = document.createElement('div');
      node.className = styles.element ?? '';
      node.dataset['themeElement'] = element.id;
      node.dataset['kind'] = element.kind;
      if (element.kind === 'picture') {
        const image = document.createElement('img');
        image.className = styles.picture ?? '';
        image.alt = '';
        if (this.options.mode === 'preview') image.decoding = 'sync';
        image.style.objectFit = mediaObjectFit(element.fit);
        image.src = this.options.mediaUrl(element.media);
        this.images.add(image);
        node.append(image);
        frameAt(node, element.frame);
      }
      this.canvas.append(node);
      this.nodes.set(element.id, node);
    }
  }

  private drawBackground(drawing: ThemeDrawing): void {
    const {screen, background, standby} = drawing;
    const element = screen.elements.find(entry => entry.kind === 'background');
    this.backgroundBox.hidden = element === undefined;
    if (element === undefined) {
      this.media?.show(null);
      return;
    }
    frameAt(this.backgroundBox, element.frame);
    Object.assign(this.paint.style, backgroundPaint(background));
    const media = shownMedia(background, drawing.media);
    if (media !== null && this.media === null) {
      this.media = new BackgroundLayerView(this.mediaBox, {
        mediaUrl: this.options.mediaUrl,
        previewMedia: this.options.previewMedia,
        onError: this.options.onError,
        muted: true,
        ...(this.options.mode === undefined ? {} : {mode: this.options.mode}),
      });
    }
    const own =
      background.kind === 'media' && background.media === media?.mediaId
        ? background
        : undefined;
    this.mediaBox.style.transform = placeOf(own?.area);
    this.media?.show(
      media === null
        ? null
        : {
            ...media,
            properties: {
              ...(media.properties ?? {speed: 1, volume: 100, audio: false}),
              fit: own?.fit ?? (media.chosen ? 'fill' : element.fit),
            },
          },
      standby,
    );
  }

  private layout(drawing: ThemeDrawing): void {
    const {texts, placement} = placeTexts(drawing);
    for (const element of drawing.screen.elements) {
      const node = this.nodes.get(element.id);
      if (node === undefined) continue;
      if (isText(element)) {
        drawText(node, texts.get(element.id), placement);
      } else if (element.kind === 'shape') {
        drawShape(node, element, {
          at: placement.shapes.get(element.id),
          opaque: drawing.opaque === true,
        });
      }
    }
    this.applyOpacity();
  }

  private applyOpacity(): void {
    const {drawing} = this;
    if (drawing === null) return;
    const {slide, media} = this.opacity;
    this.backgroundBox.style.opacity = media === 1 ? '' : String(media);
    for (const element of drawing.screen.elements) {
      const node = this.nodes.get(element.id);
      if (node === undefined) continue;
      const follows =
        element.kind === 'next' ||
        (element.kind === 'text' && templateTokens(element.content).size > 0) ||
        (element.kind === 'shape' &&
          (element.around !== undefined || element.beside !== undefined));
      node.style.opacity = follows && slide !== 1 ? String(slide) : '';
    }
  }
}

type Picture = Extract<SlideBackground, {readonly kind: 'media'}>;

/** Moves and scales a background picture from the whole of its box. */
function placeOf(area: Picture['area']): string {
  return area === undefined
    ? ''
    : `translate(${area.x * 100}%, ${area.y * 100}%) scale(${area.scale})`;
}

function frameAt(node: HTMLElement, frame: ThemeFrame): void {
  Object.assign(node.style, {
    left: `${frame.x}px`,
    top: `${frame.y}px`,
    width: `${frame.w}px`,
    height: `${frame.h}px`,
  });
}

function drawText(
  node: HTMLElement,
  shown: ShownText | undefined,
  placement: ThemePlacement,
): void {
  const at =
    shown === undefined ? undefined : placement.texts.get(shown.element.id);
  node.hidden = at === undefined;
  if (shown === undefined || at === undefined) return;
  writeRows(node, shown.rows);
  node.classList.add(styles.element ?? '');
  sizeRows(node, at.size, at.keepRows);
  const {height, rows, style} = shown.element;
  const natural = measuredText(shown.rows).at(at.size, at.keepRows).height;
  const spare =
    height === undefined && rows === undefined
      ? 0
      : Math.max(0, at.h - natural);
  const offset =
    style.vAlign === 'middle'
      ? spare / 2
      : style.vAlign === 'bottom'
        ? spare
        : 0;
  Object.assign(node.style, {
    left: `${at.x}px`,
    top: `${at.y + offset}px`,
    width: `${at.w}px`,
    height: '',
  });
}

function rgba(color: string, opacity: number): string {
  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`;
}

function fillStyle(fill: ThemeFill): string {
  return 'color' in fill
    ? rgba(fill.color, fill.opacity)
    : `linear-gradient(${fill.angle}deg, ${fill.stops
        .map(stop => `${rgba(stop.color, stop.opacity)} ${stop.position}%`)
        .join(', ')})`;
}

function drawShape(
  node: HTMLElement,
  shape: ThemeShape,
  {
    at,
    opaque,
  }: {
    readonly at: ShapePlacement | undefined;
    readonly opaque: boolean;
  },
): void {
  node.hidden = at === undefined;
  if (at === undefined) return;
  frameAt(node, at);
  // NOTE(0913vision): A thin line stays visible on a small picture.
  node.style.width = `max(${at.w}px, 1px / var(--picture-scale, 1))`;
  node.style.height = `max(${at.h}px, 1px / var(--picture-scale, 1))`;
  const {border, shadow} = shape;
  Object.assign(node.style, {
    boxSizing: 'border-box',
    background: fillStyle(opaque ? (shape.solid ?? shape.fill) : shape.fill),
    backgroundClip: 'padding-box',
    borderRadius: `${shape.radius ?? 0}px`,
    border:
      border === undefined
        ? ''
        : `${border.width}px solid ${opaque ? border.color : rgba(border.color, border.opacity)}`,
    boxShadow:
      shadow === undefined || opaque
        ? ''
        : `0 0 ${shadow.blur}px ${rgba(shadow.color, shadow.opacity)}`,
  });
}
