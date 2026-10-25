import {defineLayer} from '../../layer';

export const healthyLayer = defineLayer({
  kind: 'fixture-healthy',
  order: 9,
  create: parent => {
    const picture = document.createElement('output');
    parent.append(picture);
    return {
      render: layers => {
        picture.textContent = layers.message?.text ?? 'empty';
      },
      rescale: scale => {
        picture.dataset['scale'] = String(scale);
      },
      dispose: () => {
        picture.dataset['disposed'] = 'true';
        picture.remove();
      },
    };
  },
});
