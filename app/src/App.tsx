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
  ImagePlus,
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
  Save,
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
  useUpdateNodeInternals,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'
import {
  GraphCommandDialog,
  type GraphCommandMode,
} from './components/GraphCommandDialog'
import { IconButton } from './components/IconButton'
import { ImagePreviewCanvas } from './components/ImagePreviewCanvas'
import {
  ProjectBrowserDialog,
  type LocalProjectSummary,
} from './components/ProjectBrowserDialog'
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
import { serializeGraphWorkflow } from './app/graphWorkflowExport'
import {
  importImageAsset,
  renderImageAssetPreview,
  type ImageAssetPreview,
} from './app/imageAssets'
import {
  createLocalProject,
  createLocalProjectCopy,
  deleteLocalProject,
  listLocalProjects,
  renameLocalProject,
  restoreLocalProject,
  trashLocalProject,
  useProjectPersistence,
} from './app/projectPersistence'

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

function NodeInternalsSync({ nodeIdKey }: { nodeIdKey: string }) {
  const updateNodeInternals = useUpdateNodeInternals()

  useEffect(() => {
    function refresh() {
      for (const nodeId of nodeIdKey.split('\0')) {
        if (nodeId) updateNodeInternals(nodeId)
      }
    }
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        refresh()
      })
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [nodeIdKey, updateNodeInternals])

  return null
}

