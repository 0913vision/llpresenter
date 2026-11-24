interface BackgroundImageOptions {
  readonly src: string;
  readonly onReady: () => void;
  readonly onError: () => void;
}

/** Loads a still background and returns a function that cancels and unloads it. */
export function loadBackgroundImage(
  image: HTMLImageElement,
  options: BackgroundImageOptions,
): () => void {
  const stopListening = (): void => {
    image.removeEventListener('load', onLoad);
    image.removeEventListener('error', onError);
  };
  const onLoad = (): void => {
    stopListening();
    options.onReady();
  };
  const onError = (): void => {
    stopListening();
    options.onError();
  };
  image.addEventListener('load', onLoad);
  image.addEventListener('error', onError);
  image.src = options.src;
  return () => {
    stopListening();
    image.removeAttribute('src');
  };
}
