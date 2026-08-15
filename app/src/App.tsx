import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
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
  ListOrdered,
  LockKeyhole,
  Map,
  Maximize2,
  Moon,
  Palette,
  PanelRight,
  Play,
  Plus,
  Redo2,
  Search,
  Save,
  Settings,
  SlidersHorizontal,
  Square,
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
import { NodeWidgetFields } from './components/NodeWidgetFields'
import { NodeSearchDialog } from './components/NodeSearchDialog'
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
import { getDefaultNodeSize, NODE_TYPE_REGISTRY } from './domain/graph'
import { serializeGraphWorkflow } from './app/graphWorkflowExport'
import { importImageAsset, type ImportedImageAsset } from './app/imageAssets'
import {
  cancelPreviewBranch,
  renderPreviewBranch,
  resolvePreviewBranch,
  resolveSourcePreviewBranch,
} from './app/previewGraph'
import { enqueueRun, interruptRuns, useRunRecords } from './app/runQueue'
import {
  getPreviewState,
  replacePreviewStates,
  setPreviewState,
  usePreviewState,
} from './app/previewState'
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
const NODE_DRAG_TYPE = 'application/x-textureflow-node'

function getAutomaticNodePosition(nodeCount: number) {
  return {
    x: 100 + (nodeCount % 3) * 340,
    y: 100 + Math.floor(nodeCount / 3) * 560,
  }
}

