import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  Blend,
  BoxSelect,
  ChevronDown,
  CircleGauge,
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
  Redo2,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  SunMedium,
  Undo2,
  Upload,
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

function App() {
  const [theme, setTheme] = useState<ThemePreference>('system')
  const [selectedTemplate, setSelectedTemplate] =
    useState<NodeCatalogItem | null>(null)
  const [capabilities] = useState(detectEnvironment)
  const [computeProbe, setComputeProbe] = useState<
    ComputeProbeResult | 'checking' | 'unavailable'
  >(() => (capabilities.workers ? 'checking' : 'unavailable'))

  const appBarRef = useRef<HTMLElement>(null)
  const libraryRef = useRef<HTMLElement>(null)
  const graphRef = useRef<HTMLElement>(null)
  const inspectorRef = useRef<HTMLElement>(null)
  const statusRef = useRef<HTMLElement>(null)

  const ThemeIcon = THEME_ICONS[theme]
  const nextThemeValue = nextTheme(theme)

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
          <IconButton disabled label="Undo">
            <Undo2 aria-hidden="true" size={17} />
          </IconButton>
          <IconButton disabled label="Redo">
            <Redo2 aria-hidden="true" size={17} />
          </IconButton>
          <span className="toolbar-separator" aria-hidden="true" />
          <IconButton disabled label="Import images">
            <Upload aria-hidden="true" size={17} />
          </IconButton>
          <IconButton disabled label="Export workflow">
            <Download aria-hidden="true" size={17} />
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
            maxZoom={2.5}
            minZoom={0.2}
            nodes={[]}
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
            <Panel className="empty-workflow" position="top-center">
              <span className="empty-icon" aria-hidden="true">
                <BoxSelect size={21} />
              </span>
              <div>
                <strong>No nodes</strong>
                <span>Select a node template from the library.</span>
              </div>
            </Panel>
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

              <section className="inspector-section">
                <h3>State</h3>
                <div className="state-row">
                  <LockKeyhole aria-hidden="true" size={15} />
                  <span>Ready to add in graph authoring</span>
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
          <span className="status-item">
            <HardDrive aria-hidden="true" size={13} />
            {capabilities.indexedDb
              ? 'Best effort storage'
              : 'Storage unavailable'}
          </span>
        </div>
        <div className="status-group">
          <span className="status-item">
            <Map aria-hidden="true" size={13} />0 nodes
          </span>
          <span
            className="status-item"
            data-compute-sample={
              typeof computeProbe === 'object'
                ? computeProbe.sample.join(',')
                : undefined
            }
          >
            <CircleGauge aria-hidden="true" size={13} />
            {computeProbe === 'checking'
              ? 'Checking compute'
              : computeProbe === 'unavailable'
                ? 'Compute unavailable'
                : computeProbe.backend === 'wasm'
                  ? 'WASM compute'
                  : 'CPU reference'}
          </span>
          <span className="status-item zoom-readout">
            <Maximize2 aria-hidden="true" size={13} />
            100%
          </span>
        </div>
      </footer>
    </div>
  )
}

export default App
