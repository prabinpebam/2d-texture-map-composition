# ADR-011: Deployment Isolation Headers

- Status: Deferred optimization

The transferable-buffer worker baseline requires no cross-origin isolation.
Do not require COOP/COEP for launch. Enable them only if measured WASM threading
or SharedArrayBuffer benefit justifies the embedding and asset compatibility
cost, with the non-isolated transferable path remaining fully functional.