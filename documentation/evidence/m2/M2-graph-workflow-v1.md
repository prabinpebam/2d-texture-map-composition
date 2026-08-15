# M2 Graph Workflow v1

## Outcome

Graph-only workflow v1 now has a Draft 2020-12 JSON Schema and a parser that
replays every edge through canonical type, cardinality, duplicate, and cycle
validation before publishing an authored document.

## Evidence

- Exact node/edge/project/viewport round-trip passes.
- Invalid JSON, schema violations, unknown node types, duplicate IDs, invalid
  edges, and semantic cycles fail without an editable document.
- Property-generated acyclic resize chains up to 60 nodes round-trip exactly.
- A deterministic 300-node, 299-edge graph validates inside the 500 ms test gate
  without image compute.

The actual import/export command UX remains an open M2 work item; this milestone
freezes its validated data boundary first.