import type {LayerDefinition} from '../layer';

const SIZE = 56;
const PADDING_X = 48;
const PADDING_Y = 14;
const COLOR = '#A3201D';
/** Between the end of a message that flows and its start again. */
const GAP = 240;
/** How fast a message longer than its band moves, in reference px a second. */
const SPEED = 170;
const REST_MS = 1500;

function row(): HTMLElement {
  const text = document.createElement('span');
  text.style.flex = 'none';
  return text;
}

/**
 * The 무대 메시지 in one row on a band at the bottom, as a news line. A message
 * longer than the band flows to the left and comes in again.
 */
export const stageMessageLayer: LayerDefinition = {
  kind: 'stage-message',
  create: parent => {
    const band = document.createElement('div');
    const track = document.createElement('div');
    const text = row();
    const again = row();
    band.dataset['stageMessageBand'] = '';
    Object.assign(band.style, {
      position: 'absolute',
      bottom: '0',
      width: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box',
      background: COLOR,
    });
    Object.assign(track.style, {
      display: 'flex',
      width: '100%',
      color: '#ffffff',
      fontFamily: "'Pretendard Variable', sans-serif",
      fontWeight: '700',
      lineHeight: '1.25',
      whiteSpace: 'pre',
    });
    again.setAttribute('aria-hidden', 'true');
    track.append(text, again);
    band.append(track);
    band.hidden = true;
    parent.append(band);
    let scale = 1;
    let animation: Animation | null = null;
    const flow = (): void => {
      animation?.cancel();
      animation = null;
      const room = track.clientWidth;
      const width = text.offsetWidth;
      const flows = !band.hidden && width > room;
      again.hidden = !flows;
      track.style.justifyContent = flows ? 'flex-start' : 'center';
      if (!flows || typeof track.animate !== 'function') return;
      const distance = width + GAP * scale;
      const moving = (distance / (SPEED * scale)) * 1000;
      const duration = REST_MS + moving;
      animation = track.animate(
        [
          {transform: 'none', offset: 0},
          {transform: 'none', offset: REST_MS / duration},
          {transform: `translateX(${-distance}px)`, offset: 1},
        ],
        {duration, iterations: Infinity},
      );
    };
    const size = (): void => {
      track.style.fontSize = `${SIZE * scale}px`;
      again.style.marginLeft = `${GAP * scale}px`;
      band.style.padding = `${PADDING_Y * scale}px ${PADDING_X * scale}px`;
    };
    return {
      render: (_layers, frame) => {
        const message =
          frame?.screen?.kind === 'stage' ? (frame.stageMessage ?? '') : '';
        const line = message.trim().replace(/\s*\n\s*/gu, '   ');
        if (text.textContent === line && band.hidden === (line === '')) return;
        text.textContent = line;
        again.textContent = line;
        band.hidden = line === '';
        flow();
      },
      rescale: next => {
        scale = next;
        size();
        flow();
      },
      dispose: () => {
        animation?.cancel();
        band.remove();
      },
    };
  },
};
