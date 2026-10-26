# Review request: `data-76`

- Team member: data
- Branch: `break/data/grouped-song-schema`
- Stacked specification: data-75 round 2; exact range in member report.
- User decision: October 27, group-based song arrangements.

## What changed and why

Adds the version 2 contract in `src/shared/schema/groupedSong.ts`:
`GroupedSong`, `SongGroup`, `GroupArrangement`, `groupedSongSchema`,
`songGroupSchema`, `parseGroupedSong` and `serializeGroupedSong`. Groups have
branded UUIDs, names and source slides. Arrangements reference groups, permit
repeats and reject dangling IDs. Unknown fields round trip.

`songGroupMigration.ts` validates the entire old song first, unions label-run
boundaries with every arrangement's consecutive-stretch boundaries, and assigns
IDs to the resulting groups. Mapping each stretch to those IDs preserves its
exact slide expansion. Lyrics are stored once. Known labels become group names;
unknown fields survive, including prototype-sensitive keys and collisions with
new `groups` keys. Existing migration machinery records the original version.

The active `Song`/`parseSong`/`serializeSong` API and persistence/IPC callers
are unchanged. Consumers can adopt the new contract before data activates it in
persistence. This request does not claim that operators can already edit groups.

## Bounds and decisions

`SONG_GROUP_LIMITS` bounds source slides and groups at 10,000 each, named
arrangements at 1,000 and total group occurrences at 100,000 per song. Spec 02
records these caps. Oversized input fails rather than being truncated. There is
no expanded-song cache, file IO, subscription, timer or window in this API.
Consumers must avoid materializing huge repeated-slide expansions.

Migration generates group UUIDs in memory; the first version 2 save persists
them. Reloading a still-unmodified version 1 file may generate different local
IDs, with no external references to them. Group IDs are scoped to their song.

## Changes outside my paths

Spec 02 adds the named schema caps to the data-75 contract. All code and tests
are in data-owned shared schema paths. No editor, grid, chip or live code is
changed; the lead assigns those consumers after this contract lands.

## Checks

- Related schema tests, typecheck, changed-file lint and formatting: final
  results in the member report.
- Regression cases include same-label runs, partial/reversed/repeated orders,
  cross-arrangement cuts, empty fallback, unnamed/nonadjacent groups, invalid
  old references, unknown-key collisions and schema bounds. A loop checks all
  four-slide sequences through length four against exact legacy expansion,
  including a second arrangement and the implicit master order.
- Fixtures contain invented sentences only.
- Full verify: CI pending (API 403); lead confirms the exact head.

## Checked in the app

This is an inactive contract and migration API with no operator-visible change.
The current version 1 codec remains active, covered by regression tests. No app
screenshot can demonstrate the new API before consumer integration. Visible
editor/grid/chip/live requests and persistence activation need their own
real-app checks, including old-file load, edit and save.
