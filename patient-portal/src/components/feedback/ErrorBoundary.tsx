import { Component, ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isDev } from "@/config/env";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isDev) {
      console.error("[ErrorBoundary]", error, info);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <div className="max-w-md w-full rounded-2xl bg-card shadow-card border border-border p-8 text-center">
          <div className="size-12 rounded-full bg-danger/10 text-danger grid place-items-center mx-auto mb-4">
            <AlertOctagon className="size-6" />
          </div>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-6">
            We hit an unexpected error. Try refreshing — if it persists, contact support.
          </p>
          {isDev && (
            <pre className="text-left text-[11px] bg-surface-subtle border border-border rounded-lg p-3 mb-4 overflow-auto max-h-48 text-danger">
              {error.message}
              {"\n"}
              {error.stack}
            </pre>
          )}
          <Button onClick={this.reset}>
            <RotateCw className="size-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }
}
