import { fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { NodeWidgetFields } from '../components/NodeWidgetFields'
import { createGraphNode } from './graph'
import {
  createNodeWidgetPatch,
  getDefaultNodeParameters,
  getNodeWidgetInputSchema,
  getNodeWidgetSchema,
  parameterPortId,
} from './nodeWidgetSchema'

function ParityHarness() {
  const [node, setNode] = useState(() =>
    createGraphNode('resize', 'resize-a', { x: 0, y: 0 }, 0),
  )
  const update = (patch: Record<string, unknown>) =>
    setNode((current) => ({
      ...current,
      parameters: { ...current.parameters, ...patch },
    }))
  return (
    <ReactFlowProvider>
      <NodeWidgetFields host="node" node={node} onChange={update} />
      <NodeWidgetFields host="inspector" node={node} onChange={update} />
    </ReactFlowProvider>
  )
}

describe('node widget schema', () => {
  it('provides the defaults used by canonical node creation', () => {
    for (const type of [
      'load-image',
      'resize',
      'brightness-correction',
      'color-correction',
    ]) {
      const node = createGraphNode(type, type, { x: 0, y: 0 }, 0)
      expect(node.parameters).toMatchObject(getDefaultNodeParameters(type))
      expect(getNodeWidgetSchema(type).length).toBeGreaterThan(0)
    }
  })

  it('declares one typed parameter socket for every editable widget', () => {
    for (const type of [
      'load-image',
      'resize',
      'brightness-correction',
      'color-correction',
    ]) {
      const editableFields = getNodeWidgetSchema(type).filter(
        (field) => field.kind !== 'readonly',
      )
      const inputs = getNodeWidgetInputSchema(type)
      expect(inputs).toHaveLength(editableFields.length)
      expect(inputs.map((field) => parameterPortId(field.key))).toEqual(
        editableFields.map((field) => `parameter:${field.key}`),
      )
    }
  })

  it('applies special resize preset and method patches centrally', () => {
    expect(createNodeWidgetPatch('resize', 'preset', 'sharp')).toEqual({
      preset: 'sharp',
      resolvedKernel: 'lanczos3.v1',
    })
    expect(
      createNodeWidgetPatch('resize', 'resolvedKernel', 'nearest.v1'),
    ).toEqual({ preset: 'custom', resolvedKernel: 'nearest.v1' })
  })

  it('keeps node and inspector hosts on one authored field', () => {
    render(<ParityHarness />)
    const widthInputs = screen.getAllByLabelText('Resize Width')
    expect(widthInputs).toHaveLength(2)
    fireEvent.change(widthInputs[0], { target: { value: '512' } })
    expect(widthInputs[0]).toHaveValue(512)
    expect(widthInputs[1]).toHaveValue(512)
  })

  it('keeps a driven field fallback visible while disabling manual editing', () => {
    const node = createGraphNode('resize', 'resize', { x: 0, y: 0 }, 0)
    render(
      <ReactFlowProvider>
        <NodeWidgetFields
          drivenKeys={new Set(['width'])}
          host="node"
          node={node}
          onChange={() => undefined}
        />
      </ReactFlowProvider>,
    )
    expect(screen.getByLabelText('Width parameter input')).toBeInTheDocument()
    expect(screen.getByLabelText('Resize Width')).toBeDisabled()
    expect(screen.getByLabelText('Resize Width')).toHaveValue(1024)
    expect(screen.getByText('Driven')).toBeInTheDocument()
  })
})
