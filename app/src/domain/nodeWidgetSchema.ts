export type NodeWidgetKind =
  'readonly' | 'number' | 'select' | 'checkbox' | 'color'

export interface NodeWidgetOption {
  value: string
  label: string
}

export interface NodeWidgetDefinition {
  key: string
  label: string
  kind: NodeWidgetKind
  defaultValue: unknown
  unit?: string
  minimum?: number
  maximum?: number
  step?: number
  options?: readonly NodeWidgetOption[]
  compact: boolean
  inspector: boolean
  visibleWhen?: { key: string; equals: unknown }
}

const MASK_OPTIONS: readonly NodeWidgetOption[] = [
  { value: 'luminosity', label: 'Luminosity' },
  { value: 'alpha', label: 'Alpha' },
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
]

export const NODE_WIDGET_SCHEMAS: Readonly<
  Record<string, readonly NodeWidgetDefinition[]>
> = {
  'load-image': [
    {
      key: 'fileName',
      label: 'Source',
      kind: 'readonly',
      defaultValue: null,
      compact: true,
      inspector: true,
    },
    {
      key: 'mode',
      label: 'Output',
      kind: 'select',
      defaultValue: 'color',
      options: [
        { value: 'color', label: 'Color image' },
        { value: 'mask', label: 'Mask' },
      ],
      compact: true,
      inspector: true,
    },
    {
      key: 'maskSource',
      label: 'Mask source',
      kind: 'select',
      defaultValue: 'luminosity',
      options: MASK_OPTIONS,
      compact: true,
      inspector: true,
      visibleWhen: { key: 'mode', equals: 'mask' },
    },
    {
      key: 'invert',
      label: 'Invert mask',
      kind: 'checkbox',
      defaultValue: false,
      compact: true,
      inspector: true,
      visibleWhen: { key: 'mode', equals: 'mask' },
    },
  ],
  resize: [
    {
      key: 'width',
      label: 'Width',
      kind: 'number',
      defaultValue: 1024,
      unit: 'px',
      minimum: 1,
      maximum: 32768,
      step: 1,
      compact: true,
      inspector: true,
    },
    {
      key: 'height',
      label: 'Height',
      kind: 'number',
      defaultValue: 1024,
      unit: 'px',
      minimum: 1,
      maximum: 32768,
      step: 1,
      compact: true,
      inspector: true,
    },
    {
      key: 'aspectLocked',
      label: 'Lock ratio',
      kind: 'checkbox',
      defaultValue: true,
      compact: true,
      inspector: true,
    },
    {
      key: 'preset',
      label: 'Preset',
      kind: 'select',
      defaultValue: 'auto',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'pixel-art', label: 'Pixel art' },
        { value: 'smooth', label: 'Smooth' },
        { value: 'sharp', label: 'Sharp' },
        { value: 'custom', label: 'Custom' },
      ],
      compact: true,
      inspector: true,
    },
    {
      key: 'resolvedKernel',
      label: 'Method',
      kind: 'select',
      defaultValue: 'mitchell.v1',
      options: [
        'nearest.v1',
        'box-area.v1',
        'triangle.v1',
        'hermite.v1',
        'bspline.v1',
        'catmull-rom.v1',
        'mitchell.v1',
        'gaussian.v1',
        'lanczos2.v1',
        'lanczos3.v1',
        'lanczos4.v1',
      ].map((value) => ({ value, label: value })),
      compact: true,
      inspector: true,
    },
  ],
  'brightness-correction': [
    ...[
      ['exposure', 'Exposure', 'EV', -8, 8, 0.1],
      ['highlights', 'Highlights', '', -1, 1, 0.05],
      ['shadows', 'Shadows', '', -1, 1, 0.05],
      ['whites', 'Whites', '', -1, 1, 0.05],
      ['blacks', 'Blacks', '', -1, 1, 0.05],
    ].map(([key, label, unit, minimum, maximum, step]) => ({
      key: String(key),
      label: String(label),
      kind: 'number' as const,
      defaultValue: 0,
      unit: String(unit),
      minimum: Number(minimum),
      maximum: Number(maximum),
      step: Number(step),
      compact: true,
      inspector: true,
    })),
  ],
  'color-correction': [
    ...[
      ['temperature', 'Temperature', '', -1, 1, 0.05],
      ['greenMagenta', 'Green / magenta', '', -1, 1, 0.05],
      ['hueDegrees', 'Hue', 'deg', -360, 360, 1],
      ['saturation', 'Saturation', '', -1, 1, 0.05],
      ['tintMix', 'Tint mix', '', 0, 1, 0.05],
    ].map(([key, label, unit, minimum, maximum, step]) => ({
      key: String(key),
      label: String(label),
      kind: 'number' as const,
      defaultValue: 0,
      unit: String(unit),
      minimum: Number(minimum),
      maximum: Number(maximum),
      step: Number(step),
      compact: true,
      inspector: true,
    })),
    {
      key: 'tintHex',
      label: 'Tint color',
      kind: 'color',
      defaultValue: '#ffffff',
      compact: true,
      inspector: true,
    },
  ],
  preview: [],
}

export function getNodeWidgetSchema(type: string) {
  return NODE_WIDGET_SCHEMAS[type] ?? []
}

export function getDefaultNodeParameters(
  type: string,
): Record<string, unknown> {
  return Object.fromEntries(
    getNodeWidgetSchema(type).map((field) => [field.key, field.defaultValue]),
  )
}

export function isNodeWidgetVisible(
  field: NodeWidgetDefinition,
  parameters: Record<string, unknown>,
) {
  return (
    !field.visibleWhen ||
    parameters[field.visibleWhen.key] === field.visibleWhen.equals
  )
}

export function createNodeWidgetPatch(
  type: string,
  key: string,
  value: unknown,
): Record<string, unknown> {
  if (type === 'resize' && key === 'preset') {
    const resolvedKernel =
      value === 'pixel-art'
        ? 'nearest.v1'
        : value === 'sharp'
          ? 'lanczos3.v1'
          : 'mitchell.v1'
    return { preset: value, resolvedKernel }
  }
  if (type === 'resize' && key === 'resolvedKernel') {
    return { preset: 'custom', resolvedKernel: value }
  }
  return { [key]: value }
}

export function getNodeWidgetResetPatch(type: string) {
  return getDefaultNodeParameters(type)
}
