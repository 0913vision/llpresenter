import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

/** Each session's working notes, relative to its worktree root. */
export const NOTES_PATH = '.llp/notes.md';

const STATUS_PATH = 'docs/STATUS.md';
const LEAD_BRANCH = 'main';
const MEMBER_BRANCH =
  /^(?:break|feat|fix|refactor|style|docs|chore)\/([a-z0-9-]+)\/[a-z0-9-]+$/;
const MAX_NOTES_CHARS = 12_000;
const MAX_STATUS_LINES = 80;
const MAX_CHANGED_FILES = 20;

/** Everything the hook reads from disk and git, gathered before rendering. */
export interface SessionFacts {
  readonly source: string;
  readonly branch: string;
  readonly notes: string | null;
  readonly notesUpdated: string | null;
  readonly status: string | null;
  readonly git: string;
}

/**
 * Maps a branch to a session name: `lead` for `main`, the member name for
 * `<tag>/<name>/<feature>`, or `unknown`.
 */
export function roleFor(branch: string): string {
  if (branch === LEAD_BRANCH) return 'lead';
  return MEMBER_BRANCH.exec(branch)?.[1] ?? 'unknown';
}

/** Cuts `text` to at most `max` characters and says how much was left out. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n[... ${text.length - max} more characters in the file]`;
}

function firstLines(text: string, count: number): string {
  const lines = text.split('\n');
  if (lines.length <= count) return text;
  return `${lines.slice(0, count).join('\n')}\n[... ${lines.length - count} more lines in the file]`;
}

function arrivalNotice(source: string, role: string): string {
  const brief = `docs/briefs/${role}.md`;
  if (source === 'compact') {
    return [
      'Your context was just compacted, so only a summary of the earlier',
      'conversation remains. Before the next step, read your notes below,',
      `${brief}, and the files you were editing. Trust the files over the`,
      'summary. Then bring the notes up to date.',
    ].join('\n');
  }
  return `Read ${brief} and your notes below before the first step.`;
}

function notesSection(facts: SessionFacts): string {
  if (facts.notes === null) {
    return [
      `## Your notes (${NOTES_PATH})`,
      '',
      `There is no notes file yet. Create ${NOTES_PATH} with the sections in`,
      'CLAUDE.md under "Context and compaction" before your first step.',
    ].join('\n');
  }
  return [
    `## Your notes (${NOTES_PATH}, updated ${facts.notesUpdated ?? 'unknown'})`,
    '',
    truncate(facts.notes.trim(), MAX_NOTES_CHARS),
  ].join('\n');
}

/** Renders the text that the SessionStart hook adds to the session's context. */
export function buildContext(facts: SessionFacts): string {
  const role = roleFor(facts.branch);
  const sections = [
    '# Session context',
    '',
    `You are the ${role} session on branch ${facts.branch} (start: ${facts.source}).`,
    arrivalNotice(facts.source, role),
    '',
    notesSection(facts),
    '',
    '## Git',
    '',
    facts.git.trim(),
  ];
  if (facts.status !== null) {
    sections.push(
      '',
      `## Team status (${STATUS_PATH})`,
      '',
      firstLines(facts.status.trim(), MAX_STATUS_LINES),
    );
  }
  return `${sections.join('\n')}\n`;
}

function git(root: string, args: readonly string[]): string {
  return execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trimEnd();
}

function readIfPresent(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function gitSummary(root: string, role: string): string {
  const changed = git(root, ['status', '--short']).split('\n').filter(Boolean);
  const changedText =
    changed.length === 0
      ? 'Working tree clean.'
      : `Uncommitted (${changed.length}):\n${firstLines(changed.join('\n'), MAX_CHANGED_FILES)}`;
  const history =
    role === 'lead'
      ? `Worktrees:\n${git(root, ['worktree', 'list'])}\n\nRecent commits:\n${git(root, ['log', '--oneline', '-5'])}`
      : `Commits not yet in ${LEAD_BRANCH}:\n${git(root, ['log', '--oneline', `${LEAD_BRANCH}..HEAD`]) || '(none)'}`;
  return `${history}\n\n${changedText}`;
}

interface HookInput {
  readonly source: string | undefined;
  readonly cwd: string | undefined;
}

function stringProperty(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const field: unknown = Reflect.get(value, key);
  return typeof field === 'string' ? field : undefined;
}

function readStdin(): HookInput {
  try {
    const input: unknown = JSON.parse(readFileSync(0, 'utf8'));
    return {
      source: stringProperty(input, 'source'),
      cwd: stringProperty(input, 'cwd'),
    };
  } catch {
    return {source: undefined, cwd: undefined};
  }
}

function gatherFacts(): SessionFacts {
  const input = readStdin();
  const start = input.cwd ?? process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
  const root = git(start, ['rev-parse', '--show-toplevel']);
  const branch = git(root, ['branch', '--show-current']);
  const notesFile = join(root, NOTES_PATH);
  const notes = readIfPresent(notesFile);
  return {
    source: input.source ?? 'unknown',
    branch,
    notes,
    notesUpdated:
      notes === null ? null : statSync(notesFile).mtime.toISOString(),
    status: readIfPresent(join(root, STATUS_PATH)),
    git: gitSummary(root, roleFor(branch)),
  };
}

function main(): void {
  let context: string;
  try {
    context = buildContext(gatherFacts());
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    context = `# Session context\n\nThe session context hook failed (${reason}). Read ${NOTES_PATH} and docs/STATUS.md yourself.\n`;
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: context,
      },
    }),
  );
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main();
}
