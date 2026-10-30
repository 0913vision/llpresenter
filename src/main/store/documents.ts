import type {Revision} from '@core/schema/contentDocuments';
import type {FileAccess} from '@core/schema/fileFormat';
import type {StoredFile} from './library';

const FIRST_REVISION = 1;

/** A document in the main process: its content, revision, access, and file. */
export interface StoredDocument<T> {
  readonly data: T;
  readonly revision: Revision;
  readonly access: FileAccess;
  readonly file: string;
}

/**
 * The documents of one kind, by id. A document's revision starts at 1 when it
 * is read or created, and grows by one with every change stored here; it
 * lives only in memory.
 */
export class DocumentCollection<T extends {readonly id: string}> {
  private readonly documents = new Map<string, StoredDocument<T>>();

  constructor(loaded: ReadonlyMap<string, StoredFile<T>> = new Map()) {
    for (const [id, {data, access, file}] of loaded) {
      this.documents.set(id, {data, access, file, revision: FIRST_REVISION});
    }
  }

  get(id: string): StoredDocument<T> | undefined {
    return this.documents.get(id);
  }

  all(): ReadonlyArray<StoredDocument<T>> {
    return [...this.documents.values()];
  }

  /** Stores a changed document, one revision higher. */
  replace(current: StoredDocument<T>, data: T): StoredDocument<T> {
    const next = {...current, data, revision: current.revision + 1};
    this.documents.set(data.id, next);
    return next;
  }

  /** Stores a new document at the first revision. */
  add(data: T, file: string): StoredDocument<T> {
    const added: StoredDocument<T> = {
      data,
      file,
      access: 'editable',
      revision: FIRST_REVISION,
    };
    this.documents.set(data.id, added);
    return added;
  }

  remove(id: string): void {
    this.documents.delete(id);
  }
}
