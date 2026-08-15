import { sniffImageFile, type SniffedImage } from '../processing/imageSniffer'
import { getImagePreviewClient } from '../workers/imagePreviewClient'
import type { PreviewMaskSource } from '../workers/imagePreviewProtocol'
import type { PreviewOperation } from '../workers/imagePreviewProtocol'
import { getPersistenceClient } from '../workers/persistenceClient'

export type { PreviewOperation }

export interface ImportedImageAsset {
  digest: string
  fileName: string
  sniffed: SniffedImage
}

export interface ImageAssetPreview {
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  pixels: ArrayBuffer
  sample: readonly [number, number, number, number]
  generation: number
  cacheHit: boolean
}

export async function importImageAsset(
  projectId: string,
  file: File,
): Promise<ImportedImageAsset> {
  const sniffed = await sniffImageFile(file)
  if (file.type && file.type !== sniffed.mediaType) {
    throw new Error(`File type does not match ${sniffed.mediaType} signature`)
  }
  const persistenceClient = getPersistenceClient()
  const digest = await persistenceClient.putAsset(
    projectId,
    file,
    file.name,
    'source',
  )
  return { digest, fileName: file.name, sniffed }
}

export async function renderImageAssetPreview(
  projectId: string,
  nodeId: string,
  digest: string,
  settings: {
    mode: 'color' | 'mask'
    maskSource: PreviewMaskSource
    invert: boolean
    operations?: readonly PreviewOperation[]
  },
): Promise<ImageAssetPreview> {
  const persistenceClient = getPersistenceClient()
  const asset = await persistenceClient.getAsset(projectId, digest)
  if (!asset) throw new Error('Source image asset is missing')
  return getImagePreviewClient().render(nodeId, asset.blob, {
    ...settings,
    operations: settings.operations ?? [],
    cacheKey: [
      digest,
      settings.mode,
      settings.maskSource,
      settings.invert ? 'invert' : 'normal',
      JSON.stringify(settings.operations ?? []),
    ].join(':'),
  })
}
