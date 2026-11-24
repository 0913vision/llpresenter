import {useState, type JSX} from 'react';
import type {MediaId} from '@core/schema/common/ids';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {ThemeImageChoice} from './ThemeImageChoice';
import {Dialog} from '@renderer/ui/popups/Dialog';
import type {ThemeModel} from './useThemeEditor';
import styles from './Themes.module.css';

export function ThemeImageDialog({
  model,
}: {
  readonly model: ThemeModel;
}): JSX.Element {
  const [selected, setSelected] = useState<MediaId>();
  return (
    <Dialog
      title="이미지 선택"
      size="s"
      onCancel={model.cancelImage}
      primary={{
        label: '추가',
        disabled: selected === undefined,
        onSelect: () => {
          if (selected !== undefined) model.confirmImage(selected);
        },
      }}
    >
      <ThemeImageChoice
        selected={selected}
        reason={model.elementReason}
        change={setSelected}
      />
      {selected === undefined ? null : (
        <img className={styles.imageChoice} src={mediaUrl(selected)} alt="" />
      )}
    </Dialog>
  );
}
