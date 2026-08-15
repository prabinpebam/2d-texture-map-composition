import type { GraphDocument } from '../domain/graph'

export interface GraphWorkflowV1 {
  format: 'textureflow-workflow'
  formatVersion: '1.0.0'
  project: {
    id: string
    name: string
    viewport: { x: number; y: number; zoom: number }
  }
  nodes: GraphDocument['nodes']
  edges: GraphDocument['edges']
}

export function serializeGraphWorkflow(
  document: GraphDocument,
  project: GraphWorkflowV1['project'],
): string {
  const workflow: GraphWorkflowV1 = {
    format: 'textureflow-workflow',
    formatVersion: '1.0.0',
    project,
    nodes: document.nodes,
    edges: document.edges,
  }
  return JSON.stringify(workflow)
}
