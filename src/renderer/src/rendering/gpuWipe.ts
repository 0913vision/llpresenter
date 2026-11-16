import type {SlideTransition} from '@core/schema/slideTransition';
import {WIPE_PROFILE} from './wipeProfile';

const SNAPSHOT_DEADLINE_MS = 1500;
const LIVE_CONTENT =
  'video[src], canvas, [data-kind="clock"], [data-kind="timer"], [data-kind="videoTimeLeft"]';
const {
  travel: TRAVEL,
  center: START,
  steps: STEPS,
  startPercent: MASK_START,
  endPercent: MASK_END,
  maskScale: MASK_SCALE,
} = WIPE_PROFILE;
const FEATHER = ((MASK_END - MASK_START) * MASK_SCALE) / 100;

interface ElementCanvas extends HTMLCanvasElement {
  requestPaint(): void;
}

interface ElementContext extends CanvasRenderingContext2D {
  drawElementImage(element: HTMLElement, x: number, y: number): DOMMatrix;
}

function canPaint(canvas: HTMLCanvasElement): canvas is ElementCanvas {
  return typeof Reflect.get(canvas, 'requestPaint') === 'function';
}

function canCapture(
  context: CanvasRenderingContext2D,
): context is ElementContext {
  return typeof Reflect.get(context, 'drawElementImage') === 'function';
}

const VERTEX = `#version 300 es
out vec2 uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D outgoing;
uniform sampler2D incoming;
uniform float progress;
uniform vec2 direction;
in vec2 uv;
out vec4 color;
float stopPosition(float index) {
  float percent = ${MASK_END} - (${MASK_END} - ${MASK_START}) * index / ${STEPS}.0;
  return ${MASK_SCALE}.0 * (50.0 - floor(percent * 1000.0 + 0.5) / 1000.0) / 100.0;
}
float stopAlpha(float index) {
  float t = 1.0 - index / ${STEPS}.0;
  return floor((1.0 - t*t*(3.0-2.0*t)) * 100000.0 + 0.5) / 100000.0;
}
void main() {
  vec2 screen = vec2(uv.x, 1.0 - uv.y);
  float axis = dot(screen, abs(direction));
  if (direction.x + direction.y < 0.0) axis = 1.0 - axis;
  float edge = ${START} - ${TRAVEL} * progress;
  float t = clamp((axis - edge) / ${FEATHER} + 0.5, 0.0, 1.0) * ${STEPS}.0;
  float index = floor(t);
  float coordinate = axis - edge;
  if (coordinate < stopPosition(index)) index = max(index - 1.0, 0.0);
  if (coordinate > stopPosition(min(index + 1.0, ${STEPS}.0))) index = min(index + 1.0, ${STEPS}.0);
  float lower = stopPosition(index);
  float upper = stopPosition(min(index + 1.0, ${STEPS}.0));
  float fraction = upper > lower ? clamp((coordinate - lower) / (upper - lower), 0.0, 1.0) : 0.0;
  float alpha = mix(stopAlpha(index), stopAlpha(min(index + 1.0, ${STEPS}.0)), fraction);
  color = mix(texture(outgoing, uv), texture(incoming, uv), alpha);
}`;

function shader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const result = gl.createShader(type);
  if (result === null) throw new Error('Could not allocate a wipe shader');
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(result);
    gl.deleteShader(result);
    throw new Error(`Could not compile a wipe shader: ${message}`);
  }
  return result;
}

function program(gl: WebGL2RenderingContext): WebGLProgram {
  const result = gl.createProgram();
  const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  gl.attachShader(result, vertex);
  gl.attachShader(result, fragment);
  gl.linkProgram(result);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(result);
    gl.deleteProgram(result);
    throw new Error(`Could not link a wipe program: ${message}`);
  }
  return result;
}

