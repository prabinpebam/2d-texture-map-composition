import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, FolderOpen, Plus, Trash2, X } from 'lucide-react'
import { IconButton } from './IconButton'

export interface LocalProjectSummary {
  id: string
  name: string
  revision: number
  modifiedAt: number
}

interface ProjectBrowserDialogProps {
  activeProjectId: string
  projects: readonly LocalProjectSummary[]
  onClose(): void
  onCreate(name: string): Promise<void>
  onDelete(projectId: string): Promise<void>
  onOpen(project: LocalProjectSummary): void
  onRename(projectId: string, name: string): Promise<void>
}

export function ProjectBrowserDialog({
  activeProjectId,
  projects,
  onClose,
  onCreate,
  onDelete,
  onOpen,
  onRename,
}: ProjectBrowserDialogProps) {
  const newProjectRef = useRef<HTMLInputElement>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    newProjectRef.current?.focus()
  }, [])

  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newProjectName.trim()
    if (!name) return
    await onCreate(name)
    setNewProjectName('')
  }

  return (
    <div className="dialog-scrim">
      <section
        aria-labelledby="project-browser-title"
        aria-modal="true"
        className="runtime-dialog project-browser-dialog"
        role="dialog"
      >
        <div className="runtime-dialog-header">
          <div>
            <p className="eyebrow">Local projects</p>
            <h2 id="project-browser-title">Project browser</h2>
          </div>
          <IconButton label="Close project browser" onClick={onClose}>
            <X aria-hidden="true" size={17} />
          </IconButton>
        </div>

        <form className="new-project-form" onSubmit={createProject}>
          <label>
            New project name
            <input
              maxLength={200}
              onChange={(event) => setNewProjectName(event.target.value)}
              ref={newProjectRef}
              value={newProjectName}
            />
          </label>
          <button
            className="primary-command"
            disabled={!newProjectName.trim()}
            type="submit"
          >
            <Plus aria-hidden="true" size={15} />
            Create
          </button>
        </form>

        <div className="project-list">
          {projects.map((project) => {
            const active = project.id === activeProjectId
            return (
              <div className="project-row" key={project.id}>
                <div>
                  <input
                    aria-label={`Name for ${project.name}`}
                    maxLength={200}
                    onChange={(event) =>
                      setNames((current) => ({
                        ...current,
                        [project.id]: event.target.value,
                      }))
                    }
                    value={names[project.id] ?? project.name}
                  />
                  <span>
                    Revision {project.revision} ·{' '}
                    {active ? 'Open now' : 'Local'}
                  </span>
                </div>
                <div className="project-row-actions">
                  <IconButton
                    disabled={active}
                    label={`Open ${project.name}`}
                    onClick={() => onOpen(project)}
                  >
                    <FolderOpen aria-hidden="true" size={16} />
                  </IconButton>
                  <IconButton
                    disabled={!(names[project.id] ?? '').trim()}
                    label={`Save name for ${project.name}`}
                    onClick={() =>
                      void onRename(
                        project.id,
                        names[project.id] ?? project.name,
                      )
                    }
                  >
                    <Check aria-hidden="true" size={16} />
                  </IconButton>
                  <IconButton
                    disabled={active}
                    label={`Delete ${project.name}`}
                    onClick={() => void onDelete(project.id)}
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </IconButton>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
