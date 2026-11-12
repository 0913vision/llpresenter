import {
  POWERPOINT_BACKGROUND_LIMITS as LIMITS,
  type PowerPointColor,
  type PowerPointFill,
  type PowerPointLayer,
  type PowerPointMatrix,
  type PowerPointScene,
} from '@core/songs/powerpointLayers';
import {powerpointPictureFilters} from '@core/songs/powerpointPictureFilters';

type Context = OffscreenCanvasRenderingContext2D;
type Shape = Extract<PowerPointLayer, {kind: 'shape'}>;
type Picture = Extract<PowerPointLayer, {kind: 'picture'}>;

const cssColor = ({r, g, b, alpha}: PowerPointColor) =>
  `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${alpha})`;

function linearGradient(
  context: Context,
  fill: Extract<PowerPointFill, {kind: 'gradient'}>,
  matrix: PowerPointMatrix,
): CanvasGradient {
  const radians = (fill.angle * Math.PI) / 180;
  const width = Math.hypot(matrix.a, matrix.b);
  const height = Math.hypot(matrix.c, matrix.d);
  let x = Math.cos(radians) * (fill.scaled ? 1 : width);
  let y = Math.sin(radians) * (fill.scaled ? 1 : height);
  const length = Math.hypot(x, y) || 1;
  x /= length;
  y /= length;
  const span = (Math.abs(x) + Math.abs(y)) / 2;
  return context.createLinearGradient(
    0.5 - x * span,
    0.5 - y * span,
    0.5 + x * span,
    0.5 + y * span,
  );
}

function paint(
  context: Context,
  fill: PowerPointFill,
  matrix: PowerPointMatrix,
): string | CanvasGradient {
  if (fill.kind === 'solid') return cssColor(fill.color);
  const centerX = (fill.focus.left + 1 - fill.focus.right) / 2;
  const centerY = (fill.focus.top + 1 - fill.focus.bottom) / 2;
  const radius = Math.max(
    Math.hypot(centerX, centerY),
    Math.hypot(1 - centerX, 1 - centerY),
    Math.hypot(centerX, 1 - centerY),
    Math.hypot(1 - centerX, centerY),
  );
  const gradient = fill.radial
    ? context.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius,
      )
    : linearGradient(context, fill, matrix);
  const stops = fill.radial ? [...fill.stops].reverse() : fill.stops;
  for (const stop of stops) {
    gradient.addColorStop(
      fill.radial ? 1 - stop.position : stop.position,
      cssColor(stop.color),
    );
  }
  return gradient;
}

function shapePath(context: Context, layer: Shape): void {
  context.beginPath();
  switch (layer.geometry) {
    case 'ellipse':
      context.ellipse(0.5, 0.5, 0.5, 0.5, 0, 0, Math.PI * 2);
      break;
    case 'roundRect': {
      const width = Math.hypot(layer.matrix.a, layer.matrix.b);
      const height = Math.hypot(layer.matrix.c, layer.matrix.d);
      const radius = Math.min(width, height) * layer.radius;
      context.roundRect(0, 0, 1, 1, {x: radius / width, y: radius / height});
      break;
    }
    case 'rect':
      context.rect(0, 0, 1, 1);
      break;
  }
}

function drawShape(context: Context, layer: Shape): void {
  shapePath(context, layer);
  if (layer.fill) {
    context.fillStyle = paint(context, layer.fill, layer.matrix);
    context.fill();
  }
  if (layer.outline && layer.outline.width > 0) {
    context.strokeStyle = paint(context, layer.outline.fill, layer.matrix);
    context.lineWidth =
      layer.outline.width *
      Math.max(
        Math.hypot(layer.matrix.a, layer.matrix.b),
        Math.hypot(layer.matrix.c, layer.matrix.d),
      );
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.stroke();
  }
}

async function drawPicture(
  context: Context,
  layer: Picture,
  scene: PowerPointScene,
): Promise<void> {
  const part = scene.pictures.find(picture => picture.part === layer.part);
  if (!part) throw new Error('PowerPoint picture part is unavailable');
  const bytes = new Uint8Array(part.bytes);
  const bitmap = await createImageBitmap(new Blob([bytes], {type: part.mime}));
  try {
    if (
      bitmap.width > LIMITS.imageSide ||
      bitmap.height > LIMITS.imageSide ||
      bitmap.width * bitmap.height > LIMITS.imagePixels
    ) {
      return;
    }
    const sourceWidth = bitmap.width * (1 - layer.crop.left - layer.crop.right);
    const sourceHeight =
      bitmap.height * (1 - layer.crop.top - layer.crop.bottom);
    const width = 1 - layer.stretch.left - layer.stretch.right;
    const height = 1 - layer.stretch.top - layer.stretch.bottom;
    if (sourceWidth <= 0 || sourceHeight <= 0 || width <= 0 || height <= 0) {
      return;
    }
    context.beginPath();
    context.rect(0, 0, 1, 1);
    context.clip();
    context.globalAlpha = layer.alpha;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.filter =
      powerpointPictureFilters(layer)
        .map(filter => `${filter.kind}(${filter.amount})`)
        .join(' ') || 'none';
    context.drawImage(
      bitmap,
      bitmap.width * layer.crop.left,
      bitmap.height * layer.crop.top,
      sourceWidth,
      sourceHeight,
      layer.stretch.left,
      layer.stretch.top,
      width,
      height,
    );
  } finally {
    bitmap.close();
  }
}

function transparentEdge(context: Context): boolean {
  const edges = [
    context.getImageData(0, 0, LIMITS.width, 1),
    context.getImageData(0, LIMITS.height - 1, LIMITS.width, 1),
    context.getImageData(0, 0, 1, LIMITS.height),
    context.getImageData(LIMITS.width - 1, 0, 1, LIMITS.height),
  ];
  return edges.some(({data}) => {
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] !== 255) return true;
    }
    return false;
  });
}

async function drawLayer(
  context: Context,
  layer: PowerPointLayer,
  scene: PowerPointScene,
): Promise<void> {
  const {a, b, c, d, e, f} = layer.matrix;
  context.save();
  try {
    context.setTransform(a, b, c, d, e, f);
    if (layer.kind === 'picture') await drawPicture(context, layer, scene);
    else drawShape(context, layer);
  } finally {
    context.restore();
  }
}

/** Composes data-only slide layers in Chromium and returns deterministic media bytes. */
export async function composePowerPointBackground(
  scene: PowerPointScene,
): Promise<{mime: 'image/jpeg' | 'image/png'; bytes: Uint8Array}> {
  const canvas = new OffscreenCanvas(LIMITS.width, LIMITS.height);
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) throw new Error('PowerPoint canvas is unavailable');
  try {
    for (const layer of scene.layers.slice(0, LIMITS.layers)) {
      await drawLayer(context, layer, scene);
    }
    const mime = transparentEdge(context) ? 'image/png' : 'image/jpeg';
    const blob = await canvas.convertToBlob({type: mime, quality: 0.92});
    return {mime, bytes: new Uint8Array(await blob.arrayBuffer())};
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}
