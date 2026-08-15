# UX and Design System Specification

## 1. Experience Outcome

The application must feel like a focused desktop creative tool in a browser:
dense, predictable, quick to scan, and usable for repeated graph editing. The
node canvas is the primary work surface, not a marketing page. Image processing
is visible through previews and status, but the UI never blocks direct
manipulation while waiting for full-resolution work.

## 2. Information Architecture

### Application regions

| Region | Default placement | Contents |
| --- | --- | --- |
| App bar | top, 44 px | project name/save state, undo/redo, import/export, theme/settings |
| Node library | left, 240 px resizable | search, categories, draggable/add commands |
| Graph | center, remaining space | React Flow canvas, nodes, edges, selection, minimap |
| Inspector | right, 300 px resizable | optional advanced parameters, metadata, validation, docs, multi-edit |
| Queue/history | right drawer/tab | run controls, active progress, recent runs, diagnostics, cancel/retry |
| Status bar | bottom, 28 px | zoom, graph validity, compute, storage, backend state |

The graph must retain at least 480x320 CSS pixels at supported desktop minimum.
Below that threshold, library and inspector become modaless drawers and preview
becomes a bottom sheet or full workspace tab. User-resized panel widths persist as
settings, not workflow state.

### Region navigation

- `F6` and `Shift+F6` move among app bar, library, graph, inspector/preview, and
  status details.
- Each region has a programmatic landmark/name and one predictable entry point.
- Closing a drawer/dialog returns focus to its invoking control.
- Focus never lands behind an open modal or entirely under a panel.

## 3. Primary Workflow Layout

The first screen opens the last project or project chooser; it never opens a
landing page. A new project opens a blank graph with the node library ready and a
compact empty-state command in the canvas. Importing several images places Load
Image nodes in a non-overlapping grid near the viewport center and selects them.

The canvas is the complete ordinary editing surface. Nodes contain their common
widgets and result previews; a user can build, configure, run, inspect, and fix a
principal workflow without opening the inspector. The inspector mirrors the same
schema at larger scale and adds advanced/detail views. Double-clicking a node
focuses its first node-local control; an explicit **Open in inspector** command
focuses the mirrored field when more room or detail is needed.

The top app bar contains **Run workflow**, **Interrupt**, and queue status. Run
uses `Ctrl+Enter`; selected output nodes expose **Run branch** in the nearby node
toolbox and context menu. The queue/history panel is supporting workspace chrome,
not the place where node parameters are authored.

## 4. Graph Interaction Model

### Pointer and touchpad

- Primary drag on empty canvas pans when Space is held; middle-button drag always
  pans. Configurable “pan on drag” may invert this for user preference.
- Wheel/trackpad scroll pans; `Ctrl+wheel` zooms around pointer. Browser zoom
  remains available from browser UI and keyboard where the browser reserves it.
- Drag from output port to compatible input creates an edge on pointer-up.
- Dragging a node template from the library onto the graph creates it centered at
  the drop coordinate. The library item remains available and failed/outside
  drops create no authored command.
- Double-clicking empty canvas opens the node search chooser; selection inserts at
  the double-click coordinate in graph space.
- Dragging to empty canvas opens a compatible-node chooser; cancel creates no
  mutation.
- Selection rectangle starts only from empty canvas and has additive modifier.
- Destructive pointer commands complete on pointer-up and are undoable.

### Keyboard graph composite

The graph is one tab stop. It uses roving focus among nodes and edges so a large
graph does not add hundreds of tab stops.

| Key | Graph action |
| --- | --- |
| Arrow | Move focus spatially to nearest node in direction |
| `Enter` / `Space` | Select focused item; `Shift` toggles multiselection |
| `Alt+Arrow` | Move selected unlocked nodes by 1 px; add `Shift` for 10 px |
| `Delete` | Delete selected unlocked items with undo |
| `Shift+C` | Open Connect dialog for focused/selected node |
| `Shift+A` | Open Add Node command at focused location |
| `/` | Open searchable Add Node chooser at current viewport center |
| `Shift+R` | Open numeric Resize Node dialog |
| `Home` / `End` | Focus first/last node in topological then ID order |
| `Escape` | Cancel gesture/dialog, then clear selection |
| `Shift+F10` | Open context menu |
| `Ctrl+Enter` | Run workflow / append to queue |
| `Ctrl+Shift+Enter` | Run workflow next/front of queue where enabled |
| `Ctrl+Alt+Enter` | Interrupt active run |
| `Alt+C` | Collapse/expand selected nodes |

