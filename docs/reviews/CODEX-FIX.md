# How Codex analyzes a bug

The lead sends a Codex window one line:
`Analyze docs/reviews/bug-<id>.md at commit <commit>. Follow docs/reviews/CODEX-FIX.md.`
The bug document says what was seen. Codex finds the cause and proposes the fix;
the owning team member writes the code.

## Rules

- Read-only. Use only `git show <commit>:<path>`, `git grep <pattern> <commit>`,
  `git log`, and reading files under the given commit. The working tree may be
  on another branch, so always read through the commit. Never edit files,
  commit, switch branches, run `npm install`, start the app, or push. Don't run
  tests or builds.
- Answer in English.

## What to do

1. Read the bug document, `CLAUDE.md`, and the spec sections it points to.
2. Follow the code path from the trigger to the symptom. Name every place that
   could cause it, then rule each one in or out with evidence from the code
   (file and line), not guesses. Check the Electron and Node behavior you rely
   on against their documentation and say which version it applies to.
3. Give the most likely cause, how sure you are, and what measurement would
   confirm it if the code alone can't.
4. Propose the smallest fix that removes the cause and keeps the rules in
   `CLAUDE.md` (stability first, release everything you register, cap every
   cache). Describe it in words with short code excerpts; don't write a full
   patch.
5. Propose the tests that fail on the current code and pass after the fix.

## Report

Reply in exactly this form, so the lead's tools find it:

```text
• Reviewer verdict for bug-<id>
- Verdict: Cause found | Likely cause | Not found
- Findings:
  1. Cause: file:line what happens, with the evidence.
  2. Fix: what to change.
  3. Tests: what fails now and passes after.
  4. Confirm: the measurement that would prove it, if needed.
```
