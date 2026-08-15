import {
  Handle,
  NodeResizer,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react'

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string
  summary: string
  inputs: readonly { id: string; label: string }[]
  outputs: readonly { id: string; label: string }[]
  bypassed: boolean
  muted: boolean
  locked: boolean
  onResize(width: number, height: number): void
}

export type WorkflowFlowNode = Node<WorkflowNodeData, 'workflow'>

export function WorkflowNode({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const state = data.locked
    ? 'Locked'
    : data.muted
      ? 'Muted'
      : data.bypassed
        ? 'Bypassed'
        : 'Ready'
  return (
    <div
      className={`workflow-node${selected ? ' selected' : ''}${data.locked ? ' locked' : ''}${data.muted ? ' muted' : ''}${data.bypassed ? ' bypassed' : ''}`}
    >
      <NodeResizer
        isVisible={selected && !data.locked}
        maxHeight={1200}
        maxWidth={560}
        minHeight={96}
        minWidth={180}
        onResizeEnd={(_, parameters) =>
          data.onResize(parameters.width, parameters.height)
        }
      />
      <div className="workflow-node-header">
        <span className="workflow-node-mark" aria-hidden="true" />
        <strong>{data.label}</strong>
        <span className="workflow-node-state">{state}</span>
      </div>
      <p>{data.summary}</p>
      <div className="workflow-node-ports">
        <div className="workflow-node-port-list inputs">
          {data.inputs.map((port, index) => (
            <span className="workflow-node-port" key={port.id}>
              <Handle
                aria-label={`${port.label} input`}
                id={port.id}
                position={Position.Left}
                style={{ top: 76 + index * 24 }}
                type="target"
              />
              {port.label}
            </span>
          ))}
        </div>
        <div className="workflow-node-port-list outputs">
          {data.outputs.map((port, index) => (
            <span className="workflow-node-port" key={port.id}>
              {port.label}
              <Handle
                aria-label={`${port.label} output`}
                id={port.id}
                position={Position.Right}
                style={{ top: 76 + index * 24 }}
                type="source"
              />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
