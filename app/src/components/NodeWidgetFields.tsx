import type { GraphNode } from '../domain/graph'
import { Handle, Position } from '@xyflow/react'
import {
  createNodeWidgetPatch,
  getNodeWidgetResetPatch,
  getNodeWidgetSchema,
  isNodeWidgetVisible,
  parameterPortId,
} from '../domain/nodeWidgetSchema'

interface NodeWidgetFieldsProps {
  host: 'node' | 'inspector'
  node: GraphNode
  drivenKeys?: ReadonlySet<string>
  onChange(patch: Record<string, unknown>): void
}

export function NodeWidgetFields({
  host,
  node,
  drivenKeys = new Set(),
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
        const driven = drivenKeys.has(field.key)
        const parameterHandle =
          host === 'node' && field.inputType ? (
            <Handle
              aria-label={`${field.label} parameter input`}
              className={`parameter-handle port-${field.inputType}`}
              id={parameterPortId(field.key)}
              position={Position.Left}
              type="target"
            />
          ) : null
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
            <div className="node-widget-row" key={field.key}>
              {parameterHandle}
              <label
                className={`node-widget-checkbox${driven ? ' driven' : ''}`}
              >
                <input
                  checked={value === true}
                  disabled={driven}
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
                {driven ? <small>Driven</small> : null}
              </label>
            </div>
          )
        }
        if (field.kind === 'select') {
          return (
            <div className="node-widget-row" key={field.key}>
              {parameterHandle}
              <label className={`node-widget-field${driven ? ' driven' : ''}`}>
                <span>{field.label}</span>
                <select
                  aria-label={`${node.label} ${field.label}`}
                  disabled={driven}
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
                {driven ? <small>Driven</small> : null}
              </label>
            </div>
          )
        }
        if (field.kind === 'color') {
          return (
            <div className="node-widget-row" key={field.key}>
              {parameterHandle}
              <label className={`node-widget-field${driven ? ' driven' : ''}`}>
                <span>{field.label}</span>
                <input
                  aria-label={`${node.label} ${field.label}`}
                  disabled={driven}
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
                {driven ? <small>Driven</small> : null}
              </label>
            </div>
          )
        }
        if (field.kind === 'text') {
          return (
            <div className="node-widget-row" key={field.key}>
              {parameterHandle}
              <label className={`node-widget-field${driven ? ' driven' : ''}`}>
                <span>{field.label}</span>
                <input
                  aria-label={`${node.label} ${field.label}`}
                  disabled={driven}
                  onChange={(event) =>
                    onChange(
                      createNodeWidgetPatch(
                        node.type,
                        field.key,
                        event.target.value,
                      ),
                    )
                  }
                  type="text"
                  value={String(value)}
                />
                {driven ? <small>Driven</small> : null}
              </label>
            </div>
          )
        }
        return (
          <div className="node-widget-row" key={field.key}>
            {parameterHandle}
            <label
              className={`node-widget-field numeric${driven ? ' driven' : ''}`}
            >
              <span>
                {field.label}
                {field.unit ? ` ${field.unit}` : ''}
              </span>
              <input
                aria-label={`${node.label} ${field.label} slider`}
                disabled={driven}
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
                disabled={driven}
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
              {driven ? <small>Driven</small> : null}
            </label>
          </div>
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
