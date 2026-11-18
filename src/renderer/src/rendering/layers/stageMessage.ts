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
      padding: '1% 2%',
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
    parent.append(band);
    return {
      render: (_layers, frame) => {
        const message =
          frame?.screen?.kind === 'stage' ? frame.stageMessage : null;
        band.textContent = message ?? '';
        band.hidden = !message;
      },
      rescale: scale => {
        band.style.fontSize = `${48 * scale}px`;
      },
      dispose: () => band.remove(),
    };
  },
});
