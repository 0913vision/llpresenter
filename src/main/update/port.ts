/** The replaceable updater boundary. All network and installer work stays here. */
export interface UpdaterPort {
  check(): Promise<string | null>;
  download(progress: (percent: number) => void): Promise<void>;
  install(): void;
  dispose(): void;
}