The Connect dialog selects output port, compatible target node, and input port
using ordinary list/combobox controls. It is the non-drag equivalent required by
WCAG. Numeric Position/Size commands provide non-drag movement and resizing.

### Node search and placement

The Add Node chooser is one shared modal surface for `/`, `Shift+A`, and canvas
double-click. It opens centered in the visible graph viewport with a focused
search field and an unframed result list. Search matches node label, category,
and summary. Arrow Up/Down changes the active option, Enter inserts it, pointer
click inserts it, and Escape closes without mutation. Active-option state is
exposed through combobox/listbox semantics and selection never requires Tab.

`/` and `Shift+A` place the chosen node at the center of the currently visible
graph framing. Double-click preserves the clicked graph coordinate. Library drag
and drop preserves the pointer's graph coordinate. All paths account for current
pan/zoom, center the node on the requested point, select the new node, create one
undoable authored command, and return focus to the graph.

### Required shortcuts

| Command | Requested shortcut | Reliable access |
| --- | --- | --- |
| Bypass selected | `Ctrl+B` | node toolbar, context menu, inspector switch |
| Mute selected | `Ctrl+M` | node toolbar, context menu, inspector switch |
| Lock selected | `Ctrl+L` | node toolbar, context menu, inspector switch |

Browsers reserve or reuse these combinations, especially `Ctrl+L` for the
address bar and `Ctrl+B` for bookmarks. The app implements them when delivered
while graph/node focus is active, never when editing text, but must not claim
cross-browser reliability. Shortcuts are user-remappable and are never the only
path. Default conflict-free alternates are `Ctrl+Shift+B`, `Ctrl+Shift+M`, and
`Ctrl+Shift+L`. Shortcut settings show conflicts before assignment.

### Zoom and navigation

- `+`/`-`: zoom in/out; `0`: 100%; `1`: fit graph; `2`: fit selection.
- Toolbar controls use familiar icons with tooltips and accessible names.
- Minimap is pannable, labels the current viewport, and can be hidden.
- Focusing an offscreen node pans it into view without changing zoom unless the
  node cannot fit at current zoom.

## 5. Node Anatomy

```text
+----------------------------------+
| type icon  Node title       state|
| input labels              outputs|
| common parameter widgets         |
| optional live result / preview   |
| status / warning / run progress  |
+----------------------------------+
```

Node bodies are interactive work surfaces, not summaries. Compact widget rows use
the same shared controls and validation as the inspector. Inputs, sliders, selects,
preview pan/zoom, and buttons carry the no-drag/no-pan contract. Pointer events on
widgets never begin node move, canvas pan, or edge creation.

The visual and interaction baseline for node chrome is ComfyUI as amended in
`11-comfyui-node-interaction-update.md`: colored title drag bar, compact dark node
body, circular typed sockets on the outer left/right edges, curved type-colored
links, corner resizing, title rename, and floating selected-node tools. Product
application chrome remains TextureFlow-branded.

### Stable dimensions

- Default simple-node width: 240 px; interactive/preview nodes may default to
  280-360 px; minimum 180 px; maximum 640 px.
- Header: 32 px minimum; port row: 28 px minimum.
- Resize handles have at least a 24 px hit target, even if the visible glyph is
  smaller. Resizing cannot hide required controls or truncate a port label.
- Node outer chrome must allow sockets and resize affordances to paint beyond the
  body border. Internal content clips within dedicated inner surfaces; the node
  root never clips socket circles or their hit targets.
- At distant zoom, internal controls collapse to title/type/state while ports and
  selection remain legible. Layout does not reflow during hover or progress.
- Node-local previews use an authored or type-default aspect ratio and explicit
  min-height. Empty/loading/stale/error/cached/result states occupy identical
  bounds. Image arrival cannot move neighboring nodes or handles.
- Collapse hides widgets and preview but retains title, state, ports, dirty/result
  indicator, and authored values. Collapse is authored UI state and round-trips.

### State presentation

