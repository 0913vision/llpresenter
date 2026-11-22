/** Whether a file system error means the file or folder doesn't exist. */
export function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
