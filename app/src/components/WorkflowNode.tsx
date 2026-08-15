import {
  Handle,
  NodeResizer,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import type { GraphNode } from '../domain/graph'
import { ImagePreviewCanvas } from './ImagePreviewCanvas'
import { NodeWidgetFields } from './NodeWidgetFields'

interface NodePreviewResult {
  width: number
  height: number
  pixels: ArrayBuffer
  sample: readonly [number, number, number, number]
  cacheHit: boolean
  generation: number
}

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string
  summary: string
  inputs: readonly { id: string; label: string }[]
  outputs: readonly { id: string; label: string }[]
  bypassed: boolean
  muted: boolean
  locked: boolean
  node: GraphNode
  preview:
    | { status: 'idle' | 'loading' }
    | { status: 'ready'; result: NodePreviewResult }
    | { status: 'error'; message: string }
  onParameters(patch: Record<string, unknown>): void
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
      <NodeWidgetFields
        host="node"
        node={data.node}
        onChange={data.onParameters}
      />
      {data.node.type === 'preview' ? (
        <div className="workflow-node-preview nodrag nowheel">
          {data.preview.status === 'ready' ? (
            <ImagePreviewCanvas result={data.preview.result} />
          ) : data.preview.status === 'loading' ? (
            <span role="status">Rendering</span>
          ) : data.preview.status === 'error' ? (
            <span role="alert">{data.preview.message}</span>
          ) : (
            <span>Run or connect an image</span>
          )}
        </div>
      ) : null}
    </div>
  )
}