| State | Required visual and semantic treatment |
| --- | --- |
| Focus | high-contrast continuous outline distinct from selection |
| Selected | accent border/background marker; `aria-selected=true` |
| Locked | lock icon and text in status; controls disabled, unlock remains available |
| Bypassed | diagonal route marker, “Bypassed” text, dimmed processing body |
| Muted | output-port stop marker, “Muted” text, downstream invalidity if required |
| Computing | determinate progress when measurable, otherwise restrained indicator |
| Dirty | text/icon indicates authored changes are not represented by current completed run |
| Queued | queue position or queued text; no animated edge |
| Cached | “Cached”/“Reused” text and result remains visible |
| Succeeded | completed state tied to captured revision; result is current or explicitly stale |
| Canceled | canceled text; prior valid result remains where available |
| Stale | previous preview remains with visible “Updating” label |
| Warning | warning icon, count, concise summary; output may remain valid |
| Error | error icon/text, affected port, actionable inspector details |

State cannot rely on hue alone. Focus, selected, and error must remain distinct
in forced colors and monochrome screenshots.

### Ports and edges

- Shape encodes type: color image circle, mask diamond, height square, normal
  hexagon, light triangle, generic color swatch-ring.
- Labels are always available to accessibility APIs and appear visually when
  node width permits or port receives focus/hover.
- Compatible targets highlight by shape plus contrast, not color alone.
- Edges inherit source type styling but selected/focused/error overlays are
  independent. Animated edges are not used for ordinary compute status.
- Every editable widget row has a schema-generated left input socket aligned to
  that row. When connected, the control is visibly read-only and labeled driven;
  the manual fallback remains visible. Dragging the connected socket detaches and
  begins reconnect; releasing a link on empty canvas opens compatible-node search.
- Title dragging updates visible node geometry on every pointer move. Selection,
  edges, sockets, and minimap follow in real time; only release enters history.

### Node selection toolbox and context menu

The selected-node toolbox appears adjacent to the selection and includes only
high-frequency commands: Run branch for output nodes, bypass, mute, lock,
duplicate, and delete. Context menu contains the complete equivalents plus rename,
collapse/expand, bring to front, and inspector/details. Keyboard focus can enter
and leave the toolbox without losing node selection.

## 6. Node Widget and Inspector Contract

### Single schema

Every editable field is declared once with key, type, label, unit, bounds,
default/reset, compact placement, inspector placement, validation, direct-entry
behavior, and serialization. Node and inspector renderers consume that schema.
Parity tests fail when either surface is missing a field, writes a different key,
uses a different default, or produces different undo/preview behavior.

### Node-local ordinary controls

- **Load Image:** Browse/Replace, file drop target, clipboard image paste, output
  Color/Mask, mask source, invert, filename/dimensions, and actual source thumbnail.
  The preview occupies stable bounds and is not a decorative placeholder.
- **Resize:** width/height, px/percent, aspect lock, preset, resolved method, reset.
- **Color Correction:** compact hue, saturation, temperature, green-magenta, tint,
  tint mix, direct numeric values, reset.
- **Brightness:** exposure, highlights, shadows, whites, blacks, reset.
- **Preview:** live node-local bitmap/mask, fit/100%, interpretation, dimensions,
  stale/running/cached/error state and Run branch command.
- Future node types follow the inventory in this section and amendment document;
  ordinary controls cannot be inspector-only.

### Inspector role

Inspector groups controls by Input, Processing, Appearance, Output, and Advanced.
Groups are unframed sections, not cards. It mirrors node widgets and supplies
advanced options, metadata, detailed diagnostics, documentation, larger preview,
and multi-selection editing. Closing the inspector cannot make a principal node
workflow inoperable.

Every control has visible label, unit, current value, valid range, reset, and
inline validation. Slider plus numeric field is one logical setting. Slider arrow
keys use fine step, Page Up/Down use coarse step, Home/End use bounds. Input
commits on valid change; invalid text remains local until corrected or canceled.

Changes show draft preview continuously when affordable, but undo history gets
one command per completed gesture/edit session. `Escape` during a slider drag or
uncommitted text edit restores the before value.

### Shared node/inspector control inventories

- **Load Image:** asset summary and replace/relink; output Color Image/Mask;
  mask source, invert, and clamp. P1 Color Profile offers Auto, Embedded, Force
  sRGB, Force linear-sRGB, and Ignore Profile, with detected-profile explanation.
- **Color Correction:** Hue `-180..180` degrees, Saturation `-100..100`,
  Temperature `-100..100`, Green-Magenta `-100..100`, Tint Color through the
  shared picker, and Tint Mix `0..100%`. Numeric fields accompany sliders.
- **Brightness Correction:** Exposure `-8..8 EV` plus Highlights, Shadows,
  Whites, and Blacks at `-100..100`, each as slider plus numeric field.
