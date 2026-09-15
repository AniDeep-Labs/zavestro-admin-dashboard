import React from 'react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 360, padding: '48px 32px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ marginBottom: 8, fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--color-text-tertiary)', marginBottom: 24, fontSize: '0.875rem', maxWidth: 400 }}>
            {this.state.error?.message ?? 'An unexpected error occurred on this page.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 20px', borderRadius: 6, border: '1px solid var(--color-border)',
              background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', cursor: 'pointer',
              fontSize: '0.875rem', fontFamily: 'inherit',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
