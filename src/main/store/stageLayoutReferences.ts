import type {EditFailure} from '@shared/schema/contentEdit';
import type {LooksFile} from '@shared/schema/looks';
import type {
  SettingsDocument,
  SettingsName,
} from '@shared/schema/settingsDocuments';
import type {StageLayoutsFile} from '@shared/schema/stageLayouts';
import {referencedStageLayouts} from '@shared/stageLayoutReferences';

const refuse = (
  reason: 'invalid' | 'not-found',
  message: string,
): EditFailure => ({reason, message});

function removalFailure(
  before: StageLayoutsFile,
  next: StageLayoutsFile,
  looks: SettingsDocument | undefined,
): EditFailure | null {
  const retained = new Set(next.layouts.map(layout => layout.id));
  if (before.layouts.every(layout => retained.has(layout.id))) return null;
  if (looks?.name !== 'looks') {
    return refuse('not-found', 'Look settings are unavailable');
  }
  const referenced = referencedStageLayouts(looks.value);
  return before.layouts.some(
    layout => !retained.has(layout.id) && referenced.has(layout.id),
  )
    ? refuse('invalid', 'A Look uses a stage layout being removed')
    : null;
}

function assignmentFailure(
  before: LooksFile,
  next: LooksFile,
  stages: SettingsDocument | undefined,
): EditFailure | null {
  const previous = assignments(before);
  let available: ReadonlySet<string> | undefined;
  for (const [edge, id] of assignments(next)) {
    if (previous.get(edge) === id) continue;
    if (stages?.name !== 'stage-layouts') {
      return refuse('not-found', 'Stage layout settings are unavailable');
    }
    available ??= new Set(stages.value.layouts.map(layout => layout.id));
    if (!available.has(id)) {
      return refuse(
        'invalid',
        'A Look cannot reference a missing stage layout',
      );
    }
  }
  return null;
}

function assignments(looks: LooksFile): ReadonlyMap<string, string> {
  const references = new Map<string, string>();
  for (const look of looks.looks) {
    for (const [screenId, card] of Object.entries(look.screens)) {
      if (card.stageLayout !== undefined) {
        references.set(`${look.id}/${screenId}`, card.stageLayout);
      }
    }
  }
  return references;
}

/** Checks the current in-memory graph before a settings edit changes or announces it. */
export function stageLayoutReferenceFailure(
  documents: ReadonlyMap<SettingsName, SettingsDocument>,
  next: SettingsDocument,
): EditFailure | null {
  if (next.name === 'stage-layouts') {
    const before = documents.get('stage-layouts');
    if (before?.name !== 'stage-layouts') {
      return refuse('not-found', 'Stage layout settings are unavailable');
    }
    return removalFailure(before.value, next.value, documents.get('looks'));
  }
  if (next.name === 'looks') {
    const before = documents.get('looks');
    if (before?.name !== 'looks') {
      return refuse('not-found', 'Look settings are unavailable');
    }
    return assignmentFailure(
      before.value,
      next.value,
      documents.get('stage-layouts'),
    );
  }
  return null;
}
