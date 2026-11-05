import type {SongEditorStore} from './songEditorStore';
import {LabelManager} from './LabelManager';

export function LabelManagerDialog(props: {
  readonly store: SongEditorStore;
  readonly onClose: () => void;
}) {
  return <LabelManager {...props} placement="dialog" />;
}
