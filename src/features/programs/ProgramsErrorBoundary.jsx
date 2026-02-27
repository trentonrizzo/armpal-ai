import React from "react";

export default class ProgramsErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ProgramsErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.wrap}>
          <h2 style={styles.title}>Something went wrong</h2>
          <p style={styles.msg}>The Programs section hit an error. Please go back and try again.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={styles.retry}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.href = "/"}
            style={styles.back}
          >
            Back to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles = {
  wrap: {
    padding: "24px 16px 90px",
    maxWidth: 480,
    margin: "0 auto",
    textAlign: "center",
  },
  title: { fontSize: 18, fontWeight: 800, color: "var(--text)", margin: "0 0 12px" },
  msg: { fontSize: 14, color: "var(--text-dim)", margin: "0 0 20px" },
  retry: {
    display: "block",
    width: "100%",
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  back: {
    display: "block",
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 14,
    cursor: "pointer",
  },
};
