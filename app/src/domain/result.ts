export type DiagnosticSeverity = 'info' | 'warning' | 'error'

export interface Diagnostic {
  code: string
  message: string
  severity: DiagnosticSeverity
  cause?: unknown
}

export type Result<Value, Failure = Diagnostic> =
  { ok: true; value: Value } | { ok: false; error: Failure }

export function success<Value>(value: Value): Result<Value, never> {
  return { ok: true, value }
}

export function failure<Failure>(error: Failure): Result<never, Failure> {
  return { ok: false, error }
}
