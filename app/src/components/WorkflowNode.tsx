import {
  Handle,
  NodeResizer,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { ImagePlus, Play } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { usePreviewState } from '../app/previewState'
import type { GraphNode, PortDataType } from '../domain/graph'
import { ImagePreviewCanvas } from './ImagePreviewCanvas'
import { NodeWidgetFields } from './NodeWidgetFields'

interface NodeExecutionView {
  phase: 'queued' | 'running' | 'cached' | 'succeeded' | 'error' | 'canceled'
  progress: number
  diagnostic?: string
}

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string
  summary: string
  inputs: readonly {
    id: string
    label: string
    accepts: readonly PortDataType[]
  }[]
  outputs: readonly { id: string; label: string; dataType: PortDataType }[]
  connectedInputIds: readonly string[]
  renaming: boolean
  bypassed: boolean
  muted: boolean
  locked: boolean
  node: GraphNode
  execution: NodeExecutionView | null
  stale: boolean
  onParameters(patch: Record<string, unknown>): void
  onLoadImage?: (file: File) => void
  onRename(label: string): void
  onRenameCancel(): void
  onRunOutput?: () => void
  onResize(geometry: {
    x: number
    y: number
    width: number
    height: number
  }): void
}

export type WorkflowFlowNode = Node<WorkflowNodeData, 'workflow'>

function WorkflowNodePreview({
  nodeId,
  emptyText = 'Run or connect an image',
}: {
  nodeId: string
  emptyText?: string
}) {
  const preview = usePreviewState(nodeId)
  return (
    <div className="workflow-node-preview nodrag nowheel">
      {preview.status === 'ready' ? (
        <ImagePreviewCanvas result={preview.result} />
      ) : preview.status === 'loading' ? (
        <>
          {preview.previous ? (
            <ImagePreviewCanvas result={preview.previous} />
          ) : null}
          <span className="preview-state-overlay" role="status">
            Rendering
          </span>
        </>
      ) : preview.status === 'error' ? (
        <>
          {preview.previous ? (
            <ImagePreviewCanvas result={preview.previous} />
          ) : null}
          <span className="preview-state-overlay error" role="alert">
            {preview.message}
          </span>
        </>
      ) : (
        <span>{emptyText}</span>
      )}
    </div>
  )
}

export function WorkflowNode({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const titleInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!data.renaming) return
    titleInputRef.current?.focus()
    titleInputRef.current?.select()
  }, [data.renaming])
  const semanticInputs = data.inputs.filter(
    (input) => !input.id.startsWith('parameter:'),
  )
  const drivenKeys = new Set(
    data.connectedInputIds
      .filter((inputId) => inputId.startsWith('parameter:'))
      .map((inputId) => inputId.slice('parameter:'.length)),
  )
  const state = data.locked
    ? 'Locked'
    : data.muted
      ? 'Muted'
      : data.bypassed
        ? 'Bypassed'
        : data.stale
          ? 'Stale'
          : data.execution
            ? data.execution.phase
            : 'Ready'
  const minimumHeight =
    data.node.type === 'load-image'
      ? 300
      : data.node.type === 'preview'
        ? 220
        : 96
  return (
    <div
      className={`workflow-node${selected ? ' selected' : ''}${data.locked ? ' locked' : ''}${data.muted ? ' muted' : ''}${data.bypassed ? ' bypassed' : ''}`}
    >
      <NodeResizer
        handleClassName="comfy-resize-handle"
        isVisible={selected && !data.locked}
        maxHeight={1200}
        maxWidth={640}
        minHeight={minimumHeight}
        minWidth={180}
        onResizeEnd={(_, parameters) =>
          data.onResize({
            x: parameters.x,
            y: parameters.y,
            width: parameters.width,
            height: parameters.height,
          })
        }
      />
      <div aria-hidden="true" className="workflow-node-surface" />
      <div className="workflow-node-header drag-handle">
        <span className="workflow-node-mark" aria-hidden="true" />
        {data.renaming ? (
          <input
            aria-label="Node title"
            className="node-title-input nodrag"
            defaultValue={data.label}
            onBlur={(event) => {
              data.onRename(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              else if (event.key === 'Escape') {
                event.preventDefault()
                data.onRenameCancel()
              }
            }}
            ref={titleInputRef}
          />
        ) : (
          <strong>{data.label}</strong>
        )}
        <span className="workflow-node-state">{state}</span>
      </div>
      <p>{data.summary}</p>
      <div className="workflow-node-ports">
        <div className="workflow-node-port-list inputs">
          {semanticInputs.map((port) => (
            <span className="workflow-node-port" key={port.id}>
              <Handle
                aria-label={`${port.label} input`}
                className={`port-${port.accepts[0]}`}
                id={port.id}
                position={Position.Left}
                role="button"
                tabIndex={0}
                type="target"
              />
              {port.label}
            </span>
          ))}
        </div>
        <div className="workflow-node-port-list outputs">
          {data.outputs.map((port) => (
            <span className="workflow-node-port" key={port.id}>
              {port.label}
              <Handle
                aria-label={`${port.label} output`}
                className={`port-${port.dataType}`}
                id={port.id}
                position={Position.Right}
                role="button"
                tabIndex={0}
                type="source"
              />
            </span>
          ))}
        </div>
      </div>
      <NodeWidgetFields
        drivenKeys={drivenKeys}
        host="node"
        node={data.node}
        onChange={data.onParameters}
      />
      {data.node.type === 'load-image' ? (
        <div
          className="load-image-source nodrag nowheel"
          onDragOver={(event) => {
            if (
              !Array.from(event.dataTransfer.items).some(
                (item) => item.kind === 'file',
              )
            ) {
              return
            }
            event.preventDefault()
            event.stopPropagation()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(event) => {
            const file = Array.from(event.dataTransfer.files).find(
              (candidate) =>
                candidate.type.startsWith('image/') ||
                /\.(?:png|jpe?g)$/i.test(candidate.name),
            )
            if (!file) return
            event.preventDefault()
            event.stopPropagation()
            data.onLoadImage?.(file)
          }}
        >
          <WorkflowNodePreview
            emptyText="Drop an image or browse"
            nodeId={data.node.id}
          />
          <div className="load-image-source-footer">
            <span>
              {Number(data.node.parameters?.width ?? 0) > 0 &&
              Number(data.node.parameters?.height ?? 0) > 0
                ? `${String(data.node.parameters?.width)} × ${String(data.node.parameters?.height)}`
                : 'No image selected'}
            </span>
            <button
              className="load-image-browse nodrag"
              onClick={() => imageInputRef.current?.click()}
              type="button"
            >
              <ImagePlus aria-hidden="true" size={13} />
              {data.node.parameters?.assetDigest ? 'Replace' : 'Browse'}
            </button>
            <input
              accept="image/png,image/jpeg,.png,.jpg,.jpeg"
              aria-label={`${data.label} source image`}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) data.onLoadImage?.(file)
                event.target.value = ''
              }}
              ref={imageInputRef}
              tabIndex={-1}
              type="file"
            />
          </div>
        </div>
      ) : null}
      {data.node.type === 'preview' ? (
        <WorkflowNodePreview nodeId={data.node.id} />
      ) : null}
      {data.onRunOutput ? (
        <button
          className="node-run-command nodrag"
          onClick={(event) => {
            event.stopPropagation()
            data.onRunOutput?.()
          }}
          type="button"
        >
          <Play aria-hidden="true" size={13} />
          Run branch
        </button>
      ) : null}
    </div>
  )
}