function getImageAssetParameters(asset: ImportedImageAsset) {
  return {
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
  }
}

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
  const [inspectorVisible, setInspectorVisible] = useState(true)
  const [queueOpen, setQueueOpen] = useState(false)
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
  const [graphCommand, setGraphCommand] = useState<GraphCommandMode | null>(
    null,
  )
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false)
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null)
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<readonly string[]>([])
  const [dragPositions, setDragPositions] = useState<
    Readonly<Record<string, { x: number; y: number }>>
  >({})
  const [nodeSearchRequest, setNodeSearchRequest] = useState<{
    point: { x: number; y: number }
  } | null>(null)
  const graphDocument = useGraphStore((state) => state.document)
  const authoredRevision = useGraphStore((state) => state.revision)
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
  const renameNode = useGraphStore((state) => state.renameNode)
  const moveSelectedBy = useGraphStore((state) => state.moveSelectedBy)
  const duplicateSelected = useGraphStore((state) => state.duplicateSelected)
  const bringSelectedToFront = useGraphStore(
    (state) => state.bringSelectedToFront,
  )
  const toggleSelectedState = useGraphStore(
    (state) => state.toggleSelectedState,
  )
  const connectNodes = useGraphStore((state) => state.connectNodes)
  const disconnectEdge = useGraphStore((state) => state.disconnectEdge)
  const reconnectEdge = useGraphStore((state) => state.reconnectEdge)
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
  const runRecords = useRunRecords(capabilities.workers).filter(
    (record) => record.projectId === activeProject.id,
  )
  const currentExecutionContext = useRef({
    projectId: activeProject.id,
    revision: authoredRevision,
  })
  const lastTitleMouseDown = useRef<{
    nodeId: string
    at: number
    x: number
    y: number
  } | null>(null)
  const suppressNextPaneDoubleClick = useRef(false)

  useEffect(() => {
    currentExecutionContext.current = {
      projectId: activeProject.id,
      revision: authoredRevision,
    }
  }, [activeProject.id, authoredRevision])

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
  const activeRun = runRecords.find(
    (record) => record.status === 'queued' || record.status === 'running',
  )
  const flowNodes: WorkflowFlowNode[] = graphDocument.nodes.map((node) => {
    const definition = NODE_TYPE_REGISTRY[node.type]
    const defaultSize = getDefaultNodeSize(node.type)
    const latestRun = [...runRecords]
      .reverse()
      .find((record) => record.demandedNodeIds.includes(node.id))
    return {
      id: node.id,
      type: 'workflow',
      position: dragPositions[node.id] ?? node.position,
      selected: selectedNodeIds.includes(node.id),
      draggable: !node.locked && projectPersistence.access === 'writer',
      dragHandle: '.drag-handle',
      ariaLabel: `${node.label} node`,
      data: {
        label: node.label,
        summary: definition.summary,
        inputs: definition.inputs,
        outputs: definition.outputs,
        connectedInputIds: graphDocument.edges
          .filter((edge) => edge.targetNodeId === node.id)
          .map((edge) => edge.targetPortId),
        renaming: renamingNodeId === node.id,
        bypassed: node.bypassed,
        muted: node.muted,
        locked: node.locked,
        node,
        execution: latestRun?.nodes[node.id] ?? null,
        stale: !!latestRun && latestRun.revision < authoredRevision,
        onRunOutput:
          node.type === 'preview' ? () => startRun([node.id]) : undefined,
        onParameters: (patch: Record<string, unknown>) =>
          updateNodeParameters(node.id, patch),
        onLoadImage:
          node.type === 'load-image'
            ? (file: File) => void replaceNodeImage(node.id, file)
            : undefined,
        onRename: (label: string) => {
          renameNode(node.id, label)
          setRenamingNodeId(null)
        },
        onRenameCancel: () => setRenamingNodeId(null),
        onResize: (width: number, height: number) =>
          setNodeGeometry(node.id, {
            ...node.position,
            width,
            height,
          }),
      },
      style: {
        width: Math.max(node.size.width, defaultSize.width),
        height: Math.max(node.size.height, defaultSize.height),
      },
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
    selected: selectedEdgeIds.includes(edge.id),
    type: 'default',
    reconnectable: projectPersistence.access === 'writer',
    style: {
      stroke: `var(--port-${
        NODE_TYPE_REGISTRY[
          graphDocument.nodes.find((node) => node.id === edge.sourceNodeId)
            ?.type ?? ''
        ]?.outputs.find((output) => output.id === edge.sourcePortId)
          ?.dataType ?? 'image'
      })`,
    },
  }))
  const previewBranches = useMemo(
    () =>
      Object.fromEntries(
        graphDocument.nodes
          .filter(
            (node) => node.type === 'preview' || node.type === 'load-image',
          )
          .map((node) => [
            node.id,
            node.type === 'preview'
              ? resolvePreviewBranch(graphDocument, node.id)
              : resolveSourcePreviewBranch(graphDocument, node.id),
          ]),
      ),
    [graphDocument],
  )
  const selectedPreviewBranch =
    selectedNode?.type === 'preview' ? previewBranches[selectedNode.id] : null
  const selectedPreviewState = usePreviewState(
    selectedNode?.type === 'preview' ? selectedNode.id : '',
  )

  function clientPointToGraph(clientX: number, clientY: number) {
    const bounds = graphRef.current?.getBoundingClientRect()
    if (!bounds) return null
    return {
      x: (clientX - bounds.left - graphViewport.x) / graphViewport.zoom,
      y: (clientY - bounds.top - graphViewport.y) / graphViewport.zoom,
    }
  }

  function visibleGraphCenter() {
    const bounds = graphRef.current?.getBoundingClientRect()
    return bounds
      ? clientPointToGraph(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        )
      : null
  }

  function addNodeCentered(type: string, point: { x: number; y: number }) {
    const size = getDefaultNodeSize(type)
    addNode(type, {
      x: point.x - size.width / 2,
      y: point.y - size.height / 2,
    })
  }

  const openSearchAtViewportCenter = useEffectEvent(() => {
    const point = visibleGraphCenter()
    if (point) setNodeSearchRequest({ point })
  })

  useEffect(() => {
    function handleNodeSearchShortcut(event: globalThis.KeyboardEvent) {
      const target = event.target
      if (
        event.key !== '/' ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable) ||
        projectPersistence.access !== 'writer' ||
        nodeSearchRequest ||
        graphCommand ||
        diagnosticsOpen ||
        projectBrowserOpen
      ) {
        return
      }
      event.preventDefault()
      openSearchAtViewportCenter()
    }
    document.addEventListener('keydown', handleNodeSearchShortcut)
    return () =>
      document.removeEventListener('keydown', handleNodeSearchShortcut)
  }, [
    diagnosticsOpen,
    graphCommand,
    nodeSearchRequest,
    projectBrowserOpen,
    projectPersistence.access,
  ])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      replacePreviewStates(
        Object.fromEntries(
          Object.entries(previewBranches).map(([nodeId, branch]) => {
            const previousState = getPreviewState(nodeId)
            const previous =
              previousState?.status === 'ready'
                ? previousState.result
                : previousState?.status === 'loading' ||
                    previousState?.status === 'error'
                  ? previousState.previous
                  : undefined
            return [
              nodeId,
              branch ? { status: 'loading', previous } : { status: 'idle' },
            ]
          }),
        ),
      )
    })
    for (const [nodeId, branch] of Object.entries(previewBranches)) {
      if (!branch) continue
      void renderPreviewBranch(activeProject.id, branch)
        .then((result) => {
          if (!active) return
          setPreviewState(nodeId, { status: 'ready', result })
        })
        .catch((error: unknown) => {
          if (
            !active ||
            (error instanceof Error &&
              (error.message === 'Preview superseded' ||
                error.message === 'Preview canceled'))
          ) {
            return
          }
          const state = getPreviewState(nodeId)
          setPreviewState(nodeId, {
            status: 'error',
            message: error instanceof Error ? error.message : 'Preview failed',
            previous: state.status === 'loading' ? state.previous : undefined,
          })
        })
    }
    return () => {
      active = false
    }
  }, [activeProject.id, previewBranches])

  function startRun(targetOutputIds?: readonly string[]) {
    const capturedDocument = graphDocument
    const outputNodeIds =
      targetOutputIds ??
      capturedDocument.nodes
        .filter(
          (node) =>
            NODE_TYPE_REGISTRY[node.type].category === 'output' && !node.muted,
        )
        .map((node) => node.id)
    const outputCacheKeys = Object.fromEntries(
      outputNodeIds.flatMap((nodeId) => {
        const branch = resolvePreviewBranch(capturedDocument, nodeId)
        return branch ? [[nodeId, branch.cacheKey]] : []
      }),
    )
    enqueueRun(
      {
        projectId: activeProject.id,
        revision: authoredRevision,
        document: capturedDocument,
        targetOutputIds,
        outputCacheKeys,
      },
      {
        execute: async (context) => {
          const branch = resolvePreviewBranch(capturedDocument, context.nodeId)
          if (!branch) throw new Error('Output has no executable image branch')
          const result = await renderPreviewBranch(
            context.projectId,
            branch,
            `${context.nodeId}:run:${context.runId}`,
          )
          const current = currentExecutionContext.current
          if (
            current.projectId === context.projectId &&
            current.revision === context.revision
          ) {
            setPreviewState(context.nodeId, { status: 'ready', result })
          }
          return { cacheHit: result.cacheHit }
        },
        cancel: (context) =>
          cancelPreviewBranch(`${context.nodeId}:run:${context.runId}`),
      },
    )
    setQueueOpen(true)
    setInspectorVisible(false)
  }

  const runCurrentWorkflow = useEffectEvent(() => startRun())

  useEffect(() => {
    function handleRunShortcut(event: globalThis.KeyboardEvent) {
      if (!(event.ctrlKey && event.key === 'Enter')) return
      event.preventDefault()
      runCurrentWorkflow()
    }
    document.addEventListener('keydown', handleRunShortcut)
    return () => document.removeEventListener('keydown', handleRunShortcut)
  }, [])

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
        if (selectedEdgeIds.length > 0) {
          event.preventDefault()
          event.stopPropagation()
          for (const edgeId of selectedEdgeIds) disconnectEdge(edgeId)
          setSelectedEdgeIds([])
          return
        }
        if (
          document.activeElement instanceof Element &&
          document.activeElement.closest('.react-flow__edge')
        ) {
          return
        }
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
          openSearchAtViewportCenter()
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
    disconnectEdge,
    graphDocument.nodes,
    moveSelectedBy,
    projectPersistence.access,
    selectNode,
    selectedNodeIds.length,
    toggleSelectedState,
    undo,
    redo,
    selectedEdgeIds,
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

  async function replaceNodeImage(nodeId: string, file: File) {
    try {
      const asset = await importImageAsset(activeProject.id, file)
      if (!updateNodeParameters(nodeId, getImageAssetParameters(asset))) {
        throw new Error('The selected Load image node cannot be edited')
      }
      setWorkflowNotice(`Loaded ${file.name}`)
    } catch (error) {
      setWorkflowNotice(
        `${file.name}: ${error instanceof Error ? error.message : 'Import failed'}`,
      )
    }
  }

  async function importImages(files: readonly File[]) {
    let imported = 0
    const failures: string[] = []
    for (const file of files) {
      try {
        const asset = await importImageAsset(activeProject.id, file)
        const nodeCount = graphDocument.nodes.length + imported
        addNode(
          'load-image',
          getAutomaticNodePosition(nodeCount),
          undefined,
          getImageAssetParameters(asset),
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

  const handleImagePaste = useEffectEvent((event: ClipboardEvent) => {
    const activeElement = document.activeElement
    if (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLSelectElement ||
      (activeElement instanceof HTMLElement && activeElement.isContentEditable)
    ) {
      return
    }
    const files = Array.from(event.clipboardData?.files ?? []).filter(
      (file) =>
        file.type.startsWith('image/') || /\.(?:png|jpe?g)$/i.test(file.name),
    )
    if (files.length === 0) return
    event.preventDefault()
    const selectedLoadNode =
      selectedNodeIds.length === 1
        ? graphDocument.nodes.find(
            (node) =>
              node.id === selectedNodeIds[0] && node.type === 'load-image',
          )
        : null
    if (selectedLoadNode) {
      void replaceNodeImage(selectedLoadNode.id, files[0])
      return
    }
    const point = visibleGraphCenter()
    if (!point) return
    void importImageAsset(activeProject.id, files[0])
      .then((asset) => {
        const size = getDefaultNodeSize('load-image')
        addNode(
          'load-image',
          { x: point.x - size.width / 2, y: point.y - size.height / 2 },
          undefined,
          getImageAssetParameters(asset),
        )
        setWorkflowNotice(`Pasted ${files[0].name || 'clipboard image'}`)
      })
      .catch((error: unknown) => {
        setWorkflowNotice(
          `Clipboard image: ${error instanceof Error ? error.message : 'Import failed'}`,
        )
      })
  })

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => handleImagePaste(event)
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  async function refreshLocalProjects() {
    setLocalProjects(await listLocalProjects())
  }

  function closeProjectBrowser() {
    setProjectBrowserOpen(false)
    requestAnimationFrame(() => projectSwitcherRef.current?.focus())
  }

  return (
    <div
      className="workspace"
      data-authored-revision={String(authoredRevision)}
      data-theme={theme}
      data-undo-depth={String(undoStack.length)}
    >
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
            disabled={
              !capabilities.workers ||
              !graphDocument.nodes.some(
                (node) =>
                  NODE_TYPE_REGISTRY[node.type].category === 'output' &&
                  !node.muted,
              )
            }
            label="Run workflow"
            onClick={() => startRun()}
          >
            <Play aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            disabled={!activeRun}
            label="Interrupt runs"
            onClick={() => interruptRuns(activeProject.id)}
          >
            <Square aria-hidden="true" size={15} />
          </IconButton>
          <IconButton
            label="Run history"
            onClick={() => {
              setQueueOpen((open) => !open)
              setInspectorVisible(false)
            }}
          >
            <ListOrdered aria-hidden="true" size={17} />
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
              if (files) void importImages(Array.from(files))
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
          {!inspectorVisible && !queueOpen ? (
            <IconButton
              label="Show inspector"
              onClick={() => {
                setInspectorVisible(true)
                setQueueOpen(false)
              }}
            >
              <PanelRight aria-hidden="true" size={17} />
            </IconButton>
          ) : null}
        </div>
      </header>

      <div
        className={`workspace-body${inspectorVisible ? '' : ' inspector-hidden'}`}
      >
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
                          draggable
                          key={item.id}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'copy'
                            event.dataTransfer.setData(NODE_DRAG_TYPE, item.id)
                          }}
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
          {selectedTemplate ? (
            <button
              className="primary-command catalog-add-command"
              disabled={projectPersistence.access !== 'writer'}
              onClick={() => {
                addNode(
                  selectedTemplate.id,
                  getAutomaticNodePosition(graphDocument.nodes.length),
                )
              }}
              type="button"
            >
              <Plus aria-hidden="true" size={15} />
              Add to canvas
            </button>
          ) : null}
        </aside>

        <main
          aria-label="Graph canvas"
          className="graph-region"
          onDoubleClick={(event) => {
            if (suppressNextPaneDoubleClick.current) {
              suppressNextPaneDoubleClick.current = false
              return
            }
            const target = event.target as Element
            if (
              target.closest('.react-flow__node') ||
              target.closest('.react-flow__controls') ||
              target.closest('.react-flow__minimap') ||
              !target.closest('.react-flow__pane')
            ) {
              return
            }
            const point = clientPointToGraph(event.clientX, event.clientY)
            if (point) setNodeSearchRequest({ point })
          }}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(NODE_DRAG_TYPE)) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(event) => {
            const type = event.dataTransfer.getData(NODE_DRAG_TYPE)
            if (!NODE_TYPE_REGISTRY[type]) return
            event.preventDefault()
            const point = clientPointToGraph(event.clientX, event.clientY)
            if (point) addNodeCentered(type, point)
          }}
          onMouseDownCapture={(event) => {
            if (event.button !== 0) return
            const target = event.target as Element
            const nodeElement = target.closest<HTMLElement>(
              '.react-flow__node[data-id]',
            )
            const nodeId = nodeElement?.dataset.id
            const now = performance.now()
            const previous = lastTitleMouseDown.current
            if (
              previous &&
              now - previous.at < 400 &&
              Math.hypot(
                event.clientX - previous.x,
                event.clientY - previous.y,
              ) < 4
            ) {
              event.preventDefault()
              event.stopPropagation()
              lastTitleMouseDown.current = null
              suppressNextPaneDoubleClick.current = true
              const node = graphDocument.nodes.find(
                (candidate) => candidate.id === previous.nodeId,
              )
              if (!node?.locked) setRenamingNodeId(previous.nodeId)
              return
            }
            if (nodeId && target.closest('.workflow-node-header')) {
              lastTitleMouseDown.current = {
                nodeId,
                at: now,
                x: event.clientX,
                y: event.clientY,
              }
            } else {
              lastTitleMouseDown.current = null
            }
          }}
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
              onEdgeClick={(event, edge) => {
                event.stopPropagation()
                clearSelection()
                setSelectedEdgeIds([edge.id])
                graphRef.current?.focus()
              }}
              onNodeClick={(event, node) => {
                setSelectedEdgeIds([])
                selectNode(node.id, event.shiftKey)
              }}
              onNodeDrag={(_, node) => {
                setDragPositions((current) => ({
                  ...current,
                  [node.id]: node.position,
                }))
              }}
              onNodeDragStop={(_, node) => {
                if (projectPersistence.access === 'writer') {
                  moveNode(node.id, node.position)
                }
                setDragPositions((current) => {
                  const next = { ...current }
                  delete next[node.id]
                  return next
                })
              }}
              onMoveEnd={(_, viewport) => setViewport(viewport)}
              onEdgesDelete={(edges) => {
                for (const edge of edges) disconnectEdge(edge.id)
                setSelectedEdgeIds([])
              }}
              onPaneClick={() => {
                setSelectedEdgeIds([])
                clearSelection()
              }}
              onReconnect={(oldEdge, connection) => {
                if (
                  !connection.source ||
                  !connection.target ||
                  !connection.sourceHandle ||
                  !connection.targetHandle
                ) {
                  return
                }
                reconnectEdge(oldEdge.id, {
                  sourceNodeId: connection.source,
                  sourcePortId: connection.sourceHandle,
                  targetNodeId: connection.target,
                  targetPortId: connection.targetHandle,
                })
              }}
              reconnectRadius={24}
              zoomOnDoubleClick={false}
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

        {queueOpen ? (
          <aside
            aria-label="Run history"
            className="run-history-panel"
            tabIndex={-1}
          >
            <div className="run-history-header">
              <div>
                <p className="eyebrow">Execution</p>
                <h2>Run history</h2>
              </div>
              <IconButton
                label="Close run history"
                onClick={() => setQueueOpen(false)}
              >
                <X aria-hidden="true" size={15} />
              </IconButton>
            </div>
            {runRecords.length === 0 ? (
              <p className="run-history-empty">No workflow runs yet</p>
            ) : (
              <ol className="run-history-list">
                {[...runRecords].reverse().map((record) => (
                  <li
                    className="run-history-row"
                    data-demanded-nodes={record.demandedNodeIds.join(',')}
                    data-run-id={record.id}
                    data-run-revision={String(record.revision)}
                    data-target-outputs={record.targetOutputIds.join(',')}
                    key={record.id}
                  >
                    <div>
                      <strong>{record.status}</strong>
                      <span>Revision {record.revision}</span>
                    </div>
                    <span>
                      {record.demandedNodeIds.length} nodes ·{' '}
                      {record.targetOutputIds.length} outputs
                    </span>
                    {record.diagnostic ? (
                      <small>{record.diagnostic}</small>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </aside>
        ) : inspectorVisible ? (
          <aside
            aria-label="Inspector"
            className="inspector"
            ref={inspectorRef}
            tabIndex={-1}
          >
            <IconButton
              className="inspector-close"
              label="Close inspector"
              onClick={() => setInspectorVisible(false)}
            >
              <X aria-hidden="true" size={15} />
            </IconButton>
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
                  <span
                    className={`template-icon ${selectedTemplate.category}`}
                  >
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

                {selectedNode ? (
                  <section className="inspector-section schema-inspector-fields">
                    <h3>Parameters</h3>
                    <NodeWidgetFields
                      drivenKeys={
                        new Set(
                          graphDocument.edges
                            .filter(
                              (edge) => edge.targetNodeId === selectedNode.id,
                            )
                            .map((edge) => edge.targetPortId)
                            .filter((id) => id.startsWith('parameter:'))
                            .map((id) => id.slice('parameter:'.length)),
                        )
                      }
                      host="inspector"
                      node={selectedNode}
                      onChange={(patch) =>
                        updateNodeParameters(selectedNode.id, patch)
                      }
                    />
                  </section>
                ) : null}

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
                {selectedNode?.type === 'preview' ? (
                  <section className="inspector-section preview-surface">
                    <h3>Preview</h3>
                    {!selectedPreviewBranch ? (
                      <p>Connect a Load image node.</p>
                    ) : selectedPreviewState?.status === 'loading' ? (
                      <p role="status">Rendering preview</p>
                    ) : selectedPreviewState?.status === 'error' ? (
                      <p role="alert">{selectedPreviewState.message}</p>
                    ) : selectedPreviewState?.status === 'ready' ? (
                      <>
                        <ImagePreviewCanvas
                          result={selectedPreviewState.result}
                        />
                        <p>
                          {selectedPreviewState.result.sourceWidth} ×{' '}
                          {selectedPreviewState.result.sourceHeight} source
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
        ) : null}
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
          connectionOptions={connectionOptions}
          geometry={
            selectedNode
              ? { ...selectedNode.position, ...selectedNode.size }
              : null
          }
          mode={graphCommand}
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
      {nodeSearchRequest ? (
        <NodeSearchDialog
          items={NODE_CATALOG}
          onChoose={(type) => {
            addNodeCentered(type, nodeSearchRequest.point)
            setNodeSearchRequest(null)
            requestAnimationFrame(() => graphRef.current?.focus())
          }}
          onClose={() => {
            setNodeSearchRequest(null)
            requestAnimationFrame(() => graphRef.current?.focus())
          }}
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
