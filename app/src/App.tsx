import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  Blend,
  BoxSelect,
  ChevronDown,
  CircleGauge,
  CircleSlash2,
  Copy,
  Download,
  Eye,
  HardDrive,
  Image,
  Layers3,
  LockKeyhole,
  Map,
  Maximize2,
  Moon,
  Palette,
  PanelRight,
  Plus,
  Redo2,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  SunMedium,
  Trash2,
  Undo2,
  Upload,
  VolumeX,
  X,
} from 'lucide-react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'
import { IconButton } from './components/IconButton'
import { WorkflowNode, type WorkflowFlowNode } from './components/WorkflowNode'
import { detectEnvironment } from './app/environment'
import {
  NODE_CATALOG,
  nextTheme,
  type NodeCatalogItem,
  type NodeCategory,
  type ThemePreference,
} from './domain/workspace'
import {
  probeComputeBackend,
  type ComputeProbeResult,
} from './app/computeReadiness'
import {
  runPersistenceProbe,
  type PersistenceProbeResult,
} from './app/storageReadiness'
import { useGraphStore } from './app/graphState'
import { NODE_TYPE_REGISTRY } from './domain/graph'

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  input: 'Inputs',
  compose: 'Compose',
  adjust: 'Adjust',
  analyze: 'Analyze',
  output: 'Output',
}

const CATEGORY_ICONS = {
  input: Image,
  compose: Blend,
  adjust: SlidersHorizontal,
  analyze: CircleGauge,
  output: Eye,
} satisfies Record<NodeCategory, typeof Image>

const THEME_ICONS = {
  system: SunMedium,
  light: Sun,
  dark: Moon,
} satisfies Record<ThemePreference, typeof Sun>

const NODE_TYPES = { workflow: WorkflowNode }