function snapshot(source: HTMLElement): HTMLElement {
  const copy = source.cloneNode(true);
  if (!(copy instanceof HTMLElement)) {
    throw new Error('Could not copy a wipe surface');
  }
  Object.assign(copy.style, {
    width: `${source.clientWidth}px`,
    height: `${source.clientHeight}px`,
    visibility: 'visible',
    opacity: '1',
    transition: 'none',
  });
  for (const image of copy.querySelectorAll('img')) {
    image.crossOrigin = 'anonymous';
  }
  return copy;
}

/** Blends two opaque DOM pictures on one screen-sized GPU surface. */
export class GpuWipe {
  readonly finished: Promise<void>;
  private readonly canvas: HTMLCanvasElement;
  private readonly captureCanvas: ElementCanvas;
  private readonly captureContext: ElementContext;
  private readonly gl: WebGL2RenderingContext;
  private readonly next: HTMLElement;
  private readonly effect: SlideTransition;
  private readonly pictures: readonly [HTMLElement, HTMLElement];
  private readonly opacity: string;
  private readonly pipeline: WebGLProgram;
  private readonly progress: WebGLUniformLocation | null;
  private readonly textures: WebGLTexture[] = [];
  private frame: number | null = null;
  private startedAt: number | null = null;
  private playing = true;
  private ready = false;
  private decoded = false;
  private disposed = false;
  private readonly deadline: ReturnType<typeof setTimeout>;
  private resolve: (() => void) | null = null;
  private reject: ((error: unknown) => void) | null = null;

