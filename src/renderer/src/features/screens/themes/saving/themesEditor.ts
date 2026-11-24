import type {LlpApi} from '@contracts/ipc/api';
import type {Result} from '@core/common/result';
import type {Themes} from '@core/schema/screens/themes';
import type {ThemeListProblem, ThemeListResult} from '@core/theme';
import {SettingsDocumentEditor} from '../../settingsDocumentEditor';
import type {NamedDocument} from '@core/schema/app/settingsDocuments';

/** Saves changes of the themes one after another, showing each at once. */
export class ThemesEditor {
  private readonly documents: SettingsDocumentEditor<NamedDocument<'themes'>>;
  private pending = 0;

  constructor(
    api: LlpApi,
    private readonly publish: (value: Themes) => void,
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
    transform: (list: Themes) => ThemeListResult,
    completion: 'applied' | 'saved' = 'applied',
  ): Promise<Result<boolean, ThemeListProblem>> {
    this.pending++;
    let problem: ThemeListProblem | undefined;
    try {
      const applied = await this.documents.change(list => {
        const result = transform(list);
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
