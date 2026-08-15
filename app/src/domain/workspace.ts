export type NodeCategory = 'input' | 'compose' | 'adjust' | 'analyze' | 'output'

export interface NodeCatalogItem {
  id: string
  label: string
  category: NodeCategory
  summary: string
}

export const NODE_CATALOG: readonly NodeCatalogItem[] = [
  {
    id: 'integer-value',
    label: 'Integer',
    category: 'input',
    summary: 'Whole-number value for parameter inputs',
  },
  {
    id: 'number-value',
    label: 'Number',
    category: 'input',
    summary: 'Floating-point value for parameter inputs',
  },
  {
    id: 'text-value',
    label: 'Text',
    category: 'input',
    summary: 'Text or enum value for parameter inputs',
  },
  {
    id: 'boolean-value',
    label: 'Boolean',
    category: 'input',
    summary: 'True or false value for parameter inputs',
  },
  {
    id: 'color-value',
    label: 'Color',
    category: 'input',
    summary: 'Color value for parameter inputs',
  },
  {
    id: 'load-image',
    label: 'Load image',
    category: 'input',
    summary: 'Color image or channel-derived mask',
  },
  {
    id: 'material',
    label: 'Material',
    category: 'compose',
    summary: 'Base color, relief, opacity, and lights',
  },
  {
    id: 'merge',
    label: 'Merge',
    category: 'compose',
    summary: 'Two-image blending and modifiers',
  },
  {
    id: 'resize',
    label: 'Resize',
    category: 'adjust',
    summary: 'Versioned resampling methods',
  },
  {
    id: 'color-correction',
    label: 'Color correction',
    category: 'adjust',
    summary: 'Hue, saturation, tint, and temperature',
  },
  {
    id: 'brightness-correction',
    label: 'Brightness',
    category: 'adjust',
    summary: 'Exposure and tonal ranges',
  },
  {
    id: 'light',
    label: 'Light',
    category: 'input',
    summary: 'Parallel direction, intensity, and tint',
  },
  {
    id: 'representative-color',
    label: 'Single color',
    category: 'analyze',
    summary: 'Representative color and target delta',
  },
  {
    id: 'preview',
    label: 'Image preview',
    category: 'output',
    summary: 'Inspect and export a raster result',
  },
] as const

export type ThemePreference = 'system' | 'light' | 'dark'

export function nextTheme(theme: ThemePreference): ThemePreference {
  if (theme === 'system') return 'light'
  if (theme === 'light') return 'dark'
  return 'system'
}