- **Material:** base source/color, opacity, relief interpretation/strength,
  ambient/diffuse, and ordered lights. When using the implicit default, show its
  NW/315-degree/45-degree/intensity-1/white values and an **Add as Light node**
  command. The command creates and connects an equivalent Light without changing
  output.
- **Merge:** foreground/background assignment, Swap Layers, mode catalog/space,
  opacity/mask, canvas alignment, and P1 relief/lights.

Each node type implements this inventory through shared field components and
parameter schemas; it does not create private slider, color, or validation UI.

## 7. Preview Surface

- Preview output is rendered directly inside Preview and result-producing nodes.
  The inspector can mirror/enlarge the same handle, but cannot be the only result
  surface. Preview is never nested in a decorative card.
- Toolbar contains Fit, 100%, zoom, pan, background, mask view, compare, and
  export commands as icons with tooltips.
- Metadata strip shows logical dimensions, preview scale, interpretation, color
  space, generation state, and pixel value under cursor.
- Before/after comparison supports split slider and side-by-side. A segmented
  control selects mode; keyboard fields set split percentage without dragging.
- Fullscreen preview returns to the same node and focus on close.
- Error, empty, stale, and OOM states occupy stable dimensions and never resize
  surrounding controls.

## 7A. Workflow Run and Queue UX

- **Run workflow** is a primary app-bar command with text/icon, accessible name,
  disabled/invalid explanation, and `Ctrl+Enter` shortcut.
- **Run branch** appears in the selected output node toolbox/context menu. It names
  the output and does not imply that disconnected output branches were run.
- **Interrupt** is available only while queued/running work exists and never uses
  a destructive confirmation for ordinary cancellation.
- Queue/history panel lists active first, then recent newest-first. Each row shows
  target, captured revision, state, elapsed time, cache summary, progress, and
  diagnostics. Failed/canceled rows retain retry and inspect actions.
- Running nodes show local progress and the active run ID in accessible details.
  Cached nodes report cached rather than flashing through running.
- Editing while a run is active is allowed. Existing output remains visible; the
  completed older run becomes explicitly stale and never silently replaces a
  newer current result.
- Queue badges and node states use icon/shape/text as well as color. Live regions
  announce queued, started, completed, failed, canceled, and takeover states
  without moving focus.

## 8. HSL Color Picker

### Design-source dependency

The seed requires visual parity with a referenced design, but no design asset or
node is present in the repository. Exact appearance is therefore blocked until
that source is supplied. The product must not fabricate a “parity” claim. The
behavioral and accessibility contract below is implementation-ready and remains
valid when visual tokens are mapped to the source.

### Anatomy

- Current and previous color swatches.
- Two-dimensional saturation/lightness field at the selected hue.
- Hue slider; alpha slider only where alpha is accepted.
- H, S, L numeric inputs and hex input.
- Eyedropper may be added only when browser support and privacy behavior pass a
  separate decision; it is not P0.
- Apply/Cancel buttons only when used in a modal/popover editing transaction;
  inline picker commits continuously with undo coalescing.

### Behavior

- Hue field wraps at 360; S/L clamp; hex accepts `#RGB`, `#RRGGBB`, and alpha
  forms only where alpha is allowed, then serializes canonical uppercase.
- Achromatic colors retain the last meaningful authored hue for future saturation
  edits, while output HSL reports hue as not applicable where mathematically
  powerless.
- Arrow keys move 1 unit, Shift+Arrow 10; Home/End move to axis bounds.
- A direct numeric/hex path provides the non-drag alternative for every spatial
  control.
- Popover traps focus only while modal behavior is intentional; `Escape` cancels
  and restores prior color/focus. Click outside follows the same documented
  commit/cancel rule across all usages.
- Swatches expose a text name containing canonical hex and HSL. The picker never
  uses color alone to indicate invalidity, selection, or gamut warning.

## 9. Dialogs, Menus, and Feedback

- Short focused tasks and confirmations use dialogs: import report, relink asset,
  numeric node transform, export, storage cleanup, takeover, and destructive
  deletion.
- Substantial workflows use workspace views: project browser, settings, recovery,
  and migration report.
- Menus use conventional arrow/Home/End/Escape behavior and return focus.
- Tooltips are dismissible, hoverable, persistent while relevant, and duplicate
  accessible names only when they add explanation.
