import type { Locator } from '@playwright/test'

export interface CapturedRect {
  x: number
  y: number
  width: number
  height: number
  top: number
  right: number
  bottom: number
  left: number
}

export interface CapturedNodeElement {
  tag: string
  classes: string
  role: string | null
  ariaLabel: string | null
  text: string
  rect: CapturedRect
  previewRect: CapturedRect | null
  display: string
  visibility: string
  opacity: string
  overflowX: string
  overflowY: string
  clientWidth: number
  clientHeight: number
  scrollWidth: number
  scrollHeight: number
  hitAtCenter: boolean | null
}

export interface NodeLayoutCapture {
  owner: CapturedRect
  surface: {
    rect: CapturedRect
    overflowX: string
    overflowY: string
    borderRadius: string
  }
  elements: CapturedNodeElement[]
}

export async function captureNodeLayout(
  node: Locator,
): Promise<NodeLayoutCapture> {
  return node.evaluate((wrapper) => {
    const owner = wrapper.querySelector<HTMLElement>('.workflow-node')
    if (!owner) throw new Error('Workflow node body is missing')
    const surface = owner.querySelector<HTMLElement>('.workflow-node-surface')
    if (!surface) throw new Error('Workflow node surface is missing')
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = document.documentElement.clientHeight
    const toRect = (rect: DOMRect) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    })
    const elements = Array.from(owner.querySelectorAll<HTMLElement>('*')).map(
      (element) => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        const preview = element.closest<HTMLElement>('.workflow-node-preview')
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const centerInViewport =
          centerX >= 0 &&
          centerY >= 0 &&
          centerX <= viewportWidth &&
          centerY <= viewportHeight
        const hit =
          centerInViewport && rect.width > 0 && rect.height > 0
            ? document.elementFromPoint(centerX, centerY)
            : null
        return {
          tag: element.tagName.toLowerCase(),
          classes:
            typeof element.className === 'string' ? element.className : '',
          role: element.getAttribute('role'),
          ariaLabel: element.getAttribute('aria-label'),
          text: (element.textContent ?? '').trim().slice(0, 120),
          rect: toRect(rect),
          previewRect: preview ? toRect(preview.getBoundingClientRect()) : null,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          clientWidth: element.clientWidth,
          clientHeight: element.clientHeight,
          scrollWidth: element.scrollWidth,
          scrollHeight: element.scrollHeight,
          hitAtCenter: hit ? hit === element || element.contains(hit) : null,
        }
      },
    )
    const surfaceStyle = getComputedStyle(surface)
    return {
      owner: toRect(owner.getBoundingClientRect()),
      surface: {
        rect: toRect(surface.getBoundingClientRect()),
        overflowX: surfaceStyle.overflowX,
        overflowY: surfaceStyle.overflowY,
        borderRadius: surfaceStyle.borderRadius,
      },
      elements,
    }
  })
}

export function detectNodeLayoutIssues(capture: NodeLayoutCapture): string[] {
  const tolerance = 1
  const issues: string[] = []
  if (
    Math.abs(capture.surface.rect.left - capture.owner.left) > tolerance ||
    Math.abs(capture.surface.rect.right - capture.owner.right) > tolerance ||
    Math.abs(capture.surface.rect.top - capture.owner.top) > tolerance ||
    Math.abs(capture.surface.rect.bottom - capture.owner.bottom) > tolerance
  ) {
    issues.push('rounded surface does not cover node owner')
  }
  if (
    capture.surface.overflowX !== 'hidden' ||
    capture.surface.overflowY !== 'hidden'
  ) {
    issues.push(
      `rounded surface overflow is ${capture.surface.overflowX}/${capture.surface.overflowY}`,
    )
  }
  if (capture.surface.borderRadius === '0px') {
    issues.push('rounded surface has no border radius')
  }
  for (const element of capture.elements) {
    const visible =
      element.display !== 'none' &&
      element.visibility !== 'hidden' &&
      element.opacity !== '0' &&
      element.rect.width > 0 &&
      element.rect.height > 0
    if (!visible) continue
    const allowedOutside =
      /(?:react-flow__handle|react-flow__resize-control|sr-only)/.test(
        element.classes,
      )
    if (
      !allowedOutside &&
      (element.rect.left < capture.owner.left - tolerance ||
        element.rect.right > capture.owner.right + tolerance ||
        element.rect.top < capture.owner.top - tolerance ||
        element.rect.bottom > capture.owner.bottom + tolerance)
    ) {
      issues.push(
        `outside owner: ${element.tag}.${element.classes} ${JSON.stringify(element.rect)}`,
      )
    }
    if (
      element.previewRect &&
      (element.rect.left < element.previewRect.left - tolerance ||
        element.rect.right > element.previewRect.right + tolerance ||
        element.rect.top < element.previewRect.top - tolerance ||
        element.rect.bottom > element.previewRect.bottom + tolerance)
    ) {
      issues.push(
        `outside preview: ${element.tag}.${element.classes} ${JSON.stringify(element.rect)}`,
      )
    }
    if (
      /(?:workflow-node-preview|load-image-source)/.test(element.classes) &&
      (element.scrollWidth > element.clientWidth + tolerance ||
        element.scrollHeight > element.clientHeight + tolerance)
    ) {
      issues.push(
        `scroll overflow: ${element.classes} ${element.scrollWidth}x${element.scrollHeight} > ${element.clientWidth}x${element.clientHeight}`,
      )
    }
    const interactive =
      element.tag === 'button' ||
      element.tag === 'input' ||
      element.tag === 'select' ||
      element.role === 'button'
    if (interactive && element.hitAtCenter === false) {
      issues.push(
        `not hit-testable: ${element.tag}.${element.classes} ${element.ariaLabel ?? element.text}`,
      )
    }
  }
  return issues
}
