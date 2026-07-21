// Structured logging + error capture. Dependency-free: emits single-line JSON
// that any log drain (Vercel, Datadog, Logtail) can parse. `captureError` is the
// single hook to forward to an error tracker (Sentry) once SENTRY_DSN is set —
// wire the forward call here so the rest of the app never imports the SDK.

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, message: string, fields?: Fields) {
  const line = JSON.stringify({ level, message, ts: new Date().toISOString(), ...fields });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const log = {
  debug: (m: string, f?: Fields) => emit("debug", m, f),
  info: (m: string, f?: Fields) => emit("info", m, f),
  warn: (m: string, f?: Fields) => emit("warn", m, f),
  error: (m: string, f?: Fields) => emit("error", m, f),
};

export function captureError(error: unknown, context?: Fields): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  emit("error", message, { ...context, stack });
  forwardToSentry(message, stack, context);
}

/**
 * Dependency-free Sentry forwarder. Activates automatically when SENTRY_DSN is
 * set (Vercel env) — no SDK/package needed. Fire-and-forget; never throws.
 * DSN format: https://<publicKey>@<host>/<projectId>
 */
function forwardToSentry(message: string, stack: string | undefined, context?: Fields): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
    if (!m) return;
    const [, key, host, projectId] = m;
    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      level: "error",
      platform: "node",
      environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? "production",
      message: { formatted: message },
      exception: stack ? { values: [{ type: "Error", value: message, stacktrace: { frames: [] } }] } : undefined,
      extra: { stack, ...context },
    };
    void fetch(`https://${host}/api/${projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=iglamher/1.0, sentry_key=${key}`,
      },
      body: JSON.stringify(event),
    }).catch(() => {});
  } catch {
    // never let error reporting break the request
  }
}

/** Time an async operation and log its latency (API/db performance monitoring). */
export async function timed<T>(name: string, fn: () => Promise<T>, fields?: Fields): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    log.info(`${name}.ok`, { ...fields, durationMs: Date.now() - start });
    return result;
  } catch (error) {
    captureError(error, { op: name, durationMs: Date.now() - start, ...fields });
    throw error;
  }
}
