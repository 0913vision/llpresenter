import type {LiveLayers} from '@core/live/state';
import type {RenderFrame} from '@renderer/rendering/layer';

/** Replays a changed local effect once, without writing to live output. */
export class SlidePreviewPlayback {
  private key: string | undefined;
  private pending: number | null = null;
  private latest: {layers: LiveLayers; frame: RenderFrame} | null = null;

  constructor(
    private readonly draw: (layers: LiveLayers, frame: RenderFrame) => void,
  ) {}

  render(layers: LiveLayers, frame: RenderFrame, before?: LiveLayers): void {
    this.latest = {layers, frame};
    const effect = frame.slideTransition;
    const key = JSON.stringify([
      layers.slide?.itemId,
      layers.slide?.position,
      effect?.kind,
      effect?.dir,
      effect?.sec,
    ]);
    const changed = this.key !== undefined && key !== this.key;
    const initial = this.key === undefined;
    this.key = key;
    if (changed) this.cancel();
    if (
      changed &&
      effect !== undefined &&
      effect.kind !== 'none' &&
      frame.transitions !== false
    ) {
      const previous = before ?? {...layers, slide: null};
      const {slide: removed, ...shared} = frame;
      this.draw(previous, {
        ...shared,
        ...(previous.slide === null ? {} : {slide: previous.slide}),
        transitions: false,
      });
      this.pending = requestAnimationFrame(() => {
        this.pending = null;
        if (this.latest !== null) {
          this.draw(this.latest.layers, this.latest.frame);
        }
      });
    } else if (this.pending === null) {
      const instant = initial || (changed && effect?.kind === 'none');
      this.draw(layers, instant ? {...frame, transitions: false} : frame);
    }
  }

  private cancel(): void {
    if (this.pending !== null) cancelAnimationFrame(this.pending);
    this.pending = null;
  }

  dispose(): void {
    this.cancel();
    this.latest = null;
  }
}
