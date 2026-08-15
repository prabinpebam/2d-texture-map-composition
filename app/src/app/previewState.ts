import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { ImageAssetPreview } from './imageAssets'

export type PreviewState =
  | { status: 'idle' }
  | { status: 'loading'; previous?: ImageAssetPreview }
  | { status: 'ready'; result: ImageAssetPreview }
  | { status: 'error'; message: string; previous?: ImageAssetPreview }

const IDLE_PREVIEW_STATE: PreviewState = { status: 'idle' }

interface PreviewStateRegistry {
  states: Readonly<Record<string, PreviewState>>
  lastReady: Readonly<Record<string, ImageAssetPreview>>
  replace(states: Readonly<Record<string, PreviewState>>): void
  set(nodeId: string, state: PreviewState): void
}

function retainPrevious(
  state: PreviewState,
  lastReady: ImageAssetPreview | undefined,
): PreviewState {
  if (
    (state.status === 'loading' || state.status === 'error') &&
    !state.previous &&
    lastReady
  ) {
    return { ...state, previous: lastReady }
  }
  return state
}

export const previewStateRegistry = createStore<PreviewStateRegistry>(
  (set) => ({
    states: {},
    lastReady: {},
    replace(states) {
      set((current) => ({
        states: Object.fromEntries(
          Object.entries(states).map(([nodeId, state]) => [
            nodeId,
            retainPrevious(state, current.lastReady[nodeId]),
          ]),
        ),
      }))
    },
    set(nodeId, state) {
      set((current) => ({
        states: {
          ...current.states,
          [nodeId]: retainPrevious(state, current.lastReady[nodeId]),
        },
        lastReady:
          state.status === 'ready'
            ? { ...current.lastReady, [nodeId]: state.result }
            : current.lastReady,
      }))
    },
  }),
)

export function getPreviewState(nodeId: string): PreviewState {
  return previewStateRegistry.getState().states[nodeId] ?? IDLE_PREVIEW_STATE
}

export function setPreviewState(nodeId: string, state: PreviewState) {
  previewStateRegistry.getState().set(nodeId, state)
}

export function replacePreviewStates(
  states: Readonly<Record<string, PreviewState>>,
) {
  previewStateRegistry.getState().replace(states)
}

export function usePreviewState(nodeId: string): PreviewState {
  return useStore(
    previewStateRegistry,
    (registry) => registry.states[nodeId] ?? IDLE_PREVIEW_STATE,
  )
}
