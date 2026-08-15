import { useEffect, useRef } from 'react'

interface PaintableImagePreview {
  width: number
  height: number
  pixels: ArrayBuffer
  sample: readonly [number, number, number, number]
  cacheHit: boolean
  generation: number
}

interface ImagePreviewCanvasProps {
  result: PaintableImagePreview
}

export function ImagePreviewCanvas({ result }: ImagePreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    canvas.width = result.width
    canvas.height = result.height
    const pixels = new Uint8ClampedArray(result.pixels.slice(0))
    context.putImageData(
      new ImageData(pixels, result.width, result.height),
      0,
      0,
    )
  }, [result])

  return (
    <canvas
      aria-label={`Image preview, ${result.width} by ${result.height} pixels`}
      className="image-preview-canvas"
      data-cache-hit={String(result.cacheHit)}
      data-generation={String(result.generation)}
      data-pixel-sample={result.sample.join(',')}
      ref={canvasRef}
      role="img"
    />
  )
}