function formatStorage(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function App() {
  const [activeProject, setActiveProject] = useState({
    id: 'untitled-workflow',
    name: 'Untitled workflow',
  })
  const [projectBrowserOpen, setProjectBrowserOpen] = useState(false)
  const [localProjects, setLocalProjects] = useState<LocalProjectSummary[]>([])
  const [theme, setTheme] = useState<ThemePreference>('system')
  const [catalogQuery, setCatalogQuery] = useState('')
  const [inspectorView, setInspectorView] = useState<'inspector' | 'outline'>(
    'inspector',
  )
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
  const [workflowNotice, setWorkflowNotice] = useState<string | null>(null)
  const [previewState, setPreviewState] = useState<
    | { status: 'idle' | 'loading' }
    | { status: 'ready'; result: ImageAssetPreview }
    | { status: 'error'; message: string }
  >({ status: 'idle' })
  const [graphCommand, setGraphCommand] = useState<GraphCommandMode | null>(
    null,
  )
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false)
  const graphDocument = useGraphStore((state) => state.document)
  const graphViewport = useGraphStore((state) => state.viewport)
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds)
  const undoStack = useGraphStore((state) => state.undoStack)
  const redoStack = useGraphStore((state) => state.redoStack)
  const connectionDiagnostic = useGraphStore(
    (state) => state.connectionDiagnostic,
  )
  const addNode = useGraphStore((state) => state.addNode)
  const selectNode = useGraphStore((state) => state.selectNode)
  const clearSelection = useGraphStore((state) => state.clearSelection)
  const deleteSelected = useGraphStore((state) => state.deleteSelected)
  const moveNode = useGraphStore((state) => state.moveNode)
  const setNodeGeometry = useGraphStore((state) => state.setNodeGeometry)
  const updateNodeParameters = useGraphStore(
    (state) => state.updateNodeParameters,
  )
  const moveSelectedBy = useGraphStore((state) => state.moveSelectedBy)
  const duplicateSelected = useGraphStore((state) => state.duplicateSelected)
  const bringSelectedToFront = useGraphStore(
    (state) => state.bringSelectedToFront,
  )
  const toggleSelectedState = useGraphStore(
    (state) => state.toggleSelectedState,
  )
  const connectNodes = useGraphStore((state) => state.connectNodes)
  const replaceDocument = useGraphStore((state) => state.replaceDocument)
  const hydrateDocument = useGraphStore((state) => state.hydrateDocument)
  const setViewport = useGraphStore((state) => state.setViewport)
  const undo = useGraphStore((state) => state.undo)
  const redo = useGraphStore((state) => state.redo)
  const projectPersistence = useProjectPersistence(
    graphDocument,
    graphViewport,
    hydrateDocument,
    activeProject.id,
    activeProject.name,
  )

  const appBarRef = useRef<HTMLElement>(null)
  const libraryRef = useRef<HTMLElement>(null)
  const graphRef = useRef<HTMLElement>(null)
  const inspectorRef = useRef<HTMLElement>(null)
  const statusRef = useRef<HTMLElement>(null)
  const computeStatusRef = useRef<HTMLButtonElement>(null)
  const diagnosticsCloseRef = useRef<HTMLButtonElement>(null)
  const workflowInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const firstNodeMenuItemRef = useRef<HTMLButtonElement>(null)
  const projectSwitcherRef = useRef<HTMLButtonElement>(null)

  const ThemeIcon = THEME_ICONS[theme]
  const nextThemeValue = nextTheme(theme)
  const normalizedCatalogQuery = catalogQuery.trim().toLowerCase()
  const flowNodes: WorkflowFlowNode[] = graphDocument.nodes.map((node) => {
    const definition = NODE_TYPE_REGISTRY[node.type]
    return {
      id: node.id,
      type: 'workflow',
      position: node.position,
      selected: selectedNodeIds.includes(node.id),
      draggable: !node.locked && projectPersistence.access === 'writer',
      ariaLabel: `${node.label} node`,
      data: {
        label: node.label,
        summary: definition.summary,
        inputs: definition.inputs,
        outputs: definition.outputs,
        bypassed: node.bypassed,
        muted: node.muted,
        locked: node.locked,
        onResize: (width: number, height: number) =>
          setNodeGeometry(node.id, {
            ...node.position,
            width,
            height,
          }),
      },
      style: { width: node.size.width, height: node.size.height },
    }
  })
  const selectedNode = graphDocument.nodes.find((node) =>
    selectedNodeIds.includes(node.id),
  )
  const connectionOptions = selectedNode
    ? NODE_TYPE_REGISTRY[selectedNode.type].outputs.flatMap((output) =>
        graphDocument.nodes
          .filter((target) => target.id !== selectedNode.id)
          .flatMap((target) =>
            NODE_TYPE_REGISTRY[target.type].inputs
              .filter((input) => input.accepts.includes(output.dataType))
              .map((input) => ({
                value: JSON.stringify({
                  sourceNodeId: selectedNode.id,
                  sourcePortId: output.id,
                  targetNodeId: target.id,
                  targetPortId: input.id,
                }),
                label: `${output.label} to ${target.label}: ${input.label}`,
              })),
          ),
      )
    : []
  const flowEdges = graphDocument.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    sourceHandle: edge.sourcePortId,
    target: edge.targetNodeId,
    targetHandle: edge.targetPortId,
    type: 'smoothstep',
  }))
  const previewNode = graphDocument.nodes.find(
    (node) => node.type === 'preview',
  )
  const previewInput = previewNode
    ? graphDocument.edges.find(
        (edge) =>
          edge.targetNodeId === previewNode.id && edge.targetPortId === 'image',
      )
    : undefined
  const previewSource = previewInput
    ? graphDocument.nodes.find(
        (node) =>
          node.id === previewInput.sourceNodeId && node.type === 'load-image',
      )
    : undefined

  useEffect(() => {
    const digest = previewSource?.parameters?.assetDigest
    if (
      !previewNode ||
      !previewSource ||
      typeof digest !== 'string' ||
      !digest
    ) {
      return
    }
    const mode = previewSource.parameters?.mode === 'mask' ? 'mask' : 'color'
    const source = previewSource.parameters?.maskSource
    const maskSource =
      source === 'alpha' ||
      source === 'red' ||
      source === 'green' ||
      source === 'blue'
        ? source
        : 'luminosity'
    let active = true
    queueMicrotask(() => {
      if (active) setPreviewState({ status: 'loading' })
    })
    void renderImageAssetPreview(activeProject.id, previewNode.id, digest, {
      mode,
      maskSource,
      invert: previewSource.parameters?.invert === true,
    })
      .then((result) => {
        if (active) setPreviewState({ status: 'ready', result })
      })
      .catch((error: unknown) => {
        if (
          active &&
          !(error instanceof Error && error.message === 'Preview superseded')
        ) {
          setPreviewState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Preview failed',
          })
        }
      })
    return () => {
      active = false
    }
  }, [activeProject.id, previewNode, previewSource])

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
      if (
        event.shiftKey &&
        event.key === 'F10' &&
        selectedNodeIds.length > 0 &&
        projectPersistence.access === 'writer'
      ) {
        event.preventDefault()
        event.stopPropagation()
        setNodeMenuOpen(true)
        return
      }
      if (event.key === 'Home' || event.key === 'End') {
        const orderedNodes = [...graphDocument.nodes].sort(
          (left, right) =>
            left.zIndex - right.zIndex || left.id.localeCompare(right.id),
        )
        const node =
          event.key === 'Home' ? orderedNodes[0] : orderedNodes.at(-1)
        if (node) {
          event.preventDefault()
          event.stopPropagation()
          const nodeIndex = graphDocument.nodes.findIndex(
            (candidate) => candidate.id === node.id,
          )
          const flowNodeElements =
            graphRef.current?.querySelectorAll<HTMLElement>('.react-flow__node')
          flowNodeElements?.[nodeIndex]?.focus()
          selectNode(node.id)
        }
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        clearSelection()
        return
      }
      if (projectPersistence.access !== 'writer') return
      if (event.altKey && event.key.startsWith('Arrow')) {
        event.preventDefault()
        event.stopPropagation()
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
        event.stopPropagation()
        deleteSelected()
        return
      }
      if (event.ctrlKey && !event.shiftKey) {
        const command = event.key.toLowerCase()
        if (command === 'z' || command === 'y') {
          event.preventDefault()
          event.stopPropagation()
          if (command === 'z') undo()
          else redo()
          return
        }
      }
      if (event.ctrlKey && event.shiftKey) {
        const command = event.key.toLowerCase()
        if (command === 'b' || command === 'm' || command === 'l') {
          event.preventDefault()
          event.stopPropagation()
          toggleSelectedState(
            command === 'b' ? 'bypassed' : command === 'm' ? 'muted' : 'locked',
          )
        }
      }
      if (event.shiftKey && !event.ctrlKey) {
        const command = event.key.toLowerCase()
        if (command === 'a') {
          event.preventDefault()
          event.stopPropagation()
          setGraphCommand('add')
        } else if (command === 'c' && selectedNodeIds.length === 1) {
          event.preventDefault()
          event.stopPropagation()
          setGraphCommand('connect')
        } else if (command === 'r' && selectedNodeIds.length === 1) {
          event.preventDefault()
          event.stopPropagation()
          setGraphCommand('geometry')
        }
      }
    }

    document.addEventListener('keydown', handleGraphCommands, true)
    return () =>
      document.removeEventListener('keydown', handleGraphCommands, true)
  }, [
    clearSelection,
    deleteSelected,
    graphDocument.nodes,
    moveSelectedBy,
    projectPersistence.access,
    selectNode,
    selectedNodeIds.length,
    toggleSelectedState,
    undo,
    redo,
    setNodeGeometry,
  ])

  useEffect(() => {
    if (!graphCommand) return
    function closeCommand(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      setGraphCommand(null)
      requestAnimationFrame(() => graphRef.current?.focus())
    }
    document.addEventListener('keydown', closeCommand)
    return () => document.removeEventListener('keydown', closeCommand)
  }, [graphCommand])

  useEffect(() => {
    if (!nodeMenuOpen) return
    firstNodeMenuItemRef.current?.focus()
    function closeMenu(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      setNodeMenuOpen(false)
      requestAnimationFrame(() => graphRef.current?.focus())
    }
    document.addEventListener('keydown', closeMenu)
    return () => document.removeEventListener('keydown', closeMenu)
  }, [nodeMenuOpen])

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

  function downloadWorkflow() {
    const json = serializeGraphWorkflow(graphDocument, {
      id: activeProject.id,
      name: activeProject.name,
      viewport: graphViewport,
    })
    const url = URL.createObjectURL(
      new Blob([json], { type: 'application/vnd.textureflow.workflow+json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'untitled.textureflow.json'
    link.click()
    URL.revokeObjectURL(url)
    setWorkflowNotice('Workflow downloaded')
  }

  async function importWorkflow(file: File) {
    const { parseGraphWorkflow } = await import('./app/graphWorkflowBoundary')
    const result = parseGraphWorkflow(await file.text())
    if (!result.ok) {
      setWorkflowNotice(`Import rejected: ${result.error}`)
      return
    }
    replaceDocument(result.document, result.workflow.project.viewport)
    setWorkflowNotice(
      `Imported ${result.document.nodes.length} nodes and ${result.document.edges.length} edges`,
    )
  }

  async function importImages(files: FileList) {
    let imported = 0
    const failures: string[] = []
    for (const file of Array.from(files)) {
      try {
        const asset = await importImageAsset(activeProject.id, file)
        const nodeCount = graphDocument.nodes.length + imported
        addNode(
          'load-image',
          {
            x: 100 + (nodeCount % 3) * 280,
            y: 100 + Math.floor(nodeCount / 3) * 180,
          },
          undefined,
          {
            assetDigest: asset.digest,
            fileName: asset.fileName,
            mediaType: asset.sniffed.mediaType,
            width: asset.sniffed.width,
            height: asset.sniffed.height,
            profileDecision: 'embedded-profile-or-srgb-fallback',
            orientationDecision: 'decoder-applied-once',
            normalizationVersion: 'import-normalization.v1',
            mode: 'color',
            maskSource: 'luminosity',
            invert: false,
          },
        )
        imported += 1
      } catch (error) {
        failures.push(
          `${file.name}: ${error instanceof Error ? error.message : 'Import failed'}`,
        )
      }
    }
    setSelectedTemplate(
      NODE_CATALOG.find((item) => item.id === 'load-image') ?? null,
    )
    setWorkflowNotice(
      failures.length === 0
        ? `Imported ${imported} image${imported === 1 ? '' : 's'}`
        : `Imported ${imported}; rejected ${failures.length}: ${failures.join('; ')}`,
    )
  }

  async function refreshLocalProjects() {
    setLocalProjects(await listLocalProjects())
  }

  function closeProjectBrowser() {
    setProjectBrowserOpen(false)
    requestAnimationFrame(() => projectSwitcherRef.current?.focus())
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

        <button
          className="project-switcher"
          onClick={() => {
            setProjectBrowserOpen(true)
            void refreshLocalProjects()
          }}
          ref={projectSwitcherRef}
          type="button"
        >
          <span>{activeProject.name}</span>
          <ChevronDown aria-hidden="true" size={14} />
        </button>

        <div className="save-state" role="status">
          <span className="status-dot" aria-hidden="true" />
          {projectPersistence.access === 'read-only'
            ? 'Read-only in another tab'
            : projectPersistence.status === 'loading'
              ? 'Opening local project'
              : projectPersistence.status === 'saving'
                ? 'Saving locally'
                : projectPersistence.status === 'saved'
                  ? 'Saved locally'
                  : projectPersistence.status === 'recovered'
                    ? 'Recovered prior snapshot'
                    : 'Unsaved changes'}
        </div>

        <div
          className="app-actions"
          role="toolbar"
          aria-label="Project commands"
        >
          <IconButton
            disabled={
              undoStack.length === 0 || projectPersistence.access !== 'writer'
            }
            label="Undo"
            onClick={undo}
          >
            <Undo2 aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={
              redoStack.length === 0 || projectPersistence.access !== 'writer'
            }
            label="Redo"
            onClick={redo}
          >
            <Redo2 aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={
              projectPersistence.status === 'loading' ||
              projectPersistence.access !== 'writer'
            }
            label="Save project"
            onClick={() => void projectPersistence.saveNow()}
          >
            <Save aria-hidden="true" size={17} />
          </IconButton>
          <span className="toolbar-separator" aria-hidden="true" />
          <IconButton
            disabled={projectPersistence.access !== 'writer'}
            label="Import images"
            onClick={() => imageInputRef.current?.click()}
          >
            <ImagePlus aria-hidden="true" size={17} />
          </IconButton>
          <input
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            aria-label="Image files"
            className="sr-only"
            multiple
            onChange={(event) => {
              const files = event.target.files
              if (files) void importImages(files)
              event.target.value = ''
            }}
            ref={imageInputRef}
            tabIndex={-1}
            type="file"
          />
          <IconButton
            disabled={projectPersistence.access !== 'writer'}
            label="Import workflow"
            onClick={() => workflowInputRef.current?.click()}
          >
            <Upload aria-hidden="true" size={17} />
          </IconButton>
          <input
            accept=".json,.textureflow.json,application/json,application/vnd.textureflow.workflow+json"
            aria-label="Workflow file"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importWorkflow(file)
              event.target.value = ''
            }}
            ref={workflowInputRef}
            tabIndex={-1}
            type="file"
          />
          <IconButton
            disabled={graphDocument.nodes.length === 0}
            label="Export workflow"
            onClick={downloadWorkflow}
          >
            <Download aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={
              selectedNodeIds.length === 0 ||
              projectPersistence.access !== 'writer'
            }
            label="Delete selected nodes"
            onClick={deleteSelected}
          >
            <Trash2 aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={
              selectedNodeIds.length === 0 ||
              projectPersistence.access !== 'writer'
            }
            label="Duplicate selected nodes"
            onClick={() => duplicateSelected()}
          >
            <Copy aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={
              selectedNodeIds.length === 0 ||
              projectPersistence.access !== 'writer'
            }
            label="Toggle bypass for selected nodes"
            onClick={() => toggleSelectedState('bypassed')}
          >
            <CircleSlash2 aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={
              selectedNodeIds.length === 0 ||
              projectPersistence.access !== 'writer'
            }
            label="Toggle mute for selected nodes"
            onClick={() => toggleSelectedState('muted')}
          >
            <VolumeX aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={
              selectedNodeIds.length === 0 ||
              projectPersistence.access !== 'writer'
            }
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
            <input
              onChange={(event) => setCatalogQuery(event.target.value)}
              placeholder="Search nodes"
              type="search"
              value={catalogQuery}
            />
          </label>

          <nav aria-label="Available nodes" className="catalog">
            {(Object.keys(CATEGORY_LABELS) as NodeCategory[]).map(
              (category) => {
                const CategoryIcon = CATEGORY_ICONS[category]
                const items = NODE_CATALOG.filter(
                  (item) =>
                    item.category === category &&
                    (normalizedCatalogQuery.length === 0 ||
                      `${item.label} ${item.summary}`
                        .toLowerCase()
                        .includes(normalizedCatalogQuery)),
                )

                if (items.length === 0) return null

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
            {normalizedCatalogQuery.length > 0 &&
            !NODE_CATALOG.some((item) =>
              `${item.label} ${item.summary}`
                .toLowerCase()
                .includes(normalizedCatalogQuery),
            ) ? (
              <p className="catalog-empty" role="status">
                No matching nodes
              </p>
            ) : null}
          </nav>
        </aside>

        <main
          aria-label="Graph canvas"
          className="graph-region"
          ref={graphRef}
          tabIndex={-1}
        >
          {projectPersistence.status === 'loading' ? (
            <div className="graph-loading" role="status">
              Opening local project
            </div>
          ) : (
            <ReactFlow
              colorMode={theme}
              defaultViewport={graphViewport}
              edges={flowEdges}
              fitView={flowNodes.length === 0}
              fitViewOptions={{ maxZoom: 1 }}
              key={`${activeProject.id}:${flowNodes[0]?.id ?? 'empty-graph'}`}
              maxZoom={2.5}
              minZoom={0.2}
              nodeTypes={NODE_TYPES}
              nodes={flowNodes}
              onConnect={(connection) => {
                if (projectPersistence.access !== 'writer') return
                if (
                  !connection.source ||
                  !connection.target ||
                  !connection.sourceHandle ||
                  !connection.targetHandle
                ) {
                  return
                }
                connectNodes({
                  sourceNodeId: connection.source,
                  sourcePortId: connection.sourceHandle,
                  targetNodeId: connection.target,
                  targetPortId: connection.targetHandle,
                })
              }}
              onNodeClick={(event, node) => selectNode(node.id, event.shiftKey)}
              onNodeDragStop={(_, node) => {
                if (projectPersistence.access === 'writer') {
                  moveNode(node.id, node.position)
                }
              }}
              onMoveEnd={(_, viewport) => setViewport(viewport)}
              onPaneClick={clearSelection}
            >
              <NodeInternalsSync
                nodeIdKey={graphDocument.nodes
                  .map((node) => node.id)
                  .join('\0')}
              />
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
          )}
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
            <button
              aria-selected={inspectorView === 'inspector'}
              onClick={() => setInspectorView('inspector')}
              role="tab"
              type="button"
            >
              Inspector
            </button>
            <button
              aria-selected={inspectorView === 'outline'}
              onClick={() => setInspectorView('outline')}
              role="tab"
              type="button"
            >
              Outline
            </button>
          </div>

          {inspectorView === 'outline' ? (
            <div className="graph-outline">
              <p className="eyebrow">Graph order</p>
              <h2>Nodes</h2>
              {graphDocument.nodes.length === 0 ? (
                <p className="outline-empty">No authored nodes</p>
              ) : (
                <ol>
                  {[...graphDocument.nodes]
                    .sort(
                      (left, right) =>
                        left.zIndex - right.zIndex ||
                        left.id.localeCompare(right.id),
                    )
                    .map((node) => (
                      <li key={node.id}>
                        <button
                          aria-pressed={selectedNodeIds.includes(node.id)}
                          onClick={() => {
                            selectNode(node.id)
                            setSelectedTemplate(
                              NODE_CATALOG.find(
                                (item) => item.id === node.type,
                              ) ?? null,
                            )
                          }}
                          type="button"
                        >
                          <span>{node.label}</span>
                          <small>
                            {node.locked
                              ? 'Locked'
                              : node.muted
                                ? 'Muted'
                                : node.bypassed
                                  ? 'Bypassed'
                                  : 'Ready'}
                          </small>
                        </button>
                      </li>
                    ))}
                </ol>
              )}
            </div>
          ) : selectedTemplate ? (
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

              {selectedNode?.type === 'load-image' ? (
                <section className="inspector-section image-settings">
                  <h3>Image</h3>
                  <p className="source-file-name">
                    {typeof selectedNode.parameters?.fileName === 'string'
                      ? selectedNode.parameters.fileName
                      : 'No source selected'}
                  </p>
                  <label>
                    Output mode
                    <select
                      onChange={(event) =>
                        updateNodeParameters(selectedNode.id, {
                          mode: event.target.value,
                        })
                      }
                      value={
                        selectedNode.parameters?.mode === 'mask'
                          ? 'mask'
                          : 'color'
                      }
                    >
                      <option value="color">Color image</option>
                      <option value="mask">Mask</option>
                    </select>
                  </label>
                  {selectedNode.parameters?.mode === 'mask' ? (
                    <>
                      <label>
                        Mask source
                        <select
                          onChange={(event) =>
                            updateNodeParameters(selectedNode.id, {
                              maskSource: event.target.value,
                            })
                          }
                          value={String(
                            selectedNode.parameters?.maskSource ?? 'luminosity',
                          )}
                        >
                          <option value="luminosity">Luminosity</option>
                          <option value="alpha">Alpha</option>
                          <option value="red">Red</option>
                          <option value="green">Green</option>
                          <option value="blue">Blue</option>
                        </select>
                      </label>
                      <label className="checkbox-setting">
                        <input
                          checked={selectedNode.parameters?.invert === true}
                          onChange={(event) =>
                            updateNodeParameters(selectedNode.id, {
                              invert: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                        Invert mask
                      </label>
                    </>
                  ) : null}
                </section>
              ) : null}

              <button
                className="primary-command"
                disabled={projectPersistence.access !== 'writer'}
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
              {previewNode ? (
                <section className="inspector-section preview-surface">
                  <h3>Preview</h3>
                  {!previewSource ? (
                    <p>Connect a Load image node.</p>
                  ) : previewState.status === 'loading' ? (
                    <p role="status">Rendering preview</p>
                  ) : previewState.status === 'error' ? (
                    <p role="alert">{previewState.message}</p>
                  ) : previewState.status === 'ready' ? (
                    <>
                      <ImagePreviewCanvas result={previewState.result} />
                      <p>
                        {previewState.result.sourceWidth} ×{' '}
                        {previewState.result.sourceHeight} source
                      </p>
                    </>
                  ) : null}
                </section>
              ) : null}
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
          {projectPersistence.access === 'read-only' ? (
            <>
              <button
                className="status-item status-action"
                onClick={() => {
                  void createLocalProjectCopy(
                    `${activeProject.name} copy`,
                    graphDocument,
                  ).then((project) => {
                    setActiveProject({ id: project.id, name: project.name })
                    setSelectedTemplate(null)
                    setWorkflowNotice('Opened an independent project copy')
                  })
                }}
                type="button"
              >
                Read-only · Open copy
              </button>
              <button
                className="status-item status-action connection-warning"
                onClick={() => void projectPersistence.takeOver()}
                type="button"
              >
                Read-only · Take over
              </button>
            </>
          ) : null}
          {workflowNotice ? (
            <span className="status-item" role="status">
              {workflowNotice}
            </span>
          ) : null}
          {connectionDiagnostic ? (
            <span className="status-item connection-warning" role="status">
              Connection rejected: {connectionDiagnostic.replaceAll('-', ' ')}
            </span>
          ) : null}
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
            {Math.round(graphViewport.zoom * 100)}%
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
                  <span>
                    Atomic · rollback · lease · broadcast ·{' '}
                    {projectPersistence.durability === 'persistent'
                      ? 'persistent'
                      : 'best effort'}
                  </span>
                  {projectPersistence.usageBytes !== null &&
                  projectPersistence.quotaBytes !== null ? (
                    <span>
                      {formatStorage(projectPersistence.usageBytes)} of{' '}
                      {formatStorage(projectPersistence.quotaBytes)} used
                    </span>
                  ) : null}
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
      {graphCommand ? (
        <GraphCommandDialog
          addOptions={NODE_CATALOG.map((item) => ({
            value: item.id,
            label: item.label,
          }))}
          connectionOptions={connectionOptions}
          geometry={
            selectedNode
              ? { ...selectedNode.position, ...selectedNode.size }
              : null
          }
          mode={graphCommand}
          onAdd={(type) => {
            const nodeCount = graphDocument.nodes.length
            addNode(type, {
              x: 100 + (nodeCount % 3) * 280,
              y: 100 + Math.floor(nodeCount / 3) * 180,
            })
          }}
          onClose={() => {
            setGraphCommand(null)
            requestAnimationFrame(() => graphRef.current?.focus())
          }}
          onConnect={(value) => {
            if (!value) return false
            const edge = JSON.parse(value) as {
              sourceNodeId: string
              sourcePortId: string
              targetNodeId: string
              targetPortId: string
            }
            return connectNodes(edge) === null
          }}
          onGeometry={(geometry) =>
            selectedNode ? setNodeGeometry(selectedNode.id, geometry) : false
          }
        />
      ) : null}
      {nodeMenuOpen ? (
        <div
          aria-label="Node commands"
          className="node-command-menu"
          role="menu"
        >
          <button
            onClick={() => {
              duplicateSelected()
              setNodeMenuOpen(false)
            }}
            ref={firstNodeMenuItemRef}
            role="menuitem"
            type="button"
          >
            Duplicate
          </button>
          <button
            onClick={() => {
              bringSelectedToFront()
              setNodeMenuOpen(false)
            }}
            role="menuitem"
            type="button"
          >
            Bring to front
          </button>
          {(['bypassed', 'muted', 'locked'] as const).map((state) => (
            <button
              key={state}
              onClick={() => {
                toggleSelectedState(state)
                setNodeMenuOpen(false)
              }}
              role="menuitem"
              type="button"
            >
              Toggle {state === 'bypassed' ? 'bypass' : state.slice(0, -1)}
            </button>
          ))}
          <button
            onClick={() => {
              deleteSelected()
              setNodeMenuOpen(false)
            }}
            role="menuitem"
            type="button"
          >
            Delete
          </button>
        </div>
      ) : null}
      {projectBrowserOpen ? (
        <ProjectBrowserDialog
          activeProjectId={activeProject.id}
          onClose={closeProjectBrowser}
          onCreate={async (name) => {
            await createLocalProject(name)
            await refreshLocalProjects()
          }}
          onDelete={async (projectId) => {
            await deleteLocalProject(projectId)
            await refreshLocalProjects()
          }}
          onOpen={(project) => {
            setActiveProject({ id: project.id, name: project.name })
            setSelectedTemplate(null)
            closeProjectBrowser()
          }}
          onRename={async (projectId, name) => {
            await renameLocalProject(projectId, name)
            if (projectId === activeProject.id) {
              setActiveProject((current) => ({ ...current, name: name.trim() }))
            }
            await refreshLocalProjects()
          }}
          onRestore={async (projectId) => {
            await restoreLocalProject(projectId)
            await refreshLocalProjects()
          }}
          onTrash={async (projectId) => {
            await trashLocalProject(projectId)
            await refreshLocalProjects()
          }}
          projects={localProjects}
        />
      ) : null}
    </div>
  )
}

export default App
