# M3 Durability and Explicit Save

## Outcome

The toolbar Save command now queues the exact current authored graph through the
same atomic snapshot path as autosave. Meaningful authored work requests browser
persistent storage once, and runtime diagnostics distinguish persistent from
best-effort durability while showing the latest usage/quota estimate.

## Actual-app evidence

Microsoft Edge uses controlled browser capability responses to prove one and only
one `navigator.storage.persist()` request after the first authored node, explicit
Save completion with `Saved locally`, and visible diagnostics showing persistent
durability plus `1.0 MB of 100.0 MB used`. The retained screenshot is
`m3-explicit-save.png`.

The autosave timer and Save command share one serialized promise queue, so an
explicit save awaits earlier work and cannot race the project revision pointer.

Full parallel regression also exposed and closed an async hydration paint race:
React Flow now mounts after local project load and refreshes custom-handle
internals after layout settlement. Reloaded and imported nodes have verified
visible, nonzero wrapper/body geometry instead of remaining internally hidden.