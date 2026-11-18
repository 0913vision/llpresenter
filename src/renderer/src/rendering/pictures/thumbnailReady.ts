const thumbnailWaits = new Map<string, Promise<void>>();
export function thumbnailReady(src: string): Promise<void> {
  const existing = thumbnailWaits.get(src);
  if (existing !== undefined) return existing;
  const pending = new Promise<void>(resolve => {
    const image = new Image();
    image.onload = () => {
      if (typeof image.decode === 'function') {
        image.decode().then(resolve, resolve);
      } else resolve();
    };
    image.onerror = () => resolve();
    image.src = src;
  });
  thumbnailWaits.set(src, pending);
  if (thumbnailWaits.size > 128) {
    const oldest = thumbnailWaits.keys().next().value;
    if (oldest !== undefined) thumbnailWaits.delete(oldest);
  }
  return pending;
}
