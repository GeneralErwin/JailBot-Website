export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
    const [{ NodeSDK }, { OTLPTraceExporter }] = await Promise.all([
      import("@opentelemetry/sdk-node"),
      import("@opentelemetry/exporter-trace-otlp-http")
    ]);
    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT })
    });
    await sdk.start();
  }

  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.05,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        graphQL: { document: false, variables: false },
        genAI: { inputs: false, outputs: false },
        mcp: { inputs: false, outputs: false },
        databaseQueryData: false,
        queues: false,
        stackFrameVariables: false
      }
    });
  }
}
