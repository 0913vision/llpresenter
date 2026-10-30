import {audioPositionSeconds} from '@core/schema/audioState';
import {outputMediaProperties} from '@core/schema/outputMedia';
import {withLayers} from '../history';
import {defineSlice} from '../slice';

export const mediaPropertiesSlice = defineSlice({
  commands: ['media.properties.refresh'],
  initial: {},
  reduce: (history, _command, {audioMedia, now, timerNow = now}) => {
    const catalog = audioMedia?.();
    if (catalog === undefined) return history;
    let {media, audio} = history.state.layers;
    const previousMedia = media;
    const previousAudio = audio;
    for (const kind of ['media', 'audio'] as const) {
      const layer = history.state.layers[kind];
      const item = catalog.items.find(item => item.id === layer?.mediaId);
      if (layer === null || item === undefined) continue;
      const properties = outputMediaProperties(item);
      if (JSON.stringify(layer.properties) === JSON.stringify(properties)) {
        continue;
      }
      const speedChanged = (layer.properties?.speed ?? 1) !== properties.speed;
      if (kind === 'media' && media !== null) {
        media = {
          ...media,
          properties,
          ...(speedChanged
            ? {
                positionSeconds:
                  (media.positionSeconds ?? 0) +
                  (Math.max(0, now - media.startedAt) / 1000) *
                    (media.properties?.speed ?? 1),
                startedAt: now,
              }
            : {}),
        };
      } else if (audio?.playback !== undefined) {
        audio = {
          ...audio,
          properties,
          playback: speedChanged
            ? {
                ...audio.playback,
                positionSeconds: audioPositionSeconds(
                  audio.playback,
                  timerNow,
                  audio.properties?.speed,
                ),
                since: audio.playback.since === null ? null : timerNow,
              }
            : audio.playback,
        };
      }
    }
    return media === previousMedia && audio === previousAudio
      ? history
      : withLayers(
          history,
          {...history.state.layers, media, audio},
          history.undo,
        );
  },
});
