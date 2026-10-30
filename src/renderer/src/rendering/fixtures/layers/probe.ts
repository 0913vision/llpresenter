import {defineLayer} from '../../layer';

type Phase = 'create' | 'draw' | 'rescale' | 'dispose';
let failing: Phase | null = null;

export function failProbeDuring(phase: Phase | null): void {
  failing = phase;
}

function check(phase: Phase): void {
  if (failing === phase) throw new Error(`fixture ${phase} failed`);
}

export const fixtureLayer = defineLayer({
  kind: 'fixture',
  order: 7,
  create: parent => {
    check('create');
    const picture = document.createElement('output');
    parent.append(picture);
    return {
      render: layers => {
        check('draw');
        picture.textContent = layers.message?.text ?? 'empty';
      },
      rescale: scale => {
        check('rescale');
        picture.dataset['scale'] = String(scale);
      },
      dispose: () => {
        picture.dataset['disposed'] = 'true';
        picture.remove();
        check('dispose');
      },
    };
  },
});
