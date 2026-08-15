import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

export type GraphCommandMode = 'add' | 'connect' | 'geometry'

export interface ConnectionOption {
  value: string
  label: string
}

interface GeometryValue {
  x: number
  y: number
  width: number
  height: number
}

interface GraphCommandDialogProps {
  mode: GraphCommandMode
  addOptions: readonly { value: string; label: string }[]
  connectionOptions: readonly ConnectionOption[]
  geometry: GeometryValue | null
  onAdd(type: string): void
  onClose(): void
  onConnect(value: string): boolean
  onGeometry(value: GeometryValue): boolean
}

const TITLES: Record<GraphCommandMode, string> = {
  add: 'Add node',
  connect: 'Connect nodes',
  geometry: 'Position and size',
}

export function GraphCommandDialog({
  mode,
  addOptions,
  connectionOptions,
  geometry,
  onAdd,
  onClose,
  onConnect,
  onGeometry,
}: GraphCommandDialogProps) {
  const firstControlRef = useRef<HTMLSelectElement | HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    firstControlRef.current?.focus()
  }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    if (mode === 'add') {
      onAdd(String(values.get('nodeType')))
      onClose()
      return
    }
    if (mode === 'connect') {
      if (onConnect(String(values.get('connection')))) onClose()
      else setError('Connection could not be created.')
      return
    }
    const nextGeometry = {
      x: Number(values.get('x')),
      y: Number(values.get('y')),
      width: Number(values.get('width')),
      height: Number(values.get('height')),
    }
    if (onGeometry(nextGeometry)) onClose()
    else setError('Width must be 180-560 and height must be 96-1200.')
  }

  return (
    <div className="dialog-scrim">
      <section
        aria-labelledby="graph-command-title"
        aria-modal="true"
        className="runtime-dialog graph-command-dialog"
        role="dialog"
      >
        <div className="runtime-dialog-header">
          <div>
            <p className="eyebrow">Graph command</p>
            <h2 id="graph-command-title">{TITLES[mode]}</h2>
          </div>
          <IconButton label={`Close ${TITLES[mode]}`} onClick={onClose}>
            <X aria-hidden="true" size={17} />
          </IconButton>
        </div>
        <form className="graph-command-form" onSubmit={submit}>
          {mode === 'add' ? (
            <label>
              Node type
              <select
                defaultValue={addOptions[0]?.value}
                name="nodeType"
                ref={firstControlRef as RefObject<HTMLSelectElement>}
              >
                {addOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {mode === 'connect' ? (
            <label>
              Compatible target
              <select
                defaultValue={connectionOptions[0]?.value}
                disabled={connectionOptions.length === 0}
                name="connection"
                ref={firstControlRef as RefObject<HTMLSelectElement>}
              >
                {connectionOptions.length === 0 ? (
                  <option value="">No compatible targets</option>
                ) : null}
                {connectionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {mode === 'geometry' && geometry ? (
            <div className="geometry-grid">
              {(['x', 'y', 'width', 'height'] as const).map((field, index) => (
                <label key={field}>
                  {field === 'x' || field === 'y'
                    ? `${field.toUpperCase()} position`
                    : field[0].toUpperCase() + field.slice(1)}
                  <input
                    defaultValue={geometry[field]}
                    name={field}
                    ref={
                      index === 0
                        ? (firstControlRef as RefObject<HTMLInputElement>)
                        : undefined
                    }
                    step="1"
                    type="number"
                  />
                </label>
              ))}
            </div>
          ) : null}
          {error ? (
            <p className="command-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="dialog-actions">
            <button
              className="secondary-command"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="primary-command"
              disabled={mode === 'connect' && connectionOptions.length === 0}
              type="submit"
            >
              {mode === 'add'
                ? 'Add node'
                : mode === 'connect'
                  ? 'Connect'
                  : 'Apply'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
