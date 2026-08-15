import Ajv2020 from 'ajv/dist/2020'
import schemaText from '../../../schemas/graph-workflow-v1.schema.json?raw'
import {
  connectGraph,
  NODE_TYPE_REGISTRY,
  type GraphDocument,
} from '../domain/graph'
import {
  serializeGraphWorkflow,
  type GraphWorkflowV1,
} from './serializeGraphWorkflow'

export { serializeGraphWorkflow }
export type { GraphWorkflowV1 }

export type GraphWorkflowParseResult =
  | { ok: true; workflow: GraphWorkflowV1; document: GraphDocument }
  | { ok: false; error: string }

const ajv = new Ajv2020({ allErrors: true, strict: true })
const validateWorkflow = ajv.compile<GraphWorkflowV1>(JSON.parse(schemaText))

export function parseGraphWorkflow(json: string): GraphWorkflowParseResult {
  let candidate: unknown
  try {
    candidate = JSON.parse(json)
  } catch {
    return { ok: false, error: 'Workflow is not valid JSON' }
  }
  if (!validateWorkflow(candidate)) {
    return {
      ok: false,
      error: ajv.errorsText(validateWorkflow.errors, { separator: '; ' }),
    }
  }

  const nodeIds = new Set<string>()
  for (const node of candidate.nodes) {
    if (nodeIds.has(node.id)) {
      return { ok: false, error: `Duplicate node ID: ${node.id}` }
    }
    if (!NODE_TYPE_REGISTRY[node.type]) {
      return { ok: false, error: `Unknown node type: ${node.type}` }
    }
    nodeIds.add(node.id)
  }

  const edgeIds = new Set<string>()
  let document: GraphDocument = { nodes: candidate.nodes, edges: [] }
  for (const edge of candidate.edges) {
    if (edgeIds.has(edge.id)) {
      return { ok: false, error: `Duplicate edge ID: ${edge.id}` }
    }
    edgeIds.add(edge.id)
    const result = connectGraph(document, edge)
    if (!result.ok) {
      return {
        ok: false,
        error: `Invalid edge ${edge.id}: ${result.diagnostic}`,
      }
    }
    document = result.graph
  }

  return { ok: true, workflow: candidate, document }
}
