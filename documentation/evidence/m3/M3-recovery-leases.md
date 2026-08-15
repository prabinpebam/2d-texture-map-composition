# M3 Recovery, Quota, and Leases

## Outcome

The repository now stores integrity-checked pagehide/hidden checkpoints, prefers a
newer valid checkpoint during open, reclaims preview cache before one bounded
quota retry, and arbitrates project writers with six-second token leases renewed
every two seconds.

## Repository evidence

- Corrupt checkpoints return no draft but remain stored for diagnostics.
- Preview reclamation returns exact deleted bytes and never touches snapshots or
  source assets.
- Quota injection fails the first snapshot attempt, reclaims 128 preview bytes,
  and succeeds once on retry.
- Conflicting live leases reject; expired leases allow conditional takeover.
  Stale tokens cannot renew, release, or commit snapshots.

## Actual-app evidence

Microsoft Edge writes a pagehide checkpoint containing current authored work,
opens a newer valid draft as `Recovered prior snapshot`, and paints both restored
nodes. A two-tab journey shows the second tab read-only with Save/Add disabled,
then conditionally acquires the lease after the owner closes and the token expires,
after which it can save. `m3-read-only-takeover.png` retains the promoted writer
state.

Take Over broadcasts intent and retries at renewal intervals; it never overwrites
a still-valid foreign token.