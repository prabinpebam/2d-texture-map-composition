import { expect, test as base } from '@playwright/test'

interface E2eFixtures {
  browserErrorBoundary: void
}

export const test = base.extend<E2eFixtures>({
  browserErrorBoundary: [
    async ({ context }, use) => {
      await context.addInitScript(() => {
        window.addEventListener(
          'error',
          (event) => {
            if (
              event.message ===
              'ResizeObserver loop completed with undelivered notifications.'
            ) {
              event.preventDefault()
              event.stopImmediatePropagation()
            }
          },
          true,
        )
      })
      await use()
    },
    { auto: true },
  ],
})

export { expect }
export type { Locator, Page } from '@playwright/test'
