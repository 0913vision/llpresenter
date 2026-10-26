import {MAX_ACTIVE_PROPS} from '@shared/schema/overlayState';
import {classes} from '../classes';
import {defineLayer} from '../layer';
import {OverlayImageView} from '../overlayImage';
import {OverlayTextView} from '../overlayText';

interface PropView {
  readonly box: HTMLElement;
  readonly text: OverlayTextView;
  readonly image: OverlayImageView;
  id: string | null;
}

export const propsLayer = defineLayer({
  kind: 'prop',
  order: 2,
  look: 'prop',
  create: (parent, options) => {
    const pool: PropView[] = [];
    let scale = 1;
    const acquire = (): PropView => {
      const box = document.createElement('div');
      box.className = classes.layer;
      const view = {
        box,
        text: new OverlayTextView(box),
        image: new OverlayImageView(box, options),
        id: null,
      };
      view.text.rescale(scale);
      parent.append(box);
      pool.push(view);
      return view;
    };
    return {
      render: (layers, frame) => {
        const id = frame?.screen?.id;
        const items =
          layers.prop?.items
            ?.slice(0, MAX_ACTIVE_PROPS)
            .filter(item => id !== undefined && item.targets.includes(id)) ??
          [];
        for (const view of pool) {
          if (items.some(item => item.propId === view.id)) continue;
          view.id = null;
          view.text.show(null);
          view.image.show(null);
          view.box.hidden = true;
        }
        for (const [index, item] of items.entries()) {
          const view =
            pool.find(view => view.id === item.propId) ??
            pool.find(view => view.id === null) ??
            acquire();
          view.id = item.propId;
          view.box.hidden = false;
          view.box.style.zIndex = String(index);
          if (item.content.kind === 'text') {
            view.image.show(null);
            view.text.show(item.content.text, item.content.style);
          } else {
            view.text.show(null);
            view.image.show(item.content.media);
          }
        }
      },
      rescale: next => {
        scale = next;
        for (const view of pool) view.text.rescale(scale);
      },
      dispose: () => {
        for (const view of pool) {
          view.text.dispose();
          view.image.dispose();
          view.box.remove();
        }
        pool.length = 0;
      },
    };
  },
});
