import type {JSX} from 'react';
import {THEME_FILE_LIMITS} from '@core/schema/theme';
import {copiedThemeName} from '@core/theme';
import {AlertDialog} from '@renderer/ui/popups/AlertDialog';
import {
  USAGE_LOADING,
  USAGE_UNAVAILABLE,
  usageMeta as usageLine,
} from '@renderer/ui/text/usageText';
import {RenameDialog} from '@renderer/ui/popups/RenameDialog';
import {themeProblems} from './themeNames';
import type {ThemeModel} from './useThemeEditor';
import {useThemeUsage, type ThemeUsage} from './useThemeUsage';

function usageMeta(usage: ThemeUsage): readonly string[] {
  if (usage === 'loading') return [USAGE_LOADING];
  if (usage === 'failed') return [USAGE_UNAVAILABLE];
  return usageLine(usage, '예배 순서 항목');
}

/** The questions of 저장, 다른 이름으로 저장…, and leaving with unsaved edits. */
export function ThemeSaveDialogs({
  model,
}: {
  readonly model: ThemeModel;
}): JSX.Element | null {
  const {dialog, theme, list, saving} = model;
  const usage = useThemeUsage(theme?.id, dialog?.kind === 'overwrite');
  if (dialog === null || theme === undefined || list === null) return null;
  if (dialog.kind === 'saveAs') {
    const taken = new Set(list.themes.map(entry => entry.name));
    return (
      <RenameDialog
        title="다른 이름으로 저장"
        label="테마 이름"
        name={copiedThemeName(list, theme.name)}
        rename={{
          maxLength: THEME_FILE_LIMITS.name,
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
