import type {LlpApi} from '@shared/ipc';
import type {Result} from '@shared/result';
import type {NamedDocument} from '../useSettingsDocument';
import {SettingsDocumentEditor} from '../settingsDocumentEditor';
import {editLookCard, type LookCardEdit} from './lookCardEdits';
import {
  assignMessageStyle,
  createAndAssignMessageStyle,
} from './messageStyleAssignment';
import {editLyricStyle, type LyricStyleEdit} from './lyricStyleEdits';
import {editLyricEffects, type LyricEffectsChange} from './lyricEffectsEdits';
import type {LyricStyleId} from '@shared/schema/ids';
import {
  editLyricStyleList,
  type LyricStyleListEdit,
  type LyricStyleListProblem,
} from './lyricStyleListEdits';
import {
  editLookList,
  type LookListContext,
  type LookListEdit,
  type LookListProblem,
} from './lookListEdits';

type LooksDocument = NamedDocument<'looks'>;

/** Applies lifecycle rules against the latest queued Look document and live context. */
export class LookListEditor {
  private readonly documents: SettingsDocumentEditor<LooksDocument>;

  constructor(
    api: LlpApi,
    report: (reason: string) => void,
    private readonly context: () => LookListContext,
  ) {
    this.documents = new SettingsDocumentEditor<LooksDocument>(api, {
      update: (base, value) => ({
        type: 'settings.update',
        name: 'looks',
        value,
        baseRevision: base.revision,
      }),
      report,
      failureTitle: 'Look 저장 실패',
      logMessage: 'Could not save the Looks',
    });
  }

  adopt(document: LooksDocument | null): void {
    this.documents.adopt(document);
  }

  getSnapshot(): LooksDocument | null {
    return this.documents.getSnapshot();
  }

  changeCard(edit: LookCardEdit): Promise<boolean> {
    return this.documents.change(value => editLookCard(value, edit));
  }

  assignMessage(
    input: Parameters<typeof assignMessageStyle>[1],
  ): Promise<boolean> {
    return this.documents.change(value => assignMessageStyle(value, input));
  }

  createMessage(
    input: Parameters<typeof createAndAssignMessageStyle>[1],
  ): Promise<boolean> {
    return this.documents.change(value =>
      createAndAssignMessageStyle(value, input),
    );
  }

  changeStyle(edit: LyricStyleEdit): Promise<boolean> {
    return this.documents.change(value => editLyricStyle(value, edit));
  }

  changeEffects(
    id: LyricStyleId,
    change: LyricEffectsChange,
  ): Promise<boolean> {
    return this.documents.change(value => editLyricEffects(value, id, change));
  }

  async changeStyleList(
    edit: LyricStyleListEdit,
  ): Promise<Result<boolean, LyricStyleListProblem>> {
    let problem: LyricStyleListProblem | undefined;
    const applied = await this.documents.change(value => {
      const result = editLyricStyleList(value, edit);
      if (!result.ok) {
        problem = result.error;
        return value;
      }
      return result.value;
    });
    return problem === undefined
      ? {ok: true, value: applied}
      : {ok: false, error: problem};
  }

  async change(edit: LookListEdit): Promise<Result<boolean, LookListProblem>> {
    let problem: LookListProblem | undefined;
    const applied = await this.documents.change(value => {
      const result = editLookList(value, edit, this.context());
      if (!result.ok) {
        problem = result.error;
        return undefined;
      }
      return result.value;
    });
    return problem === undefined
      ? {ok: true, value: applied}
      : {ok: false, error: problem};
  }
}
