import {defineLayer} from '../layer';

export const stageMessageLayer = defineLayer({
  kind: 'stage-message',
  order: 6,
  create: parent => {
    const band = document.createElement('div');
    band.dataset['stageMessageBand'] = '';
    Object.assign(band.style, {
      position: 'absolute',
      bottom: '0',
      width: '100%',
      padding: '16px 38px',
      maxHeight: '204.8px',
      overflow: 'hidden',
      display: 'none',
      boxSizing: 'border-box',
      background: '#000000',
      color: '#ffffff',
      fontFamily: 'Pretendard, sans-serif',
      fontSize: '48px',
      lineHeight: '1.2',
      textAlign: 'center',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
    });
    band.style.setProperty('-webkit-line-clamp', '3');
    band.style.setProperty('-webkit-box-orient', 'vertical');
    parent.append(band);
    return {
      render: (_layers, frame) => {
        const message =
          frame?.screen?.kind === 'stage' ? frame.stageMessage : null;
        band.textContent = message ?? '';
        band.hidden = !message;
        band.style.display = message ? '-webkit-box' : 'none';
      },
      rescale: scale => {
        band.style.fontSize = `${48 * scale}px`;
        band.style.padding = `${16 * scale}px ${38 * scale}px`;
        band.style.maxHeight = `${(3 * 48 * 1.2 + 32) * scale}px`;
      },
      dispose: () => band.remove(),
    };
  },
});