- Toasts never carry the only copy of an error. Save/export success can be a live
  status; actionable failures persist in status/details.

## 10. Design System Foundations

### Architecture

Design tokens are the only source of primitive visual values. Components own
their states and context styles; page selectors must not repaint component
internals. React components, stories/examples, and production use the same source.

Token layers:

1. **Primitive:** color ramps, font families/weights, spacing, radii, durations.
2. **Semantic:** canvas, surface, text, border, accent, danger, warning, focus,
   selected, disabled, port types.
3. **Component:** only when a semantic combination cannot express a stable
   component need.

Theme changes remap semantic tokens and cannot alter geometry, control meaning,
or image output.

### Core tokens

```css
:root {
  --font-ui: "IBM Plex Sans", "Segoe UI", sans-serif;
  --font-mono: "IBM Plex Mono", "Cascadia Mono", monospace;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --radius-control: 4px;
  --radius-panel: 6px;
  --control-height: 28px;
  --target-min: 24px;
  --focus-width: 2px;
  --motion-fast: 100ms;
  --motion-normal: 160ms;
}
```

Letter spacing is 0. Type sizes are discrete tokens, never viewport-scaled.
Cards are reserved for repeated project items and dialogs; workspace regions are
unframed panels/bands. Nodes are functional graph objects, not nested cards.

### Semantic color contract

Both light and dark themes define at minimum:

`--canvas`, `--surface-1`, `--surface-2`, `--surface-raised`, `--text-1`,
`--text-2`, `--border`, `--border-strong`, `--accent`, `--accent-text`,
`--focus`, `--selected`, `--danger`, `--warning`, `--success`, and each
`--port-*` type.

Token tests assert text 4.5:1 and required UI/state 3:1 across actual adjacent
pairings. Forced-colors mode maps controls to system colors and preserves border/
outline state. Preview pixels are user content and excluded from UI contrast,
but preview controls are not.

### Motion

Motion communicates opening, focus movement, and state transition; it is not
continuous decoration. Compute progress uses determinate bars or non-flashing
indicators. `prefers-reduced-motion` removes spatial animation while preserving
instant state changes. Nothing flashes more than three times per second.

## 11. Component Inventory

| Family | Components |
| --- | --- |
| Commands | icon button, text button, split button, toolbar, command palette, menu |
| Inputs | text, number, slider+number, checkbox, switch, segmented control, select, combobox, color field |
| Graph | node shell, typed port, edge, resize handles, minimap, graph controls, selection marquee |
| Node widgets | schema renderer, compact field row, collapse control, selection toolbox, result viewport |
| Status | inline message, progress, badge, status bar item, live announcer, toast |
| Overlays | tooltip, popover, menu, dialog, drawer |
| Data/media | image preview, mask preview, checkerboard, swatch, comparison, pixel readout |
| Project | project item, import report, asset relinker, recovery item, storage meter |
| Execution | run button, interrupt button, queue badge, run row, node progress, run diagnostics |

Every component has normal, hover, focus-visible, pressed/selected, disabled,
error, loading where applicable, high-contrast, light, and dark evidence. A
component cannot ship with states implemented only in a documentation mock.

## 12. Accessibility Acceptance

Manual and automated checks must prove:

1. All principal workflows complete with keyboard only at 100% and 200% zoom.
2. Add/connect/move/resize/reorder/swap operations complete without dragging.
3. Screen-reader output identifies node type/title/state, ports, edge endpoints,
   validation, progress, and save/export results.
4. Focus remains visible, logical, and restored after deletion/dialogs/drawers.
5. Focus and selection remain distinguishable in light, dark, and forced colors.
6. Target size/spacing, text, non-text contrast, reflow, hover/focus content, and
   reduced motion meet WCAG 2.2 AA.
7. A graph list/outline alternative exposes nodes in topological order and edges
   as textual relationships for inspection and connection commands.
8. Principal import/configure/run/inspect/fix flow completes without opening the
  inspector; node-local widgets expose visible labels and validation.
9. Node widgets do not trigger drag/pan, and node-local preview controls have
  keyboard equivalents.

## 13. UX Definition of Done

UX detailing closes when every P0/P1 workflow has pointer and keyboard
interaction tables, every component/state maps to shared tokens and accessibility
semantics, responsive behavior is explicit, the HSL visual-source dependency is
honestly recorded, and no product action depends solely on hover, color, drag,
precision pointing, or an undiscoverable shortcut.