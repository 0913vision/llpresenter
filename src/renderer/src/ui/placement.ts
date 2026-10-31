import type {Size} from '@core/ui/placement';

export * from '@core/ui/placement';

/** The window size as a `Size`. */
export function viewportSize(): Size {
  return {width: window.innerWidth, height: window.innerHeight};
}
