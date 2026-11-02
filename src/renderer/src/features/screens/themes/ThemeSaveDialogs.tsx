import type {JSX} from 'react';
import {THEME_LIMITS} from '@core/themes/elementRules';
import {copyThemeName} from '@core/themes/themeEdits';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {countedMeta} from '@renderer/ui/countedMeta';
import {RenameDialog} from '@renderer/ui/RenameDialog';
import {themeProblems} from './themeNames';
import type {ThemeModel} from './useThemeEditor';
import {useThemeUsage, type ThemeUsage} from './useThemeUsage';

function usageMeta(usage: ThemeUsage): readonly string[] {
  if (usage === 'loading') return ['사용 항목을 확인하는 중'];
  if (usage === 'failed') return ['예배 순서 사용 항목을 확인할 수 없습니다'];
  return countedMeta(usage, `예배 순서 항목 ${usage}곳에서 씀`);
}

/** The questions of 저장, 다른 이름으로 저장…, and leaving with unsaved edits. */
export function ThemeSaveDialogs({
  model,
}: {
  readonly model: ThemeModel;
}): JSX.Element | null {
  const {dialog, theme, file, saving} = model;
  const usage = useThemeUsage(
    theme?.id,
    file?.defaults,
    dialog?.kind === 'overwrite',
  );
  if (dialog === null || theme === undefined || file === null) return null;
  if (dialog.kind === 'saveAs') {
    const taken = new Set([file.standby, ...file.themes].map(one => one.name));
    return (
      <RenameDialog
        title="다른 이름으로 저장"
        label="테마 이름"
        name={copyThemeName(theme.name, file)}
        maxLength={THEME_LIMITS.name}
        rename={{
          commitsUnchanged: true,
          validate: name => (taken.has(name) ? themeProblems.taken : undefined),
          onCommit: async name => {
            const id = await model.saveAs(theme.id, name);
            if (id !== undefined) model.chooseSaved(id);
            return id !== undefined;
          },
          onClose: model.closeDialog,
        }}
      />
    );
  }
  if (dialog.kind === 'overwrite') {
    return (
      <AlertDialog
        icon="layers"
        title={`‘${theme.name}’ 테마를 덮어쓸까요?`}
        meta={usageMeta(usage)}
        onCancel={model.closeDialog}
        actions={[
          {
            label: '덮어쓰기',
            primary: true,
            disabled: saving,
            onSelect: model.confirmOverwrite,
          },
        ]}
      />
    );
  }
  return (
    <AlertDialog
      icon="layers"
      title={`‘${theme.name}’ 테마의 변경을 저장할까요?`}
      onCancel={model.closeDialog}
      actions={[
        {
          label: '저장 안 함',
          disabled: saving,
          onSelect: () => model.discardAndLeave(dialog.proceed),
        },
        {
          label: '저장',
          primary: true,
          disabled: saving,
          onSelect: () => model.saveAndLeave(dialog.proceed),
        },
      ]}
    />
  );
}
