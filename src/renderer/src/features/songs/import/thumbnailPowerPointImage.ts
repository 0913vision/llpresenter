const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 360;
const PREVIEW_QUALITY = 0.92;

/** Scales a background to the preview size before retaining it. */
export async function thumbnailPowerPointImage(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  const canvas = new OffscreenCanvas(PREVIEW_WIDTH, PREVIEW_HEIGHT);
  try {
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('PowerPoint preview canvas unavailable');
    }
    context.drawImage(bitmap, 0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    return await canvas.convertToBlob({
      type: 'image/webp',
      quality: PREVIEW_QUALITY,
    });
  } finally {
    bitmap.close();
    canvas.width = 1;
    canvas.height = 1;
  }
}
