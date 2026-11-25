import type {JSX} from 'react';
import {SaveTemplateDialog} from './SaveTemplateDialog';
import {SaveTemplatePrompt} from './SaveTemplatePrompt';
import type {useSaveTemplate} from './useSaveTemplate';

/**
 * The questions of saving a 예배 as a 템플릿: its name, and whether to
 * replace a 템플릿 that has it.
 */
export function TemplateSaveDialogs({
  saver,
}: {
  readonly saver: ReturnType<typeof useSaveTemplate>;
}): JSX.Element {
  return (
    <>
      {saver.naming === null ? null : (
        <SaveTemplateDialog
          name={saver.naming.name}
          busy={saver.busy}
          onSave={saver.saveNamed}
          onCancel={saver.cancel}
        />
      )}
      {saver.conflict === null ? null : (
        <SaveTemplatePrompt
          conflict={saver.conflict}
          busy={saver.busy}
          onSaveNew={saver.saveNew}
          onOverwrite={saver.overwrite}
          onCancel={saver.cancel}
        />
      )}
    </>
  );
}
