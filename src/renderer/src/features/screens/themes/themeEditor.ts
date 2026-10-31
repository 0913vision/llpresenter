import type {LlpApi} from '@contracts/ipc/api';
import type {Result} from '@core/common/result';
import type {ThemesFile} from '@core/schema/themes';
import type {ThemeEditProblem, ThemeEditResult} from '@core/themes/themeEdits';
import type {NamedDocument} from '@renderer/platform/useSettingsDocument';
import {SettingsDocumentEditor} from '../settingsDocumentEditor';

/** Shares serialized theme writes and keeps the displayed candidate until they settle. */
export class ThemeEditor {
  private readonly documents: SettingsDocumentEditor<NamedDocument<'themes'>>;
  private pending = 0;

  constructor(
    api: LlpApi,
    private readonly publish: (value: ThemesFile) => void,
    report: (reason: string) => void,
  ) {
    this.documents = new SettingsDocumentEditor(api, {
      update: (base, value) => ({
        type: 'settings.update',
        name: 'themes',
        value,
        baseRevision: base.revision,
      }),
      report,
      failureTitle: '테마 저장 실패',
      logMessage: 'Could not save the themes',
    });
  }

  adopt(document: NamedDocument<'themes'> | null): void {
    this.documents.adopt(document);
    if (this.pending === 0) this.publishSnapshot();
  }

  async change(
    transform: (file: ThemesFile) => ThemeEditResult,
    completion: 'applied' | 'saved' = 'applied',
  ): Promise<Result<boolean, ThemeEditProblem>> {
    this.pending++;
    let problem: ThemeEditProblem | undefined;
    try {
      const applied = await this.documents.change(file => {
        const result = transform(file);
        if (!result.ok) {
          problem = result.error;
          return undefined;
        }
        this.publish(result.value);
        return result.value;
      }, completion);
      return problem === undefined
        ? {ok: true, value: applied}
        : {ok: false, error: problem};
    } finally {
      this.pending--;
      if (this.pending === 0) this.publishSnapshot();
    }
  }

  private publishSnapshot(): void {
    const value = this.documents.getSnapshot()?.value;
    if (value !== undefined) this.publish(value);
  }
}
