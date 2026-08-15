import { Component, type ErrorInfo, type ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TextureFlow render failure', error, errorInfo)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="fatal-error" aria-labelledby="fatal-error-title">
        <span className="fatal-error-code">Application error</span>
        <h1 id="fatal-error-title">The workspace could not be displayed</h1>
        <p>Your local project data has not been changed.</p>
        <button onClick={() => window.location.reload()} type="button">
          Reload workspace
        </button>
      </main>
    )
  }
}
