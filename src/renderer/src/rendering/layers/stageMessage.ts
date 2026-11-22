import type {LayerDefinition} from '../layer';

const SIZE = 48;
const PADDING_X = 38;
const PADDING_Y = 16;
const ROWS = 3;
/** How fast a message longer than its band moves, in reference px a second. */
const SPEED = 60;
const REST_MS = 2000;

/** The 무대 메시지 at the bottom; a message longer than its band scrolls. */
export const stageMessageLayer: LayerDefinition = {
  kind: 'stage-message',
  create: parent => {
    const band = document.createElement('div');
    const text = document.createElement('div');
    band.dataset['stageMessageBand'] = '';
    Object.assign(band.style, {
      position: 'absolute',
      bottom: '0',
      width: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box',
      background: '#000000',
    });
    Object.assign(text.style, {
      color: '#ffffff',
      fontFamily: "'Pretendard Variable', sans-serif",
      fontWeight: '700',
      lineHeight: '1.2',
      textAlign: 'center',
      whiteSpace: 'pre-wrap',
      wordBreak: 'keep-all',
      overflowWrap: 'anywhere',
    });
    band.append(text);
    band.hidden = true;
    parent.append(band);
    let scale = 1;
    let animation: Animation | null = null;
    const scroll = (): void => {
      animation?.cancel();
      animation = null;
      const room = ROWS * SIZE * 1.2 * scale;
      const hidden = text.scrollHeight - room;
      if (band.hidden || hidden <= 1 || typeof text.animate !== 'function') {
        return;
      }
      const moving = (hidden / (SPEED * scale)) * 1000;
      const duration = moving + 2 * REST_MS;
      const up = {transform: `translateY(${-hidden}px)`};
      animation = text.animate(
        [
          {transform: 'none', offset: 0},
          {transform: 'none', offset: REST_MS / duration},
          {...up, offset: (REST_MS + moving) / duration},
          {...up, offset: 1},
        ],
        {duration, iterations: Infinity},
      );
    };
    const size = (): void => {
      text.style.fontSize = `${SIZE * scale}px`;
      band.style.padding = `${PADDING_Y * scale}px ${PADDING_X * scale}px`;
      text.style.maxHeight = '';
      band.style.maxHeight = `${(ROWS * SIZE * 1.2 + 2 * PADDING_Y) * scale}px`;
    };
    return {
      render: (_layers, frame) => {
        const message =
          frame?.screen?.kind === 'stage' ? (frame.stageMessage ?? '') : '';
        if (text.textContent === message && band.hidden === (message === '')) {
          return;
        }
        text.textContent = message;
        band.hidden = message === '';
        scroll();
      },
      rescale: next => {
        scale = next;
        size();
        scroll();
      },
      dispose: () => {
        animation?.cancel();
        band.remove();
      },
    };
  },
};
