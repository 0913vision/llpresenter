import type {
  UpdateAction,
  UpdateSnapshot,
  UpdateStatus,
} from '@core/schema/update';
import type {Logger} from '../log';
import type {UpdaterPort} from './port';

interface UpdateOptions {
  readonly updater: UpdaterPort | null;
  readonly version: string;
  readonly outputsOn: () => boolean;
  readonly changed: (snapshot: UpdateSnapshot) => void;
  readonly installAfterShutdown: (install: () => void) => Promise<boolean>;
  readonly log: Logger;
}

/** Network details stay in the log; operators get a short actionable reason. */
export function updateErrorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOTFOUND|ENET|ECONN|ETIMEDOUT|net::|network|offline/iu.test(message)) {
    return '인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
  }
  if (/404|No published|No releases|latest.yml/iu.test(message)) {
    return '공개된 업데이트를 찾을 수 없습니다.';
  }
  if (/ENOSPC|disk space/iu.test(message)) return '저장 공간이 부족합니다.';
  if (/sha512|checksum|signature/iu.test(message)) {
    return '설치 파일을 확인할 수 없습니다. 다시 내려받아 주세요.';
  }
  if (/EACCES|EPERM|permission/iu.test(message)) {
    return '업데이트 파일을 저장할 권한이 없습니다.';
  }
  return '업데이트를 완료할 수 없습니다. 잠시 후 다시 시도해 주세요.';
}

/** Owns one check/download and one deferred question, never an unbounded queue. */
export class UpdateController {
  private status: UpdateStatus = {kind: 'idle'};
  private revision = 0;
  private visible = false;
  private busy = false;
  private manual = false;
  private launched = false;
  private disposed = false;
  private lastOutputsOn: boolean;

  constructor(private readonly options: UpdateOptions) {
    this.lastOutputsOn = options.outputsOn();
  }

  get(): UpdateSnapshot {
    return {
      revision: this.revision,
      status: this.status,
      visible: this.visible,
      outputsOn: this.options.outputsOn(),
      busy: this.busy,
    };
  }

  launch(): void {
    if (this.launched || this.disposed) return;
    this.launched = true;
    if (this.status.kind === 'idle') {
      this.check(false).catch((error: unknown) => this.failed(error));
    }
  }

  async check(manual = true): Promise<void> {
    if (this.disposed) return;
    if (['checking', 'downloading', 'installing'].includes(this.status.kind)) {
      if (manual) {
        this.manual = true;
        this.visible = true;
        this.busy = true;
        this.publish();
      }
      return;
    }
    if (manual && this.status.kind === 'downloaded') {
      this.visible = true;
      this.publish();
      return;
    }
    const updater = this.options.updater;
    this.manual = manual;
    if (updater === null) {
      if (manual) this.set({kind: 'unsupported'}, true);
      return;
    }
    this.set({kind: 'checking'}, manual);
    try {
      const version = await updater.check();
      if (this.isDisposed()) return;
      if (version === null) {
        this.set({kind: 'latest', version: this.options.version}, this.manual);
      } else {
        this.set({kind: 'available', version}, this.manual);
        if (!this.manual) await this.download(version);
      }
    } catch (error) {
      this.failed(error);
    }
  }

  act(request: UpdateAction): void {
    if (this.disposed || request.revision !== this.revision) return;
    if (request.action === 'later' || request.action === 'dismiss') {
      this.visible = false;
      this.busy = false;
      this.publish();
    } else if (
      request.action === 'download' &&
      this.status.kind === 'available'
    ) {
      this.download(this.status.version).catch((error: unknown) =>
        this.failed(error),
      );
    } else if (
      request.action === 'install' &&
      this.status.kind === 'downloaded' &&
      !this.options.outputsOn()
    ) {
      this.install(this.status.version).catch((error: unknown) =>
        this.failed(error),
      );
    }
  }

  outputsChanged(): void {
    const on = this.options.outputsOn();
    if (on === this.lastOutputsOn || this.disposed) return;
    this.lastOutputsOn = on;
    this.publish();
  }

  dispose(): void {
    this.disposed = true;
    this.options.updater?.dispose();
  }

  private isDisposed(): boolean {
    return this.disposed;
  }

  private async download(version: string): Promise<void> {
    this.set({kind: 'downloading', version, percent: 0}, this.manual);
    try {
      await this.options.updater?.download(percent => {
        if (
          this.disposed ||
          this.status.kind !== 'downloading' ||
          this.status.percent === percent
        ) {
          return;
        }
        this.set({kind: 'downloading', version, percent}, this.visible);
      });
      if (!this.disposed) this.set({kind: 'downloaded', version}, true);
    } catch (error) {
      this.failed(error);
    }
  }

  private async install(version: string): Promise<void> {
    this.set({kind: 'installing', version}, false);
    try {
      const accepted = await this.options.installAfterShutdown(() =>
        this.options.updater?.install(),
      );
      if (!accepted && !this.disposed) {
        this.set({kind: 'downloaded', version}, true);
      }
    } catch (error) {
      this.failed(error);
    }
  }

  private failed(error: unknown): void {
    this.options.log.warn('Could not complete update operation', error);
    if (!this.disposed) {
      this.set({kind: 'error', reason: updateErrorReason(error)}, this.manual);
    }
  }

  private set(status: UpdateStatus, visible: boolean): void {
    this.status = status;
    this.visible = visible;
    this.busy = false;
    if (status.kind !== 'downloading') {
      this.options.log.info('Update state', status.kind);
    }
    this.publish();
  }

  private publish(): void {
    this.revision += 1;
    this.options.changed(this.get());
  }
}
