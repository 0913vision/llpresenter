# Review request: `<name>-<number>`

- Team member: `<session name>`
- Branch: `<tag>/<name>/<feature>`
- Base commit (`rewrite`): `<hash>`
- Last commit: `<hash>`
- Related brief: `docs/briefs/<name>.md`

## What changed and why

## Changed files

## Checks run

| Command or test                    | Result |
| ---------------------------------- | ------ |
| `npm run typecheck`                |        |
| `npm test`                         |        |
| `npm run format:check`             |        |
| `npm run verify` (from phase 1 on) |        |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes
- [ ] `npm run format:check` passes
- [ ] Every new behavior and every bug fix has unit tests
- [ ] Values from outside the process are validated with a schema
- [ ] No `any`, no type assertions that bypass checks, and no `!`
- [ ] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released
- [ ] Caches and lists have size caps
- [ ] An exception in the output path doesn't stop the output
- [ ] Only what's needed re-renders (control window)
- [ ] The clean code rules in `CLAUDE.md` hold: clear names, small functions
      that do one thing, a single responsibility per module and class, no
      repetition, named constants instead of magic values, explicit side
      effects, no silently swallowed errors, and fast, independent, repeatable,
      and readable tests
- [ ] Comments follow `CLAUDE.md`: TSDoc only (`/** ... */`),
      `// NOTE(0913vision): ...`, `// TODO(0913vision): ...`, and nothing else
      (no other comments and no commented-out code)
- [ ] The code uses the modern language features that `CLAUDE.md` lists (for
      example, `const` and `let`, `async` and `await`, optional chaining and
      `??`, `readonly`, and `satisfies`), except where the Google TypeScript
      style guide decides otherwise
- [ ] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant):

## Decisions I made (for the lead to confirm)

## Shared contract change requests

## Where to look

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.
