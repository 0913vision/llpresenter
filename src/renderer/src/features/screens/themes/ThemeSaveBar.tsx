import type {JSX} from 'react';
import {Button} from '@renderer/ui/Button';
import type {ThemeModel} from './useThemeEditor';
import styles from './Themes.module.css';

const NO_EDITS = '변경 없음';

/** 다른 이름으로 저장… and 저장 above the canvas, as the 테마 draft shows. */
export function ThemeSaveBar({
  model,
}: {
  readonly model: ThemeModel;
}): JSX.Element {
  const {reason, theme, dirtyThemeId, saving} = model;
  const dirty = dirtyThemeId !== null && dirtyThemeId === theme?.id;
  return (
    <div className={styles.saveBar}>
      <Button
        disabled={reason !== undefined || theme === undefined || saving}
        title={reason}
        onClick={model.askSaveAs}
      >
        다른 이름으로 저장…
      </Button>
      <Button
        variant="primary"
        disabled={reason !== undefined || !dirty || saving}
        title={reason ?? (dirty ? undefined : NO_EDITS)}
        onClick={model.askOverwrite}
      >
        저장
      </Button>
    </div>
  );
}
