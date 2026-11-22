import type {LabelCatalog} from './labelCatalog';
import {LabelManager} from './LabelManager';

export function LabelManagerDialog(props: {
  readonly store: LabelCatalog;
  readonly onClose: () => void;
}) {
  return <LabelManager {...props} placement="dialog" />;
}
