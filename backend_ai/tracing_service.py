import os
try:
    from phoenix.otel import register
    HAS_PHOENIX = True
except ImportError:
    HAS_PHOENIX = False

try:
    from openinference.instrumentation.langgraph import LangGraphInstrumentor
    HAS_LANGGRAPH_INSTRUMENTOR = True
except ImportError:
    print("[TRACING WARNING] LangGraph Instrumentor not found. Basic tracing will still work.")
    HAS_LANGGRAPH_INSTRUMENTOR = False

def init_tracing():
    """Initializes Arize Phoenix tracing for LangGraph."""
    use_phoenix = os.getenv("USE_PHOENIX", "false").lower() == "true"
    
    if not use_phoenix:
        print("[TRACING] Standby (USE_PHOENIX=false).")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        phoenix_host = os.getenv("PHOENIX_HOST", "phoenix")
        phoenix_port = os.getenv("PHOENIX_PORT", "6006")
        endpoint = f"http://{phoenix_host}:4317" # OTLP gRPC endpoint

        print(f"[TRACING] Initializing Arize Phoenix at {endpoint}...")
        
        # 1. Register with Phoenix (Collector)
        register(
            project_name="linkedin-neural-scout",
            endpoint=f"http://{phoenix_host}:6006/v1/traces"
        )

        # 2. Instrument LangGraph if available
        if HAS_LANGGRAPH_INSTRUMENTOR:
            if not LangGraphInstrumentor().is_instrumented_by_runtime:
                LangGraphInstrumentor().instrument()
                print("[TRACING] LangGraph Instrumented ✅")
        else:
            print("[TRACING] LangGraph specific instrumentation skipped (module missing).")

    except Exception as e:
        print(f"[TRACING WARNING] Failed to init Phoenix: {e}")

# Auto-init on import if needed, or call manually in main.py
if __name__ == "__main__":
    init_tracing()
