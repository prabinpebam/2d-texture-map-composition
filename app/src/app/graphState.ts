import { useStore } from 'zustand'
import { createGraphStore } from '../domain/graphStore'

export const graphStore = createGraphStore()

export function useGraphStore<T>(
  selector: (state: ReturnType<typeof graphStore.getState>) => T,
): T {
  return useStore(graphStore, selector)
}