function App() {
  const [theme, setTheme] = useState<ThemePreference>('system')
  const [selectedTemplate, setSelectedTemplate] =
    useState<NodeCatalogItem | null>(null)
  const [capabilities] = useState(detectEnvironment)
  const [computeProbe, setComputeProbe] = useState<
    ComputeProbeResult | 'checking' | 'unavailable'
  >(() => (capabilities.workers ? 'checking' : 'unavailable'))
  const [persistenceProbe, setPersistenceProbe] = useState<
    PersistenceProbeResult | { error: string } | 'checking' | 'unavailable'
  >(() => (capabilities.indexedDb ? 'checking' : 'unavailable'))
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const graphDocument = useGraphStore((state) => state.document)
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds)
  const undoStack = useGraphStore((state) => state.undoStack)
  const redoStack = useGraphStore((state) => state.redoStack)
  const addNode = useGraphStore((state) => state.addNode)
  const selectNode = useGraphStore((state) => state.selectNode)
  const clearSelection = useGraphStore((state) => state.clearSelection)
  const deleteSelected = useGraphStore((state) => state.deleteSelected)
  const moveNode = useGraphStore((state) => state.moveNode)
  const moveSelectedBy = useGraphStore((state) => state.moveSelectedBy)
  const duplicateSelected = useGraphStore((state) => state.duplicateSelected)
  const toggleSelectedState = useGraphStore(
    (state) => state.toggleSelectedState,
  )
  const undo = useGraphStore((state) => state.undo)
  const redo = useGraphStore((state) => state.redo)

  const appBarRef = useRef<HTMLElement>(null)
  const libraryRef = useRef<HTMLElement>(null)
  const graphRef = useRef<HTMLElement>(null)
  const inspectorRef = useRef<HTMLElement>(null)
  const statusRef = useRef<HTMLElement>(null)
  const computeStatusRef = useRef<HTMLButtonElement>(null)
  const diagnosticsCloseRef = useRef<HTMLButtonElement>(null)

  const ThemeIcon = THEME_ICONS[theme]
  const nextThemeValue = nextTheme(theme)
  const flowNodes: WorkflowFlowNode[] = graphDocument.nodes.map((node) => {
    const definition = NODE_TYPE_REGISTRY[node.type]
    return {
      id: node.id,
      type: 'workflow',
      position: node.position,
      selected: selectedNodeIds.includes(node.id),
      draggable: !node.locked,
      ariaLabel: `${node.label} node`,
      data: {
        label: node.label,
        summary: definition.summary,
        inputs: definition.inputs,
        outputs: definition.outputs,
        bypassed: node.bypassed,
        muted: node.muted,
        locked: node.locked,
      },
      style: { width: node.size.width, minHeight: node.size.height },
    }
  })
  const selectedNode = graphDocument.nodes.find((node) =>
    selectedNodeIds.includes(node.id),
  )

  useEffect(() => {
    function handleRegionNavigation(event: globalThis.KeyboardEvent) {
      if (event.key !== 'F6') return

      event.preventDefault()
      const regions = [
        appBarRef.current,
        libraryRef.current,
        graphRef.current,
        inspectorRef.current,
        statusRef.current,
      ].filter((region): region is HTMLElement => region !== null)
      const activeIndex = regions.findIndex((region) =>
        region.contains(document.activeElement),
      )
      const direction = event.shiftKey ? -1 : 1
      const nextIndex =
        (activeIndex + direction + regions.length) % regions.length
      regions[nextIndex].focus()
    }

    document.addEventListener('keydown', handleRegionNavigation)
    return () => document.removeEventListener('keydown', handleRegionNavigation)
  }, [])

  useEffect(() => {
    function handleGraphCommands(event: globalThis.KeyboardEvent) {
      if (!graphRef.current?.contains(document.activeElement)) return
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return
      }

      const step = event.shiftKey ? 10 : 1
      if (event.altKey && event.key.startsWith('Arrow')) {
        event.preventDefault()
        const delta = {
          x:
            event.key === 'ArrowLeft'
              ? -step
              : event.key === 'ArrowRight'
                ? step
                : 0,
          y:
            event.key === 'ArrowUp'
              ? -step
              : event.key === 'ArrowDown'
                ? step
                : 0,
        }
        moveSelectedBy(delta)
        return
      }
      if (event.key === 'Delete') {
        event.preventDefault()
        deleteSelected()
        return
      }
      if (event.ctrlKey && event.shiftKey) {
        const command = event.key.toLowerCase()
        if (command === 'b' || command === 'm' || command === 'l') {
          event.preventDefault()
          toggleSelectedState(
            command === 'b' ? 'bypassed' : command === 'm' ? 'muted' : 'locked',
          )
        }
      }
    }

    document.addEventListener('keydown', handleGraphCommands)
    return () => document.removeEventListener('keydown', handleGraphCommands)
  }, [deleteSelected, moveSelectedBy, toggleSelectedState])

  useEffect(() => {
    if (!capabilities.workers) return

    let active = true
    void probeComputeBackend()
      .then((result) => {
        if (active) setComputeProbe(result)
      })
      .catch(() => {
        if (active) setComputeProbe('unavailable')
      })
    return () => {
      active = false
    }
  }, [capabilities.workers])

  useEffect(() => {
    if (!capabilities.indexedDb) return

    let active = true
    void runPersistenceProbe()
      .then((result) => {
        if (active) setPersistenceProbe(result)
      })
      .catch((error: unknown) => {
        if (active) {
          setPersistenceProbe({
            error:
              error instanceof Error
                ? `${error.name}: ${error.message}`
                : 'Unknown persistence probe failure',
          })
        }
      })
    return () => {
      active = false
    }
  }, [capabilities.indexedDb])

  useEffect(() => {
    if (!diagnosticsOpen) return
    diagnosticsCloseRef.current?.focus()

    function handleDialogKeyboard(event: globalThis.KeyboardEvent) {
      if (event.key === 'Tab') {
        event.preventDefault()
        diagnosticsCloseRef.current?.focus()
        return
      }
      if (event.key === 'Escape') {
        setDiagnosticsOpen(false)
        requestAnimationFrame(() => computeStatusRef.current?.focus())
      }
    }
    document.addEventListener('keydown', handleDialogKeyboard)
    return () => document.removeEventListener('keydown', handleDialogKeyboard)
  }, [diagnosticsOpen])

  function closeDiagnostics() {
    setDiagnosticsOpen(false)
    requestAnimationFrame(() => computeStatusRef.current?.focus())
  }

  return (
    <div className="workspace" data-theme={theme}>
      <header className="app-bar" ref={appBarRef} tabIndex={-1}>
        <div className="brand-lockup" aria-label="TextureFlow">
          <span className="brand-mark" aria-hidden="true">
            <Layers3 size={18} strokeWidth={2.2} />
          </span>
          <span className="brand-name">TextureFlow</span>
        </div>

        <button className="project-switcher" type="button">
          <span>Untitled workflow</span>
          <ChevronDown aria-hidden="true" size={14} />
        </button>

        <div className="save-state" role="status">
          <span className="status-dot" aria-hidden="true" />
          Local draft
        </div>

        <div
          className="app-actions"
          role="toolbar"
          aria-label="Project commands"
        >
          <IconButton
            disabled={undoStack.length === 0}
            label="Undo"
            onClick={undo}
          >
            <Undo2 aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={redoStack.length === 0}
            label="Redo"
            onClick={redo}
          >
            <Redo2 aria-hidden="true" size={17} />
          </IconButton>
          <span className="toolbar-separator" aria-hidden="true" />
          <IconButton disabled label="Import images">
            <Upload aria-hidden="true" size={17} />
          </IconButton>
          <IconButton disabled label="Export workflow">
            <Download aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={selectedNodeIds.length === 0}
            label="Delete selected nodes"
            onClick={deleteSelected}
          >
            <Trash2 aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={selectedNodeIds.length === 0}
            label="Duplicate selected nodes"
            onClick={() => duplicateSelected()}
          >
            <Copy aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={selectedNodeIds.length === 0}
            label="Toggle bypass for selected nodes"
            onClick={() => toggleSelectedState('bypassed')}
          >
            <CircleSlash2 aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={selectedNodeIds.length === 0}
            label="Toggle mute for selected nodes"
            onClick={() => toggleSelectedState('muted')}
          >
            <VolumeX aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={selectedNodeIds.length === 0}
            label="Toggle lock for selected nodes"
            onClick={() => toggleSelectedState('locked')}
          >
            <LockKeyhole aria-hidden="true" size={17} />
          </IconButton>
          <span className="toolbar-separator" aria-hidden="true" />
          <IconButton
            label={`Theme: ${theme}. Switch to ${nextThemeValue}`}
            onClick={() => setTheme(nextThemeValue)}
          >
            <ThemeIcon aria-hidden="true" size={17} />
          </IconButton>
          <IconButton disabled label="Settings">
            <Settings aria-hidden="true" size={17} />
          </IconButton>
        </div>
      </header>

      <div className="workspace-body">
        <aside
          aria-label="Node library"
          className="node-library"
          ref={libraryRef}
          tabIndex={-1}
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Library</p>
              <h1>Nodes</h1>
            </div>
            <IconButton disabled label="Collapse node library">
              <PanelRight aria-hidden="true" size={16} />
            </IconButton>
          </div>

          <label className="search-field">
            <Search aria-hidden="true" size={15} />
            <span className="sr-only">Search nodes</span>
            <input placeholder="Search nodes" type="search" />
          </label>

          <nav aria-label="Available nodes" className="catalog">
            {(Object.keys(CATEGORY_LABELS) as NodeCategory[]).map(
              (category) => {
                const CategoryIcon = CATEGORY_ICONS[category]
                const items = NODE_CATALOG.filter(
                  (item) => item.category === category,
                )

                return (
                  <section className="catalog-section" key={category}>
                    <h2>
                      <CategoryIcon aria-hidden="true" size={14} />
                      {CATEGORY_LABELS[category]}
                    </h2>
                    <div className="catalog-items">
                      {items.map((item) => (
                        <button
                          aria-pressed={selectedTemplate?.id === item.id}
                          className="catalog-item"
                          key={item.id}
                          onClick={() => setSelectedTemplate(item)}
                          type="button"
                        >
                          <span>{item.label}</span>
                          <span aria-hidden="true" className="port-preview" />
                        </button>
                      ))}
                    </div>
                  </section>
                )
              },
            )}
          </nav>
        </aside>

        <main
          aria-label="Graph canvas"
          className="graph-region"
          ref={graphRef}
          tabIndex={-1}
        >
          <ReactFlow
            colorMode={theme}
            edges={[]}
            fitView
            fitViewOptions={{ maxZoom: 1 }}
            maxZoom={2.5}
            minZoom={0.2}
            nodeTypes={NODE_TYPES}
            nodes={flowNodes}
            onNodeClick={(event, node) => selectNode(node.id, event.shiftKey)}
            onNodeDragStop={(_, node) => moveNode(node.id, node.position)}
            onPaneClick={clearSelection}
          >
            <Background
              color="var(--graph-dot)"
              gap={20}
              size={1.2}
              variant={BackgroundVariant.Dots}
            />
            <Controls position="bottom-left" showInteractive={false} />
            <MiniMap
              ariaLabel="Workflow minimap"
              maskColor="var(--minimap-mask)"
              pannable
              position="bottom-right"
              zoomable
            />
            <Panel className="graph-context" position="top-left">
              <span>Canvas</span>
              <span aria-hidden="true">/</span>
              <strong>Untitled workflow</strong>
            </Panel>
            {graphDocument.nodes.length === 0 ? (
              <Panel className="empty-workflow" position="top-center">
                <span className="empty-icon" aria-hidden="true">
                  <BoxSelect size={21} />
                </span>
                <div>
                  <strong>No nodes</strong>
                  <span>Select a node template from the library.</span>
                </div>
              </Panel>
            ) : null}
          </ReactFlow>
        </main>

        <aside
          aria-label="Inspector"
          className="inspector"
          ref={inspectorRef}
          tabIndex={-1}
        >
          <div
            className="inspector-tabs"
            role="tablist"
            aria-label="Inspector views"
          >
            <button aria-selected="true" role="tab" type="button">
              Inspector
            </button>
            <button aria-selected="false" disabled role="tab" type="button">
              Preview
            </button>
          </div>

          {selectedTemplate ? (
            <div className="inspector-content">
              <div className="template-heading">
                <span className={`template-icon ${selectedTemplate.category}`}>
                  {(() => {
                    const SelectedIcon =
                      CATEGORY_ICONS[selectedTemplate.category]
                    return <SelectedIcon aria-hidden="true" size={18} />
                  })()}
                </span>
                <div>
                  <p className="eyebrow">Node template</p>
                  <h2>{selectedTemplate.label}</h2>
                </div>
              </div>
              <p className="template-summary">{selectedTemplate.summary}</p>

              <button
                className="primary-command"
                onClick={() => {
                  const nodeCount = graphDocument.nodes.length
                  addNode(selectedTemplate.id, {
                    x: 100 + (nodeCount % 3) * 280,
                    y: 100 + Math.floor(nodeCount / 3) * 180,
                  })
                }}
                type="button"
              >
                <Plus aria-hidden="true" size={15} />
                Add to canvas
              </button>

              <section className="inspector-section">
                <h3>State</h3>
                <div className="state-row">
                  <LockKeyhole aria-hidden="true" size={15} />
                  <span>
                    {selectedNode?.type === selectedTemplate.id
                      ? 'Selected on canvas'
                      : 'Ready to add'}
                  </span>
                </div>
              </section>
            </div>
          ) : (
            <div className="inspector-empty">
              <Palette aria-hidden="true" size={22} />
              <strong>Nothing selected</strong>
              <span>Node settings appear here.</span>
            </div>
          )}
        </aside>
      </div>

      <footer
        aria-label="Workspace status"
        className="status-bar"
        ref={statusRef}
        tabIndex={-1}
      >
        <div className="status-group">
          <span className="status-item good">
            <Activity aria-hidden="true" size={13} />
            Graph valid
          </span>
          <span
            className="status-item"
            data-persistence-probe={
              typeof persistenceProbe === 'object' &&
              !('error' in persistenceProbe)
                ? JSON.stringify(persistenceProbe)
                : undefined
            }
            data-persistence-error={
              typeof persistenceProbe === 'object' &&
              'error' in persistenceProbe
                ? persistenceProbe.error
                : undefined
            }
          >
            <HardDrive aria-hidden="true" size={13} />
            {persistenceProbe === 'checking'
              ? 'Checking storage'
              : persistenceProbe === 'unavailable'
                ? 'Storage unavailable'
                : 'error' in persistenceProbe
                  ? 'Storage unavailable'
                  : Object.entries(persistenceProbe)
                        .filter(([key]) => key !== 'leaseWinner')
                        .every(([, value]) => value === true)
                    ? 'Storage verified'
                    : 'Storage degraded'}
          </span>
        </div>
        <div className="status-group">
          <span className="status-item">
            <Map aria-hidden="true" size={13} />
            {graphDocument.nodes.length} nodes
          </span>
          <button
            aria-expanded={diagnosticsOpen}
            aria-haspopup="dialog"
            className="status-item status-action"
            data-compute-sample={
              typeof computeProbe === 'object'
                ? computeProbe.sample.join(',')
                : undefined
            }
            onClick={() => setDiagnosticsOpen(true)}
            ref={computeStatusRef}
            type="button"
          >
            <CircleGauge aria-hidden="true" size={13} />
            {computeProbe === 'checking'
              ? 'Checking compute'
              : computeProbe === 'unavailable'
                ? 'Compute unavailable'
                : computeProbe.backend === 'wasm'
                  ? 'WASM compute'
                  : 'CPU reference'}
          </button>
          <span className="status-item zoom-readout">
            <Maximize2 aria-hidden="true" size={13} />
            100%
          </span>
        </div>
      </footer>

      {diagnosticsOpen ? (
        <div className="dialog-scrim">
          <section
            aria-labelledby="runtime-diagnostics-title"
            aria-modal="true"
            className="runtime-dialog"
            role="dialog"
          >
            <div className="runtime-dialog-header">
              <div>
                <p className="eyebrow">Runtime</p>
                <h2 id="runtime-diagnostics-title">Diagnostics</h2>
              </div>
              <IconButton
                label="Close runtime diagnostics"
                onClick={closeDiagnostics}
                ref={diagnosticsCloseRef}
              >
                <X aria-hidden="true" size={17} />
              </IconButton>
            </div>
            <dl className="diagnostic-list">
              <div>
                <dt>Compute backend</dt>
                <dd>
                  <strong>
                    {typeof computeProbe === 'object'
                      ? computeProbe.backend === 'wasm'
                        ? 'WASM verified'
                        : 'CPU reference'
                      : 'Unavailable'}
                  </strong>
                  <span>
                    {typeof computeProbe === 'object'
                      ? `Sample ${computeProbe.sample.join(' · ')}`
                      : 'No conformant sample'}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Local storage</dt>
                <dd>
                  <strong>
                    {typeof persistenceProbe === 'object' &&
                    !('error' in persistenceProbe)
                      ? 'Recovery verified'
                      : 'Unavailable'}
                  </strong>
                  <span>Atomic · rollback · lease · broadcast</span>
                </dd>
              </div>
              <div>
                <dt>Fallback</dt>
                <dd>
                  <strong>Ready</strong>
                  <span>CPU reference · prior snapshot</span>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default App
