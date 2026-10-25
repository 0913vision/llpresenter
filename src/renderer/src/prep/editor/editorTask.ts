/** Reports unexpected failures from event tasks that already handle refusals. */
export function editorTask(task: Promise<unknown>): void {
  task.catch((error: unknown) =>
    console.error('Editor operation failed', error),
  );
}
