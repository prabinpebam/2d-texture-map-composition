import type { GraphNode } from '../domain/graph'
import {
  createNodeWidgetPatch,
  getNodeWidgetResetPatch,
  getNodeWidgetSchema,
  isNodeWidgetVisible,
} from '../domain/nodeWidgetSchema'

interface NodeWidgetFieldsProps {
  host: 'node' | 'inspector'
  node: GraphNode
  onChange(patch: Record<string, unknown>): void
}

export function NodeWidgetFields({
  host,
  node,
  onChange,
}: NodeWidgetFieldsProps) {
  const parameters = node.parameters ?? {}
  const fields = getNodeWidgetSchema(node.type).filter(
    (field) =>
      (host === 'node' ? field.compact : field.inspector) &&
      isNodeWidgetVisible(field, parameters),
  )
  if (fields.length === 0) return null

  return (
    <div
      className={`node-widget-fields ${host} nodrag nowheel`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {fields.map((field) => {
        const value = parameters[field.key] ?? field.defaultValue
        if (field.kind === 'readonly') {
          return (
            <div className="node-widget-readonly" key={field.key}>
              <span>{field.label}</span>
              <strong>{value ? String(value) : 'None'}</strong>
            </div>
          )
        }
        if (field.kind === 'checkbox') {
          return (
            <label className="node-widget-checkbox" key={field.key}>
              <input
                checked={value === true}
                onChange={(event) =>
                  onChange(
                    createNodeWidgetPatch(
                      node.type,
                      field.key,
                      event.target.checked,
                    ),
                  )
                }
                type="checkbox"
              />
              {field.label}
            </label>
          )
        }
        if (field.kind === 'select') {
          return (
            <label className="node-widget-field" key={field.key}>
              <span>{field.label}</span>
              <select
                aria-label={`${node.label} ${field.label}`}
                onChange={(event) =>
                  onChange(
                    createNodeWidgetPatch(
                      node.type,
                      field.key,
                      event.target.value,
                    ),
                  )
                }
                value={String(value)}
              >
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )
        }
        if (field.kind === 'color') {
          return (
            <label className="node-widget-field" key={field.key}>
              <span>{field.label}</span>
              <input
                aria-label={`${node.label} ${field.label}`}
                onChange={(event) =>
                  onChange(
                    createNodeWidgetPatch(
                      node.type,
                      field.key,
                      event.target.value,
                    ),
                  )
                }
                type="color"
                value={String(value)}
              />
            </label>
          )
        }
        return (
          <label className="node-widget-field numeric" key={field.key}>
            <span>
              {field.label}
              {field.unit ? ` ${field.unit}` : ''}
            </span>
            <input
              aria-label={`${node.label} ${field.label} slider`}
              max={field.maximum}
              min={field.minimum}
              onChange={(event) =>
                onChange(
                  createNodeWidgetPatch(
                    node.type,
                    field.key,
                    Number(event.target.value),
                  ),
                )
              }
              step={field.step}
              type="range"
              value={Number(value)}
            />
            <input
              aria-label={`${node.label} ${field.label}`}
              max={field.maximum}
              min={field.minimum}
              onChange={(event) => {
                const numericValue = Number(event.target.value)
                if (Number.isFinite(numericValue)) {
                  onChange(
                    createNodeWidgetPatch(node.type, field.key, numericValue),
                  )
                }
              }}
              step={field.step}
              type="number"
              value={Number(value)}
            />
          </label>
        )
      })}
      <button
        className="node-widget-reset"
        onClick={() => onChange(getNodeWidgetResetPatch(node.type))}
        type="button"
      >
        Reset
      </button>
    </div>
  )
}
