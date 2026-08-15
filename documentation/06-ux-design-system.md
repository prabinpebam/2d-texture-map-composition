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
| Inspector | right, 300 px resizable | selected node parameters and validation |
| Preview | right/bottom tabbed with inspector | selected/final preview and pixel data |
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

The inspector is the complete editing surface. Nodes show high-value controls
only, preserving graph scanability. Double-clicking a node focuses its first
inspector control; `Escape` returns focus to the node.

## 4. Graph Interaction Model

### Pointer and touchpad

- Primary drag on empty canvas pans when Space is held; middle-button drag always
  pans. Configurable “pan on drag” may invert this for user preference.
- Wheel/trackpad scroll pans; `Ctrl+wheel` zooms around pointer. Browser zoom
  remains available from browser UI and keyboard where the browser reserves it.
- Drag from output port to compatible input creates an edge on pointer-up.
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
| `Shift+R` | Open numeric Resize Node dialog |
| `Home` / `End` | Focus first/last node in topological then ID order |
| `Escape` | Cancel gesture/dialog, then clear selection |
| `Shift+F10` | Open context menu |

The Connect dialog selects output port, compatible target node, and input port
using ordinary list/combobox controls. It is the non-drag equivalent required by
WCAG. Numeric Position/Size commands provide non-drag movement and resizing.

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
| optional thumbnail / summary     |
| input labels              outputs|
| compact high-value controls      |
| status / warning / progress      |
+----------------------------------+
```

### Stable dimensions

- Default node width: 240 px; minimum 180 px; maximum 560 px.
- Header: 32 px minimum; port row: 28 px minimum.
- Resize handles have at least a 24 px hit target, even if the visible glyph is
  smaller. Resizing cannot hide required controls or truncate a port label.
- At distant zoom, internal controls collapse to title/type/state while ports and
  selection remain legible. Layout does not reflow during hover or progress.

### State presentation

| State | Required visual and semantic treatment |
| --- | --- |
| Focus | high-contrast continuous outline distinct from selection |
| Selected | accent border/background marker; `aria-selected=true` |
| Locked | lock icon and text in status; controls disabled, unlock remains available |
| Bypassed | diagonal route marker, “Bypassed” text, dimmed processing body |
| Muted | output-port stop marker, “Muted” text, downstream invalidity if required |
| Computing | determinate progress when measurable, otherwise restrained indicator |
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

## 6. Inspector Contract

Inspector groups controls by Input, Processing, Appearance, Output, and Advanced.
Groups are unframed sections, not cards. High-frequency controls start expanded;
Advanced starts collapsed but retains state per node type.

Every control has visible label, unit, current value, valid range, reset, and
inline validation. Slider plus numeric field is one logical setting. Slider arrow
keys use fine step, Page Up/Down use coarse step, Home/End use bounds. Input
commits on valid change; invalid text remains local until corrected or canceled.

Changes show draft preview continuously when affordable, but undo history gets
one command per completed gesture/edit session. `Escape` during a slider drag or
uncommitted text edit restores the before value.

### Node-specific inspector controls

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

- Preview is never nested in a decorative card. It fills its region against a
  checkerboard or user-selected background.
- Toolbar contains Fit, 100%, zoom, pan, background, mask view, compare, and
  export commands as icons with tooltips.
- Metadata strip shows logical dimensions, preview scale, interpretation, color
  space, generation state, and pixel value under cursor.
- Before/after comparison supports split slider and side-by-side. A segmented
  control selects mode; keyboard fields set split percentage without dragging.
- Fullscreen preview returns to the same node and focus on close.
- Error, empty, stale, and OOM states occupy stable dimensions and never resize
  surrounding controls.

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
| Status | inline message, progress, badge, status bar item, live announcer, toast |
| Overlays | tooltip, popover, menu, dialog, drawer |
| Data/media | image preview, mask preview, checkerboard, swatch, comparison, pixel readout |
| Project | project item, import report, asset relinker, recovery item, storage meter |

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

## 13. UX Definition of Done

UX detailing closes when every P0/P1 workflow has pointer and keyboard
interaction tables, every component/state maps to shared tokens and accessibility
semantics, responsive behavior is explicit, the HSL visual-source dependency is
honestly recorded, and no product action depends solely on hover, color, drag,
precision pointing, or an undiscoverable shortcut.