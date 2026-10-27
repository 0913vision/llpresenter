# Audio replacement and reload regression plan

Use three generated PCM WAV files with distinct identities in a separate QA data
folder. Keep the hidden audio owner and every media element muted. These cases
establish decoder state and command ordering, not audible playback or
audio-device behavior.

Exercise the real media catalog, main live store and hidden audio renderer. For
timing-sensitive cases, control the spare decoder's readiness event or play
promise in the test harness. Restore each hook before continuing. A synthetic
failure or normal reload does not establish crash recovery.

## Replacement ordering

| Case                 | Steps                                                                                    | Expected                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Ready handover       | Play A, then request B while holding B's readiness event.                                | A remains playing until B can take over. The spare is not committed early.                      |
| Old end event        | While B is pending, deliver an ended event and versioned next command from A.            | Neither event advances or clears B's newer logical track.                                       |
| Pause during loading | Pause B before releasing its held readiness event.                                       | The old fallback pauses. When B becomes ready, it remains paused.                               |
| Resume replacement   | Resume the paused replacement after readiness.                                           | B plays from its retained position.                                                             |
| Late play resolution | Hold B's successful play promise, request C, then release B's promise.                   | The obsolete completion cannot commit B or unload C; only C remains playing.                    |
| Late fade completion | Begin fading A, replace it with C, then deliver A's old fade-complete and next commands. | C retains its identity and playback.                                                            |
| Repeated replacement | Alternate the three tracks repeatedly.                                                   | The owner retains its two-decoder pool; at most one settled decoder plays and all remain muted. |
| Output isolation     | Keep an unrelated slide live while replacing audio.                                      | Audio commands do not change the slide layer.                                                   |

## Failed spare decoder

| Case                 | Steps                                                         | Expected                                                                   |
| -------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Pending load failure | Hold B's readiness after A starts, then inject an error on B. | B does not take over; A stays unpaused and its playback position advances. |
| Next valid request   | Remove the readiness hook and request C.                      | C can take over normally and the obsolete decoder is released.             |

The error injection checks the player's failure path with otherwise valid
fixtures. It does not reproduce every native codec or file-system failure.

## Normal hidden-owner reload

| Case              | Steps                                                                                      | Expected                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Playing reload    | Play a track, record its identity and position, then reload the hidden owner.              | The same main-owned track resumes at its elapsed position instead of restarting from zero.                 |
| Paused reload     | Pause the track, record its position and reload again.                                     | Its identity and position remain; the prepared decoder stays paused.                                       |
| Resource lifetime | Compare owner window count, relevant main listeners and decoder count around both reloads. | The same hidden owner remains, listener counts stay stable and exactly two decoder elements are recreated. |

Sources: [output and audio](../../spec/03-output.md),
[media preparation](../../spec/05-prep.md), and
[live data contracts](../../spec/02-data.md).