  static create(
    old: HTMLElement,
    next: HTMLElement,
    effect: SlideTransition,
  ): GpuWipe | null {
    // NOTE(0913vision): Moving content retains the native wipe. DOM image
    // capture deliberately omits unreadable media instead of copying its pixels.
    if (
      next.parentElement === null ||
      old.parentElement !== next.parentElement ||
      next.clientWidth === 0 ||
      next.clientHeight === 0 ||
      [old, next].some(surface => surface.querySelector(LIVE_CONTENT))
    ) {
      return null;
    }
    const canvas = next.ownerDocument.createElement('canvas');
    if (!canPaint(canvas)) return null;
    const context = canvas.getContext('2d');
    if (context === null || !canCapture(context)) return null;
    const output = next.ownerDocument.createElement('canvas');
    const gl = output.getContext('webgl2', {premultipliedAlpha: true});
    if (gl === null) return null;
    try {
      return new GpuWipe(
        {canvas, context},
        {canvas: output, gl},
        {old, next, effect},
      );
    } catch (error) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      throw error;
    }
  }

  private constructor(
    capture: {canvas: ElementCanvas; context: ElementContext},
    drawing: {canvas: HTMLCanvasElement; gl: WebGL2RenderingContext},
    surfaces: {old: HTMLElement; next: HTMLElement; effect: SlideTransition},
  ) {
    const {canvas, gl} = drawing;
    const {old, next, effect} = surfaces;
    const {canvas: captureCanvas} = capture;
    this.canvas = canvas;
    this.captureCanvas = captureCanvas;
    this.captureContext = capture.context;
    this.gl = gl;
    this.next = next;
    this.effect = effect;
    this.finished = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    // NOTE(0913vision): Capture can fail while prepare still holds the first
    // frame, before the caller attaches its completion/error handler.
    void this.finished.catch(() => undefined);
    this.opacity = next.style.opacity;
    this.pictures = [snapshot(old), snapshot(next)];
    canvas.width = Math.round(next.clientWidth * window.devicePixelRatio);
    canvas.height = Math.round(next.clientHeight * window.devicePixelRatio);
    canvas.dataset['slideWipe'] = '';
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '2',
      pointerEvents: 'none',
    });
    this.pipeline = program(gl);
    gl.useProgram(this.pipeline);
    this.progress = gl.getUniformLocation(this.pipeline, 'progress');
    const direction = effect.dir ?? 'left';
    gl.uniform2f(
      gl.getUniformLocation(this.pipeline, 'direction'),
      direction === 'left' ? 1 : direction === 'right' ? -1 : 0,
      direction === 'up' ? 1 : direction === 'down' ? -1 : 0,
    );
    gl.uniform1i(gl.getUniformLocation(this.pipeline, 'outgoing'), 0);
    gl.uniform1i(gl.getUniformLocation(this.pipeline, 'incoming'), 1);
    captureCanvas.width = canvas.width;
    captureCanvas.height = canvas.height;
    captureCanvas.setAttribute('layoutsubtree', '');
    Object.assign(captureCanvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '-1',
      pointerEvents: 'none',
    });
    captureCanvas.append(...this.pictures);
    next.parentElement?.append(captureCanvas);
    next.parentElement?.append(canvas);
    next.style.opacity = '0';
    captureCanvas.addEventListener('paint', this.capture);
    canvas.addEventListener('webglcontextlost', this.contextLost);
    this.deadline = setTimeout(
      () => this.fail(new Error('Wipe pictures were not captured in time')),
      SNAPSHOT_DEADLINE_MS,
    );
    void Promise.all(
      this.pictures.flatMap(picture =>
        [...picture.querySelectorAll('img')]
          .filter(image => image.getAttribute('src'))
          .map(image => image.decode()),
      ),
    ).then(
      () => {
        if (!this.disposed) {
          this.decoded = true;
          captureCanvas.requestPaint();
        }
      },
      (error: unknown) => this.fail(error),
    );
  }

  private readonly capture = (): void => {
    if (this.disposed || this.ready || !this.decoded) return;
    try {
      const gl = this.gl;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      for (const [index, picture] of this.pictures.entries()) {
        const texture = gl.createTexture();
        this.textures.push(texture);
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const context = this.captureContext;
        context.clearRect(
          0,
          0,
          this.captureCanvas.width,
          this.captureCanvas.height,
        );
        context.save();
        context.scale(window.devicePixelRatio, window.devicePixelRatio);
        context.drawElementImage(picture, 0, 0);
        context.restore();
        const pixels = context.getImageData(
          0,
          0,
          this.captureCanvas.width,
          this.captureCanvas.height,
        );
        if (pixels.data[3] !== 255) {
          throw new Error('Wipe picture capture is incomplete');
        }
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
      }
      if (gl.getError() !== gl.NO_ERROR) {
        throw new Error('Could not upload wipe pictures');
      }
      clearTimeout(this.deadline);
      this.ready = true;
      this.draw(0);
      if (this.playing) this.schedule();
    } catch (error) {
      this.fail(error);
    }
  };

  private readonly contextLost = (event: Event): void => {
    event.preventDefault();
    this.fail(new Error('Wipe graphics context was lost'));
  };

  private draw(progress: number): void {
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.uniform1f(this.progress, progress);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  }

  private schedule(): void {
    if (this.frame !== null || this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (time: number): void => {
    this.frame = null;
    if (this.disposed || !this.playing) return;
    if (this.startedAt === null) {
      this.startedAt = time;
      this.captureCanvas.remove();
      this.captureCanvas.replaceChildren();
      this.captureCanvas.width = this.captureCanvas.height = 0;
    }
    const progress = Math.min(
      1,
      (time - this.startedAt) / (this.effect.sec * 1000),
    );
    this.draw(progress);
    if (progress === 1) this.resolve?.();
    else this.schedule();
  };

  pause(): void {
    this.playing = false;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  start(): void {
    this.playing = true;
    if (this.ready) this.schedule();
  }

  private fail(error: unknown): void {
    if (this.disposed) return;
    this.reject?.(error);
    this.cancel();
  }

  cancel(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.deadline);
    this.pause();
    this.captureCanvas.removeEventListener('paint', this.capture);
    this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.next.style.opacity = this.opacity;
    this.canvas.remove();
    this.captureCanvas.remove();
    for (const texture of this.textures) this.gl.deleteTexture(texture);
    this.gl.deleteProgram(this.pipeline);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.resolve?.();
  }
}
