import {liveOverlay} from '@core/live';
import {BackgroundLayerView} from '../backgroundLayer';
import type {LayerDefinition} from '../layer';
import {OverlayTextView} from '../overlayText';

/** The 오버레이 of the live item on the slides it lies over. */
export const itemOverlayLayer: LayerDefinition = {
  kind: 'item-overlay',
  create: (parent, options) => {
    const text = new OverlayTextView(parent);
    const box = document.createElement('div');
    Object.assign(box.style, {position: 'absolute', inset: '0'});
    parent.append(box);
    let media: BackgroundLayerView | null = null;
    return {
      ready: () => media?.ready() ?? true,
      render: (_layers, frame) => {
        const {item, screen} = frame ?? {};
        const content =
          screen === undefined
            ? undefined
            : liveOverlay(item, screen.id)?.content;
        text.show(
          content !== undefined && 'text' in content ? content.text : null,
        );
        if (content === undefined || !('media' in content)) {
          media?.show(null);
          box.hidden = true;
          return;
        }
        box.hidden = false;
        media ??= new BackgroundLayerView(box, {
          mediaUrl: options.mediaUrl,
          previewMedia: options.previewMedia,
          onError: options.onError,
          muted: true,
          ...(options.mode === undefined ? {} : {mode: options.mode}),
        });
        media.show(
          {
            mediaId: content.media,
            loop: content.loop,
            startedAt: item?.overlayStartedAt ?? item?.startedAt ?? 0,
            properties: {speed: 1, fit: 'fit', volume: 100, audio: false},
          },
          frame?.standby,
        );
      },
      rescale: scale => text.rescale(scale),
      dispose: () => {
        text.dispose();
        media?.dispose();
        box.remove();
      },
    };
  },
};
