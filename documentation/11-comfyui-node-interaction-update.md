# ComfyUI Node Interaction and Driven-Widget Update

## 1. Status and authority

This document records the user-directed product update dated 2026-08-15. It is
a material amendment to the node-first workbench contract. Where prior derived
documents say ComfyUI is only a behavioral reference or retain a conflicting node
appearance/interaction, this update takes precedence. The immutable
`seed-spec.md` remains unchanged.

## 2. Updated outcome

TextureFlow nodes use the established ComfyUI node interaction model for node
chrome, movement, resizing, sockets, links, widgets, and connection gestures,
while retaining TextureFlow's image-processing types, deterministic execution,
local persistence, accessibility, and branded application chrome.

The required outcome is functional parity, not a static resemblance:

- The title bar is the node drag surface; operating the body never moves the node.
- Nodes resize from every corner with the same unconstrained pointer affordance,
  bounded only by readable minimums and product memory/layout limits.
- Resizing reallocates usable node content in real time. Fixed chrome remains
  compact while preview/thumbnail/result regions expand to consume remaining
  width and height; a larger node may not retain a small fixed preview surrounded
  by unused space.
- Typed circular sockets sit on the left for inputs and right for outputs, align
  with their labels or widget rows, use stable type colors, and remain fully
  visible outside the node border without clipping.
- Dragging a typed output to a compatible same-type input creates a curved link.
  Incompatible targets visibly reject the link.
- Dragging from a connected input detaches/reconnects it. Releasing a link on
  empty canvas opens a compatible-node search surface at the release point.
- Every editable widget has a corresponding typed input socket. Its manual value
  remains authored as fallback. A connected input drives the effective runtime
  value, disables direct editing, and leaves the fallback visible. Disconnecting
  restores manual control without losing the fallback.
- Node state, collapse, selection toolbox, context menu, title rename, cloning,
  bypass, mute, lock, and deletion follow the same direct-manipulation model.
- Node position follows the pointer continuously during title drag. The authored
  command/history/revision commits once at pointer release; the node may not jump
  from its old to final position only after release.
- React Flow owns transient pointer movement and edge repaint. Dragging never
  dispatches image/workflow compute, and React result updates may not reset the
  library's in-progress position.
- Load Image follows the ComfyUI source-node pattern: browse/replace inside the
  node, drop an image file onto the node, or paste a copied image while the graph
  is active. The node shows the actual source thumbnail plus name and dimensions.

## 3. Typed widget-input contract

Each widget schema declares `inputType` independently from its visual widget kind:

| Widget value | Socket type | Color token |
| --- | --- | --- |
| integer | `integer` | light green |
| floating point | `float` | pale green |
| text/enum | `string` | pink |
| boolean | `boolean` | red |
| color | `color` | white-ring swatch |
| image | `image` | blue |
| mask | `mask` | green |
| height/normal/light | existing semantic type | existing semantic token |

Parameter socket IDs are canonical `parameter:<serialization-key>`. They are
optional single-cardinality graph inputs generated from the same node widget
schema used by node and inspector controls. Import, validation, serialization,
connection dialogs, pointer linking, execution planning, and cache identity all
consume these generated definitions; no component owns a private port list.

For node `N`, widget key `K`, authored fallback `M`, and connected upstream value
`E`, the effective value is:

```text
effective(N.K) = E when parameter:K has one valid incoming edge, otherwise M
```

External values never overwrite `M`. Connection/disconnection is one undoable
command. A connected widget is read-only in both node and inspector, announces
that it is externally driven, and retains the fallback for restoration.

## 4. Node anatomy and gestures

React Flow implementation follows its official custom-node, handles, and
NodeResizer guidance (`reactflow.dev/learn/customization/custom-nodes`,
`reactflow.dev/learn/customization/handles`, and
`reactflow.dev/examples/nodes/node-resizer`): React Flow owns the interactive node
wrapper; each socket is a measurable `<Handle>` with a unique ID and manually
positioned side offset; dynamic handle layouts refresh node internals; and
`NodeResizer` remains in the custom node. Therefore the interaction root stays
overflow-visible. An inset visual surface owns rounded border/background/
selection paint with overflow hidden, while media/footer regions independently
contain their content. The whole node root is never clipped around its handles.

The node shell is ordered as:

1. colored title bar with title and compact state;
2. typed required/optional data sockets;
3. widget rows with matching parameter sockets;
4. output/result surface;
5. resize affordances and selected-node toolbox.

