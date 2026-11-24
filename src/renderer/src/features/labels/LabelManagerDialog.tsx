import type {LabelCatalog} from './labelCatalog';
import {LabelManager} from './LabelManager';

/** The 이름표 manager in a dialog, closed by `onClose`. */
export function LabelManagerDialog(props: {
  readonly store: LabelCatalog;
  readonly onClose: () => void;
}) {
  return <LabelManager {...props} placement="dialog" />;
}
