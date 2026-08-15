# M2 Typed Connections

## Outcome

React Flow handle connections now dispatch through the canonical domain
validator. Compatible edges enter authored history; missing entities/ports,
incompatible types, cardinality overflow, duplicates, and cycles reject before
mutation with an ephemeral visible diagnostic.

## Evidence

- Domain tests prove compatible creation, exact rejection diagnostics, and
  authored document identity preservation on rejection.
- Microsoft Edge first drags Image output to Material Lights and observes zero
  edges plus `Connection rejected: incompatible type`.
- The user retries from the same output to Material Base color and sees one
  painted edge. SVG evidence includes nonempty path data, positive path length,
  visible nonzero stroke/opacity, and diagnostic recovery.
- `m2-typed-connections.png` retains the final visible graph state.