Sockets have a 12 px visible circle and at least a 24 px hit target. Links attach
to socket centers. The visible circle straddles the node edge and is never clipped
by node body, preview, selection, or resize overflow. Socket and edge colors encode
type consistently, but labels and shape/state remain available for accessibility
and forced colors.

Pointer rules:

- drag title bar: move node;
- drag any corner: resize node;
- drag output socket: start compatible connection;
- drag connected input socket: detach and reconnect;
- release connection on empty canvas: compatible node search;
- double-click title: rename;
- double-click empty canvas: general node search;
- body widget/preview pointer input: never starts node drag or canvas pan.

During resize, controls reflow to available width and image surfaces update their
CSS bounds continuously without re-decoding or re-running the workflow. Images
preserve aspect ratio with contain-fit unless the user explicitly selects another
view mode. The authored size commits once at pointer release and round-trips.

## 5. Architecture amendment

- `node-widget-schema` owns widget type, parameter socket type, key, fallback,
  validation, and compact/inspector rendering.
- `node-type-registry` composes static semantic data inputs with generated
  parameter inputs and is the sole graph-validation source.
- `effective-parameter-resolver` resolves connected values without mutating
  authored fallback parameters and contributes source identity to cache keys.
- `react-flow-adapter` renders generated sockets and maps connection state; it
  contains no type or default definitions.
- Workflow JSON persists both fallback parameter values and parameter edges.

## 6. Reopened work packages

- R1.7 Rebuild node chrome, drag handle, corner resize, sockets, link styling,
  selected toolbox, and rename/collapse behavior to the ComfyUI interaction model.
- R1.8 Generate typed parameter inputs from every editable widget and render
  node/inspector externally-driven state from one schema.
- R1.9 Resolve externally driven values through draft/run/cache execution without
  mutating manual fallbacks; add primitive number/string/boolean/color source
  nodes required to drive every P0 widget type.
- R1.10 Add input detach/reconnect, empty-link compatible search, compatible target
  highlighting, and pointer/keyboard equivalents.
- R1.11 Keep sockets and their 24 px hit targets unclipped; publish transient node
  positions continuously during drag and commit one authored move on release.
- R1.12 Rebuild Load Image as a node-local source surface with browse/replace,
  image-file drop, clipboard image paste, actual thumbnail, metadata, validation,
  and shared asset import semantics.
- R1.13 Remove automatic graph-preview effects and prove React Flow movement stays
  smooth while all workflow workers remain idle until explicit Run.
- R1.14 Make node contents container-responsive: preview/source/result surfaces
  fill available node space during resize, controls reflow at narrow widths, and
  resizing triggers no workflow compute.
- R1.15 Add a reusable node geometry capture/detector matrix so content fit,
  socket exceptions, hit testing, and media paint are enforced automatically for
  all node states and supported size/aspect variants.
- R1.16 Adopt the React Flow outer-interaction/inner-surface node structure:
  overflow-visible handles and resize controls outside an inset rounded,
  overflow-hidden visual surface, with automated radius/socket geometry evidence.

R1.7-R1.10 block R1 closure and user-facing M5 closure. Previously valid graph,
persistence, numerical, worker, preview, and explicit-run evidence remains valid
unless a new parameter-edge execution test falsifies it.

## 7. Exit evidence

- Pixel/geometry capture matches the approved ComfyUI node anatomy: title drag
  surface, socket centers, widget alignment, corner resize, and curved links.
- Dragging a widget does not move a node; dragging the title does.
- During title drag the rendered node tracks every pointer move; release creates
  one undo entry/revision and undo restores the pre-drag position.
- Every editable field exposes exactly one correctly typed parameter socket in the
  node schema and workflow model.
- Connecting an external value disables manual editing, drives execution, alters
  output/cache identity, and preserves the manual fallback through save/reload.
- Disconnecting restores the exact prior fallback value and creates one undoable
  command.
- Input detach/reconnect and empty-link compatible search work with real pointer
  input; incompatible links cannot commit.
- Edge E2E captures socket/edge colors, hit testing, graph state, effective values,
  result pixels, serialization, undo/redo, and accessibility names.
- Socket geometry is sampled outside each node border and remains visible and
  hit-testable. Load Image browse, drop, and clipboard paste each show real source
  pixels in-node and feed the same persisted asset/output pipeline.
- Increasing Preview or Load Image bounds measurably increases its painted image
  area during the pointer gesture; shrinking preserves usable controls, sockets,
  aspect ratio, and stable hit targets without recomputation.
- Rounded corners remain visibly intact in normal/selected/locked/bypassed states;
  the inner surface covers the exact owner rectangle and clips internal paint,
  while every socket still straddles and hit-tests outside that rectangle.
