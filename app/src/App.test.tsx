import { fireEvent, render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { graphStore } from './app/graphState'

vi.mock('./app/projectPersistence', () => ({
  createLocalProject: vi.fn(),
  deleteLocalProject: vi.fn(),
  listLocalProjects: vi.fn(async () => []),
  renameLocalProject: vi.fn(),
  useProjectPersistence: () => ({
    status: 'saved',
    access: 'writer',
    foreignTabId: null,
    durability: 'best-effort',
    usageBytes: null,
    quotaBytes: null,
    saveNow: vi.fn(async () => undefined),
    takeOver: vi.fn(async () => undefined),
  }),
}))

beforeEach(() => {
  graphStore.setState({
    document: { nodes: [], edges: [] },
    selectedNodeIds: [],
    undoStack: [],
    redoStack: [],
    connectionDiagnostic: null,
  })
})

describe('workspace shell', () => {
  it('renders the named application regions', () => {
    render(<App />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(
      screen.getByRole('complementary', { name: 'Node library' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('main', { name: 'Graph canvas' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('complementary', { name: 'Inspector' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('contentinfo', { name: 'Workspace status' }),
    ).toBeInTheDocument()
  })

  it('cycles theme preference from the toolbar', () => {
    const { container } = render(<App />)
    const workspace = container.firstElementChild

    expect(workspace).toHaveAttribute('data-theme', 'system')
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Theme: system. Switch to light',
      }),
    )
    expect(workspace).toHaveAttribute('data-theme', 'light')
  })

  it('moves focus between workspace regions with F6', () => {
    render(<App />)
    const appBar = screen.getByRole('banner')
    const library = screen.getByRole('complementary', {
      name: 'Node library',
    })

    appBar.focus()
    fireEvent.keyDown(appBar, { key: 'F6' })
    expect(library).toHaveFocus()
  })

  it('adds a catalog node through the inspector command', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Load image' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to canvas' }))

    expect(await screen.findByLabelText('Load image node')).toBeInTheDocument()
    expect(screen.getByText('1 nodes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
  })

  it('has no automated accessibility violations in the empty shell', async () => {
    const { container } = render(<App />)
    const result = await axe.run(container)

    expect(result.violations).toEqual([])
  })
})
