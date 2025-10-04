var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/core/tracker.ts
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
var MCPTracker = class {
  tracer;
  config;
  hooks = [];
  telemetryEvents = [];
  activeSpans = /* @__PURE__ */ new Map();
  startTime = Date.now();
  constructor(config = {}) {
    this.config = {
      serviceName: "mcp-server",
      serviceVersion: "1.0.0",
      tracingEnabled: true,
      metricsEnabled: false,
      samplingRate: 1,
      requestTimeout: 3e4,
      maxAttributes: 128,
      maxEvents: 128,
      consoleExport: false,
      ...config
    };
    this.initializeTracer();
  }
  /**
   * Initialize the OpenTelemetry tracer
   */
  initializeTracer() {
    const resource = Resource.default().merge(new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName || "mcp-server",
      [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion || "1.0.0",
      [SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE]: "nodejs",
      [SemanticResourceAttributes.TELEMETRY_SDK_NAME]: "opentelemetry"
    }));
    this.tracer = trace.getTracer("neonflare-mcp", this.config.serviceVersion);
  }
  /**
   * Create a new operation context for tracking
   */
  createOperationContext(method, requestId, params) {
    return {
      operationId: this.generateOperationId(),
      startTime: Date.now(),
      metadata: {
        method,
        requestId,
        params
      }
    };
  }
  /**
   * Start a new span for an MCP operation
   */
  startMCPSpan(method, context) {
    const span = this.tracer.startSpan(`mcp.${method}`, {
      kind: 1,
      // SERVER kind
      attributes: {
        "mcp.operation_id": context.operationId,
        "mcp.method": method,
        "mcp.start_time": context.startTime,
        ...this.config.projectId ? { "neonflare.project_id": this.config.projectId } : {},
        ...this.config.defaultAttributes,
        ...context.metadata?.requestId ? { "mcp.request_id": context.metadata.requestId } : {},
        ...context.metadata?.aiContext ? { "mcp.tool.ai_context": context.metadata.aiContext } : {}
      }
    });
    this.activeSpans.set(context.operationId, span);
    this.addTelemetryEvent({
      type: "request_start" /* REQUEST_START */,
      timestamp: Date.now(),
      data: {
        operationId: context.operationId,
        method,
        metadata: context.metadata,
        projectId: this.config.projectId
      },
      spanContext: {
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId
      }
    });
    return span;
  }
  /**
   * End a span with result information
   */
  endMCPSpan(operationId, result) {
    const span = this.activeSpans.get(operationId);
    if (!span) return;
    const attributes = {
      "mcp.method": this.extractMethodFromOperationId(operationId),
      "mcp.success": result.success,
      "mcp.duration_ms": result.duration
    };
    if (!result.success && result.error) {
      attributes["mcp.error_code"] = result.error.code;
      attributes["mcp.error_message"] = result.error.message;
      span.setStatus({ code: SpanStatusCode.ERROR, message: result.error.message });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }
    this.addMethodSpecificAttributes(attributes, operationId, result);
    span.setAttributes(attributes);
    span.end();
    this.activeSpans.delete(operationId);
    this.addTelemetryEvent({
      type: "request_end" /* REQUEST_END */,
      timestamp: result.timestamp,
      data: {
        operationId,
        success: result.success,
        duration: result.duration,
        error: result.error
      },
      spanContext: {
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId
      }
    });
  }
  /**
   * Add method-specific attributes to span
   */
  addMethodSpecificAttributes(attributes, operationId, result) {
    const method = this.extractMethodFromOperationId(operationId);
    switch (method) {
      case "tools/list":
        if (result.data?.tools) {
          attributes["mcp.tools_count"] = Array.isArray(result.data.tools) ? result.data.tools.length : 0;
        }
        break;
      case "resources/list":
        if (result.data?.resources) {
          attributes["mcp.resources_count"] = Array.isArray(result.data.resources) ? result.data.resources.length : 0;
        }
        break;
      case "prompts/list":
        if (result.data?.prompts) {
          attributes["mcp.prompts_count"] = Array.isArray(result.data.prompts) ? result.data.prompts.length : 0;
        }
        break;
      case "tools/call":
        if (result.data?.tool) {
          attributes["mcp.tool_name"] = result.data.tool;
        }
        break;
      case "resources/read":
        if (result.data?.uri) {
          attributes["mcp.resource_uri"] = result.data.uri;
        }
        break;
      case "prompts/get":
        if (result.data?.name) {
          attributes["mcp.prompt_name"] = result.data.name;
        }
        break;
    }
  }
  /**
   * Execute before-method hooks
   */
  async executeBeforeHooks(context, methodCall) {
    for (const hook of this.hooks) {
      if (hook.beforeMethod) {
        try {
          await hook.beforeMethod(context, methodCall);
        } catch (error) {
          console.warn("Error in beforeMethod hook:", error);
        }
      }
    }
  }
  /**
   * Execute after-method hooks
   */
  async executeAfterHooks(context, result) {
    for (const hook of this.hooks) {
      if (hook.afterMethod) {
        try {
          await hook.afterMethod(context, result);
        } catch (error) {
          console.warn("Error in afterMethod hook:", error);
        }
      }
    }
  }
  /**
   * Execute error hooks
   */
  async executeErrorHooks(context, error) {
    for (const hook of this.hooks) {
      if (hook.onError) {
        try {
          await hook.onError(context, error);
        } catch (hookError) {
          console.warn("Error in onError hook:", hookError);
        }
      }
    }
  }
  /**
   * Add a telemetry event
   */
  addTelemetryEvent(event) {
    this.telemetryEvents.push(event);
    const maxEvents = 1e3;
    if (this.telemetryEvents.length > maxEvents) {
      this.telemetryEvents = this.telemetryEvents.slice(-maxEvents);
    }
  }
  /**
   * Extract method from operation ID
   */
  extractMethodFromOperationId(operationId) {
    return "unknown";
  }
  /**
   * Generate a unique operation ID
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  /**
   * Get current metrics
   */
  getCurrentMetrics() {
    return {
      totalRequests: this.telemetryEvents.filter((e) => e.type === "request_end" /* REQUEST_END */).length,
      successfulRequests: this.telemetryEvents.filter(
        (e) => e.type === "request_end" /* REQUEST_END */ && e.data.success
      ).length,
      failedRequests: this.telemetryEvents.filter(
        (e) => e.type === "request_end" /* REQUEST_END */ && !e.data.success
      ).length,
      averageDuration: this.calculateAverageDuration(),
      requestsPerSecond: this.calculateRequestsPerSecond(),
      activeSessions: this.activeSpans.size,
      methodMetrics: {}
    };
  }
  /**
   * Calculate average request duration
   */
  calculateAverageDuration() {
    const completedRequests = this.telemetryEvents.filter(
      (e) => e.type === "request_end" /* REQUEST_END */ && e.data.duration
    );
    if (completedRequests.length === 0) return 0;
    const totalDuration = completedRequests.reduce((sum, event) => sum + (event.data.duration || 0), 0);
    return totalDuration / completedRequests.length;
  }
  /**
   * Calculate current requests per second
   */
  calculateRequestsPerSecond() {
    const recentEvents = this.telemetryEvents.filter(
      (e) => e.type === "request_end" /* REQUEST_END */ && Date.now() - e.timestamp < 6e4
      // Last minute
    );
    return recentEvents.length / 60;
  }
  /**
   * Add an instrumentation hook
   */
  addHook(hook) {
    this.hooks.push(hook);
  }
  /**
   * Remove an instrumentation hook
   */
  removeHook(hook) {
    const index = this.hooks.indexOf(hook);
    if (index > -1) {
      this.hooks.splice(index, 1);
    }
  }
  /**
   * Get current telemetry events
   */
  getTelemetryEvents() {
    return [...this.telemetryEvents];
  }
  /**
   * Get active span count
   */
  getActiveSpanCount() {
    return this.activeSpans.size;
  }
  /**
   * Shutdown the tracker and cleanup resources
   */
  async shutdown() {
    for (const [operationId, span] of this.activeSpans) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: "Tracker shutdown" });
      span.end();
    }
    this.activeSpans.clear();
    this.telemetryEvents.length = 0;
  }
  /**
   * Get the tracer instance for custom instrumentation
   */
  getTracer() {
    return this.tracer;
  }
  /**
   * Get the configuration
   */
  getConfig() {
    return { ...this.config };
  }
};

// src/instrumentation/index.ts
var MCPInstrumentation = class {
  tracker;
  methodContexts = /* @__PURE__ */ new Map();
  constructor(tracker) {
    this.tracker = tracker;
  }
  /**
   * Instrument a tools/list method call
   */
  async instrumentToolsList(handler, requestId) {
    return this.instrumentMethod(
      "tools/list" /* TOOLS_LIST */,
      handler,
      requestId
    );
  }
  /**
   * Instrument a tools/call method call
   */
  async instrumentToolsCall(handler, toolName, args, requestId) {
    return this.instrumentMethod(
      "tools/call" /* TOOLS_CALL */,
      () => handler(toolName, args),
      requestId,
      { toolName, args }
    );
  }
  /**
   * Instrument a resources/list method call
   */
  async instrumentResourcesList(handler, requestId) {
    return this.instrumentMethod(
      "resources/list" /* RESOURCES_LIST */,
      handler,
      requestId
    );
  }
  /**
   * Instrument a resources/read method call
   */
  async instrumentResourcesRead(handler, uri, requestId) {
    return this.instrumentMethod(
      "resources/read" /* RESOURCES_READ */,
      () => handler(uri),
      requestId,
      { uri }
    );
  }
  /**
   * Instrument a prompts/list method call
   */
  async instrumentPromptsList(handler, requestId) {
    return this.instrumentMethod(
      "prompts/list" /* PROMPTS_LIST */,
      handler,
      requestId
    );
  }
  /**
   * Instrument a prompts/get method call
   */
  async instrumentPromptsGet(handler, promptName, args, requestId) {
    return this.instrumentMethod(
      "prompts/get" /* PROMPTS_GET */,
      () => handler(promptName, args),
      requestId,
      { promptName, args }
    );
  }
  /**
   * Instrument a ping method call
   */
  async instrumentPing(handler, requestId) {
    return this.instrumentMethod(
      "ping" /* PING */,
      handler,
      requestId
    );
  }
  /**
   * Generic method instrumentation
   */
  async instrumentMethod(methodType, handler, requestId, methodParams) {
    const context = this.tracker.createOperationContext(
      methodType,
      requestId,
      methodParams
    );
    this.methodContexts.set(context.operationId, context);
    const span = this.tracker.startMCPSpan(methodType, context);
    const methodCall = {
      method: methodType,
      params: methodParams,
      timestamp: Date.now()
    };
    try {
      await this.tracker.executeBeforeHooks(context, methodCall);
      const result = await handler();
      const methodResult = {
        success: true,
        data: result,
        duration: Date.now() - context.startTime,
        timestamp: Date.now()
      };
      this.tracker.endMCPSpan(context.operationId, methodResult);
      await this.tracker.executeAfterHooks(context, methodResult);
      return result;
    } catch (error) {
      const methodResult = {
        success: false,
        error: {
          code: error?.code || "METHOD_ERROR",
          message: error?.message || "Method execution failed",
          details: error
        },
        duration: Date.now() - context.startTime,
        timestamp: Date.now()
      };
      this.tracker.endMCPSpan(context.operationId, methodResult);
      await this.tracker.executeErrorHooks(context, error);
      throw error;
    } finally {
      this.methodContexts.delete(context.operationId);
    }
  }
  /**
   * Add an instrumentation hook
   */
  addHook(hook) {
    this.tracker.addHook(hook);
  }
  /**
   * Remove an instrumentation hook
   */
  removeHook(hook) {
    this.tracker.removeHook(hook);
  }
  /**
   * Get current metrics
   */
  getMetrics() {
    return this.tracker.getCurrentMetrics();
  }
  /**
   * Get telemetry events
   */
  getTelemetryEvents() {
    return this.tracker.getTelemetryEvents();
  }
  /**
   * Get active span count
   */
  getActiveSpanCount() {
    return this.tracker.getActiveSpanCount();
  }
  /**
   * Shutdown instrumentation
   */
  async shutdown() {
    await this.tracker.shutdown();
  }
  /**
   * Get the underlying tracker instance
   */
  getTracker() {
    return this.tracker;
  }
};
function createMCPInstrumentation(config) {
  const tracker = new MCPTracker(config);
  return new MCPInstrumentation(tracker);
}

// src/telemetry/providers.ts
var ConsoleTelemetryProvider = class {
  events = [];
  startTime = Date.now();
  recordEvent(event) {
    this.events.push(event);
    console.log(`[MCP Telemetry] ${event.type}:`, event.data);
    if (this.events.length > 1e3) {
      this.events = this.events.slice(-500);
    }
  }
  getMetrics() {
    const now = Date.now();
    const totalRequests = this.events.filter((e) => e.type === "request_end").length;
    const successfulRequests = this.events.filter(
      (e) => e.type === "request_end" && e.data.success
    ).length;
    const failedRequests = totalRequests - successfulRequests;
    const durations = this.events.filter((e) => e.type === "request_end" && e.data.duration).map((e) => e.data.duration);
    const averageDuration = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
    const recentEvents = this.events.filter(
      (e) => e.type === "request_end" && now - e.timestamp < 6e4
    );
    const requestsPerSecond = recentEvents.length / 60;
    const methodMetrics = {
      ["tools/list" /* TOOLS_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["tools/call" /* TOOLS_CALL */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["resources/list" /* RESOURCES_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["resources/read" /* RESOURCES_READ */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["prompts/list" /* PROMPTS_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["prompts/get" /* PROMPTS_GET */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["ping" /* PING */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["initialize" /* INITIALIZE */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["initialized" /* INITIALIZED */]: { count: 0, averageDuration: 0, errorCount: 0 }
    };
    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageDuration,
      requestsPerSecond,
      activeSessions: 0,
      // Not tracked in console provider
      methodMetrics
    };
  }
  getEvents() {
    return [...this.events];
  }
  exportTraces() {
    return Promise.resolve();
  }
  shutdown() {
    console.log(`[MCP Telemetry] Shutting down. Recorded ${this.events.length} events.`);
    this.events.length = 0;
    return Promise.resolve();
  }
};
var MemoryTelemetryProvider = class {
  events = [];
  maxEvents = 1e4;
  recordEvent(event) {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }
  getMetrics() {
    const totalRequests = this.events.filter((e) => e.type === "request_end").length;
    const successfulRequests = this.events.filter(
      (e) => e.type === "request_end" && e.data.success
    ).length;
    const failedRequests = totalRequests - successfulRequests;
    const durations = this.events.filter((e) => e.type === "request_end" && e.data.duration).map((e) => e.data.duration);
    const averageDuration = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
    const requestsPerSecond = this.calculateRequestsPerSecond();
    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageDuration,
      requestsPerSecond,
      activeSessions: 0,
      methodMetrics: {
        ["tools/list" /* TOOLS_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["tools/call" /* TOOLS_CALL */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["resources/list" /* RESOURCES_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["resources/read" /* RESOURCES_READ */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["prompts/list" /* PROMPTS_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["prompts/get" /* PROMPTS_GET */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["ping" /* PING */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["initialize" /* INITIALIZE */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["initialized" /* INITIALIZED */]: { count: 0, averageDuration: 0, errorCount: 0 }
      }
    };
  }
  getEvents() {
    return [...this.events];
  }
  calculateRequestsPerSecond() {
    const now = Date.now();
    const recentEvents = this.events.filter(
      (e) => e.type === "request_end" && now - e.timestamp < 6e4
    );
    return recentEvents.length / 60;
  }
  exportTraces() {
    return Promise.resolve();
  }
  shutdown() {
    this.events.length = 0;
    return Promise.resolve();
  }
  /**
   * Get events by type
   */
  getEventsByType(type) {
    return this.events.filter((e) => e.type === type);
  }
  /**
   * Get events within time range
   */
  getEventsInRange(startTime, endTime) {
    return this.events.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);
  }
  /**
   * Clear all events
   */
  clear() {
    this.events.length = 0;
  }
};
var OTLPTTelemetryProvider = class {
  otlpEndpoint;
  headers;
  constructor(config) {
    this.otlpEndpoint = config?.endpoint;
    this.headers = config?.headers;
  }
  recordEvent(event) {
    console.log(`[OTLP] Event recorded: ${event.type}`);
  }
  getMetrics() {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageDuration: 0,
      requestsPerSecond: 0,
      activeSessions: 0,
      methodMetrics: {
        ["tools/list" /* TOOLS_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["tools/call" /* TOOLS_CALL */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["resources/list" /* RESOURCES_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["resources/read" /* RESOURCES_READ */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["prompts/list" /* PROMPTS_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["prompts/get" /* PROMPTS_GET */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["ping" /* PING */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["initialize" /* INITIALIZE */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["initialized" /* INITIALIZED */]: { count: 0, averageDuration: 0, errorCount: 0 }
      }
    };
  }
  getEvents() {
    return [];
  }
  async exportTraces() {
    if (!this.otlpEndpoint) {
      console.warn("[OTLP] No endpoint configured for trace export");
      return;
    }
    try {
      console.log(`[OTLP] Exporting traces to ${this.otlpEndpoint}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error("[OTLP] Failed to export traces:", error);
      throw error;
    }
  }
  shutdown() {
    console.log("[OTLP] Provider shutdown");
    return Promise.resolve();
  }
};
var CompositeTelemetryProvider = class {
  providers = [];
  constructor(providers = []) {
    this.providers = providers;
  }
  addProvider(provider) {
    this.providers.push(provider);
  }
  removeProvider(provider) {
    const index = this.providers.indexOf(provider);
    if (index > -1) {
      this.providers.splice(index, 1);
    }
  }
  recordEvent(event) {
    this.providers.forEach((provider) => {
      try {
        provider.recordEvent(event);
      } catch (error) {
        console.warn("[Composite] Error in provider:", error);
      }
    });
  }
  getMetrics() {
    const metrics = this.providers.filter((p) => "getMetrics" in p).map((p) => p.getMetrics());
    if (metrics.length === 0) {
      const methodMetrics2 = {
        ["tools/list" /* TOOLS_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["tools/call" /* TOOLS_CALL */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["resources/list" /* RESOURCES_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["resources/read" /* RESOURCES_READ */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["prompts/list" /* PROMPTS_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["prompts/get" /* PROMPTS_GET */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["ping" /* PING */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["initialize" /* INITIALIZE */]: { count: 0, averageDuration: 0, errorCount: 0 },
        ["initialized" /* INITIALIZED */]: { count: 0, averageDuration: 0, errorCount: 0 }
      };
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageDuration: 0,
        requestsPerSecond: 0,
        activeSessions: 0,
        methodMetrics: methodMetrics2
      };
    }
    const methodMetrics = {
      ["tools/list" /* TOOLS_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["tools/call" /* TOOLS_CALL */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["resources/list" /* RESOURCES_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["resources/read" /* RESOURCES_READ */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["prompts/list" /* PROMPTS_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["prompts/get" /* PROMPTS_GET */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["ping" /* PING */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["initialize" /* INITIALIZE */]: { count: 0, averageDuration: 0, errorCount: 0 },
      ["initialized" /* INITIALIZED */]: { count: 0, averageDuration: 0, errorCount: 0 }
    };
    return {
      totalRequests: metrics.reduce((sum, m) => sum + m.totalRequests, 0),
      successfulRequests: metrics.reduce((sum, m) => sum + m.successfulRequests, 0),
      failedRequests: metrics.reduce((sum, m) => sum + m.failedRequests, 0),
      averageDuration: metrics.reduce((sum, m) => sum + m.averageDuration, 0) / metrics.length,
      requestsPerSecond: metrics.reduce((sum, m) => sum + m.requestsPerSecond, 0) / metrics.length,
      activeSessions: metrics.reduce((sum, m) => sum + m.activeSessions, 0),
      methodMetrics
    };
  }
  getEvents() {
    const allEvents = this.providers.filter((p) => "getEvents" in p).flatMap((p) => p.getEvents());
    const uniqueEvents = allEvents.filter(
      (event, index, self) => index === self.findIndex(
        (e) => e.timestamp === event.timestamp && e.type === event.type
      )
    ).sort((a, b) => a.timestamp - b.timestamp);
    return uniqueEvents;
  }
  async exportTraces() {
    const traceProviders = this.providers.filter(
      (p) => "exportTraces" in p
    );
    await Promise.all(
      traceProviders.map((provider) => provider.exportTraces())
    );
  }
  async shutdown() {
    await Promise.all(
      this.providers.map((provider) => provider.shutdown?.())
    );
  }
};

// src/telemetry/manager.ts
var TelemetryProviderFactory = class _TelemetryProviderFactory {
  static createProvider(config) {
    switch (config.type) {
      case "console":
        return new ConsoleTelemetryProvider();
      case "memory":
        return new MemoryTelemetryProvider();
      case "otlp":
        return new OTLPTTelemetryProvider({
          endpoint: config.config?.otlp?.endpoint,
          headers: config.config?.otlp?.headers
        });
      case "composite":
        const providers = (config.config?.composite?.providers || []).map(
          (p) => _TelemetryProviderFactory.createProvider(p)
        );
        return new CompositeTelemetryProvider(providers);
      default:
        throw new Error(`Unknown telemetry provider type: ${config.type}`);
    }
  }
};
var DefaultTelemetryManager = class _DefaultTelemetryManager {
  providers = [];
  constructor(providers) {
    if (providers) {
      this.providers = providers;
    } else {
      this.providers = [new ConsoleTelemetryProvider()];
    }
  }
  addProvider(provider) {
    this.providers.push(provider);
  }
  removeProvider(provider) {
    const index = this.providers.indexOf(provider);
    if (index > -1) {
      this.providers.splice(index, 1);
    }
  }
  getProviders() {
    return [...this.providers];
  }
  recordEvent(event) {
    this.providers.forEach((provider) => {
      try {
        provider.recordEvent(event);
      } catch (error) {
        console.warn("[TelemetryManager] Error recording event:", error);
      }
    });
  }
  getMetrics() {
    const metrics = this.providers.filter((p) => "getMetrics" in p).map((p) => p.getMetrics());
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageDuration: 0,
        requestsPerSecond: 0,
        activeSessions: 0,
        methodMetrics: {
          ["tools/list" /* TOOLS_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
          ["tools/call" /* TOOLS_CALL */]: { count: 0, averageDuration: 0, errorCount: 0 },
          ["resources/list" /* RESOURCES_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
          ["resources/read" /* RESOURCES_READ */]: { count: 0, averageDuration: 0, errorCount: 0 },
          ["prompts/list" /* PROMPTS_LIST */]: { count: 0, averageDuration: 0, errorCount: 0 },
          ["prompts/get" /* PROMPTS_GET */]: { count: 0, averageDuration: 0, errorCount: 0 },
          ["ping" /* PING */]: { count: 0, averageDuration: 0, errorCount: 0 },
          ["initialize" /* INITIALIZE */]: { count: 0, averageDuration: 0, errorCount: 0 },
          ["initialized" /* INITIALIZED */]: { count: 0, averageDuration: 0, errorCount: 0 }
        }
      };
    }
    return {
      totalRequests: metrics.reduce((sum, m) => sum + m.totalRequests, 0),
      successfulRequests: metrics.reduce((sum, m) => sum + m.successfulRequests, 0),
      failedRequests: metrics.reduce((sum, m) => sum + m.failedRequests, 0),
      averageDuration: metrics.reduce((sum, m) => sum + m.averageDuration, 0) / metrics.length,
      requestsPerSecond: metrics.reduce((sum, m) => sum + m.requestsPerSecond, 0) / metrics.length,
      activeSessions: metrics.reduce((sum, m) => sum + m.activeSessions, 0),
      methodMetrics: metrics[0].methodMetrics
      // Use first provider's method metrics for now
    };
  }
  async exportTraces() {
    const traceProviders = this.providers.filter(
      (p) => "exportTraces" in p
    );
    await Promise.all(
      traceProviders.map((provider) => provider.exportTraces())
    );
  }
  async shutdown() {
    await Promise.all(
      this.providers.map((provider) => provider.shutdown?.())
    );
  }
  /**
   * Create a telemetry manager from configuration
   */
  static fromConfig(config) {
    const providers = config.map((c) => TelemetryProviderFactory.createProvider(c));
    return new _DefaultTelemetryManager(providers);
  }
};
var globalTelemetryManager = null;
function getTelemetryManager() {
  if (!globalTelemetryManager) {
    globalTelemetryManager = new DefaultTelemetryManager();
  }
  return globalTelemetryManager;
}
function setTelemetryManager(manager) {
  globalTelemetryManager = manager;
}
function resetTelemetryManager() {
  if (globalTelemetryManager) {
    globalTelemetryManager.shutdown();
    globalTelemetryManager = null;
  }
}

// src/enrichment/index.ts
var EnvironmentEnrichmentProvider = class {
  environment;
  constructor() {
    this.environment = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      hostname: this.getHostname(),
      pid: process.pid.toString(),
      uptime: process.uptime().toString(),
      memoryUsage: JSON.stringify(process.memoryUsage()),
      ...process.env
    };
  }
  getHostname() {
    try {
      return __require("os").hostname();
    } catch {
      return "unknown";
    }
  }
  getEnrichmentData() {
    return {
      performance: {
        memoryUsage: process.memoryUsage().heapUsed
      },
      businessContext: {
        environment: this.getEnvironment(),
        service: "mcp-server",
        uptime: process.uptime()
      }
    };
  }
  enrichEvent(event) {
    return {
      ...event,
      data: {
        ...event.data,
        environment: this.getEnvironment(),
        timestamp: Date.now()
      }
    };
  }
  enrichAttributes(attributes) {
    return {
      ...attributes,
      "env.node_version": this.environment.nodeVersion,
      "env.platform": this.environment.platform,
      "env.hostname": this.environment.hostname,
      "env.pid": this.environment.pid,
      "env.uptime": this.environment.uptime
    };
  }
  getEnvironment() {
    return process.env.NODE_ENV || "development";
  }
};
var UserContextEnrichmentProvider = class {
  userContext = {};
  setUserContext(context) {
    this.userContext = { ...this.userContext, ...context };
  }
  clearUserContext() {
    this.userContext = {};
  }
  getEnrichmentData() {
    return {
      userAgent: this.userContext.userAgent,
      clientIp: this.userContext.clientIp,
      tags: this.userContext.customTags,
      businessContext: {
        userId: this.userContext.userId,
        sessionId: this.userContext.sessionId
      }
    };
  }
  enrichEvent(event) {
    return {
      ...event,
      data: {
        ...event.data,
        userId: this.userContext.userId,
        sessionId: this.userContext.sessionId,
        clientIp: this.userContext.clientIp,
        userAgent: this.userContext.userAgent,
        tags: this.userContext.customTags
      }
    };
  }
  enrichAttributes(attributes) {
    return {
      ...attributes,
      "user.id": this.userContext.userId || "",
      "user.session_id": this.userContext.sessionId || "",
      "user.client_ip": this.userContext.clientIp || "",
      "user.agent": this.userContext.userAgent || "",
      ...this.userContext.customTags?.length ? { "user.tags": this.userContext.customTags.join(",") } : {}
    };
  }
};
var GeographicEnrichmentProvider = class {
  location = {};
  setLocation(location) {
    this.location = location;
  }
  getEnrichmentData() {
    return {
      location: this.location
    };
  }
  enrichEvent(event) {
    return {
      ...event,
      data: {
        ...event.data,
        location: this.location
      }
    };
  }
  enrichAttributes(attributes) {
    return {
      ...attributes,
      "geo.country": this.location.country || "",
      "geo.region": this.location.region || "",
      "geo.city": this.location.city || "",
      "geo.timezone": this.location.timezone || ""
    };
  }
};
var CustomEnrichmentProvider = class {
  customData = {};
  setCustomData(data) {
    this.customData = { ...this.customData, ...data };
  }
  addCustomField(key, value) {
    this.customData[key] = value;
  }
  removeCustomField(key) {
    delete this.customData[key];
  }
  getEnrichmentData() {
    return {
      businessContext: this.customData
    };
  }
  enrichEvent(event) {
    return {
      ...event,
      data: {
        ...event.data,
        custom: this.customData
      }
    };
  }
  enrichAttributes(attributes) {
    const customAttributes = {};
    Object.entries(this.customData).forEach(([key, value]) => {
      customAttributes[`custom.${key}`] = String(value);
    });
    return {
      ...attributes,
      ...customAttributes
    };
  }
};
var CompositeEnrichmentProvider = class {
  providers = [];
  constructor(providers = []) {
    this.providers = providers;
  }
  addProvider(provider) {
    this.providers.push(provider);
  }
  removeProvider(provider) {
    const index = this.providers.indexOf(provider);
    if (index > -1) {
      this.providers.splice(index, 1);
    }
  }
  async getEnrichmentData() {
    const enrichmentData = {};
    for (const provider of this.providers) {
      try {
        const data = await provider.getEnrichmentData();
        enrichmentData.userAgent = data.userAgent || enrichmentData.userAgent;
        enrichmentData.clientIp = data.clientIp || enrichmentData.clientIp;
        enrichmentData.tags = [...enrichmentData.tags || [], ...data.tags || []];
        enrichmentData.location = { ...enrichmentData.location, ...data.location };
        enrichmentData.businessContext = { ...enrichmentData.businessContext, ...data.businessContext };
        enrichmentData.performance = { ...enrichmentData.performance, ...data.performance };
      } catch (error) {
        console.warn("[CompositeEnrichment] Error getting enrichment data:", error);
      }
    }
    return enrichmentData;
  }
  async enrichEvent(event) {
    let enrichedEvent = event;
    for (const provider of this.providers) {
      try {
        enrichedEvent = await provider.enrichEvent(enrichedEvent);
      } catch (error) {
        console.warn("[CompositeEnrichment] Error enriching event:", error);
      }
    }
    return enrichedEvent;
  }
  async enrichAttributes(attributes) {
    let enrichedAttributes = attributes;
    for (const provider of this.providers) {
      try {
        enrichedAttributes = await provider.enrichAttributes(enrichedAttributes);
      } catch (error) {
        console.warn("[CompositeEnrichment] Error enriching attributes:", error);
      }
    }
    return enrichedAttributes;
  }
};
var EnrichmentManager = class {
  compositeProvider;
  constructor() {
    this.compositeProvider = new CompositeEnrichmentProvider([
      new EnvironmentEnrichmentProvider()
    ]);
  }
  /**
   * Add an enrichment provider
   */
  addProvider(provider) {
    this.compositeProvider.addProvider(provider);
  }
  /**
   * Remove an enrichment provider
   */
  removeProvider(provider) {
    this.compositeProvider.removeProvider(provider);
  }
  /**
   * Get enrichment data from all providers
   */
  async getEnrichmentData() {
    return await this.compositeProvider.getEnrichmentData();
  }
  /**
   * Enrich a telemetry event
   */
  async enrichEvent(event) {
    return await this.compositeProvider.enrichEvent(event);
  }
  /**
   * Enrich span attributes
   */
  async enrichAttributes(attributes) {
    return await this.compositeProvider.enrichAttributes(attributes);
  }
  /**
   * Set user context across all providers
   */
  setUserContext(context) {
    const userProvider = this.compositeProvider["providers"].find(
      (p) => p instanceof UserContextEnrichmentProvider
    );
    if (userProvider) {
      userProvider.setUserContext(context);
    }
  }
  /**
   * Set geographic location
   */
  setLocation(location) {
    const geoProvider = this.compositeProvider["providers"].find(
      (p) => p instanceof GeographicEnrichmentProvider
    );
    if (geoProvider) {
      geoProvider.setLocation(location);
    }
  }
  /**
   * Set custom data
   */
  setCustomData(data) {
    const customProvider = this.compositeProvider["providers"].find(
      (p) => p instanceof CustomEnrichmentProvider
    );
    if (customProvider) {
      customProvider.setCustomData(data);
    }
  }
};
var globalEnrichmentManager = null;
function getEnrichmentManager() {
  if (!globalEnrichmentManager) {
    globalEnrichmentManager = new EnrichmentManager();
  }
  return globalEnrichmentManager;
}
function setEnrichmentManager(manager) {
  globalEnrichmentManager = manager;
}
function resetEnrichmentManager() {
  globalEnrichmentManager = null;
}

// src/config/index.ts
var ConfigurationManager = class {
  config;
  configFile;
  environmentOverrides = {};
  constructor(config = {}) {
    this.config = this.loadDefaultConfig();
    this.mergeConfig(config);
    this.loadEnvironmentOverrides();
  }
  /**
   * Load default configuration
   */
  loadDefaultConfig() {
    return {
      serviceName: "mcp-server",
      serviceVersion: "1.0.0",
      tracingEnabled: true,
      metricsEnabled: false,
      samplingRate: 1,
      requestTimeout: 3e4,
      maxAttributes: 128,
      maxEvents: 128,
      consoleExport: false,
      rotel: {
        enabled: false,
        autoInstrument: true,
        instrumentations: []
      }
    };
  }
  /**
   * Merge provided configuration with defaults
   */
  mergeConfig(config) {
    this.config = {
      ...this.config,
      ...config,
      rotel: {
        ...this.config.rotel,
        ...config.rotel
      }
    };
  }
  /**
   * Load configuration overrides from environment variables
   */
  loadEnvironmentOverrides() {
    if (process.env.OTEL_SERVICE_NAME) {
      this.config.serviceName = process.env.OTEL_SERVICE_NAME;
    }
    if (process.env.OTEL_SERVICE_VERSION) {
      this.config.serviceVersion = process.env.OTEL_SERVICE_VERSION;
    }
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      this.config.otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    }
    if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
      try {
        this.config.otlpHeaders = JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS);
      } catch {
        console.warn("Invalid OTEL_EXPORTER_OTLP_HEADERS format");
      }
    }
    if (process.env.NEONFLARE_TRACING_ENABLED) {
      this.config.tracingEnabled = process.env.NEONFLARE_TRACING_ENABLED === "true";
    }
    if (process.env.NEONFLARE_METRICS_ENABLED) {
      this.config.metricsEnabled = process.env.NEONFLARE_METRICS_ENABLED === "true";
    }
    if (process.env.NEONFLARE_SAMPLING_RATE) {
      this.config.samplingRate = parseFloat(process.env.NEONFLARE_SAMPLING_RATE);
    }
    if (process.env.NEONFLARE_REQUEST_TIMEOUT) {
      this.config.requestTimeout = parseInt(process.env.NEONFLARE_REQUEST_TIMEOUT);
    }
    if (process.env.NEONFLARE_CONSOLE_EXPORT) {
      this.config.consoleExport = process.env.NEONFLARE_CONSOLE_EXPORT === "true";
    }
    if (process.env.NEONFLARE_ROTEL_ENABLED) {
      this.config.rotel = this.config.rotel || {};
      this.config.rotel.enabled = process.env.NEONFLARE_ROTEL_ENABLED === "true";
    }
    if (process.env.NEONFLARE_ROTEL_AUTO_INSTRUMENT) {
      this.config.rotel = this.config.rotel || {};
      this.config.rotel.autoInstrument = process.env.NEONFLARE_ROTEL_AUTO_INSTRUMENT === "true";
    }
  }
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Update configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }
  /**
   * Get specific configuration value
   */
  get(key) {
    return this.config[key];
  }
  /**
   * Set specific configuration value
   */
  set(key, value) {
    this.config[key] = value;
  }
  /**
   * Load configuration from file
   */
  async loadFromFile(filePath) {
    try {
      const fs = await import("fs/promises");
      const fileContent = await fs.readFile(filePath, "utf-8");
      const fileConfig = JSON.parse(fileContent);
      this.configFile = filePath;
      this.mergeConfig(fileConfig);
    } catch (error) {
      console.warn(`Failed to load config from ${filePath}:`, error);
    }
  }
  /**
   * Save current configuration to file
   */
  async saveToFile(filePath) {
    try {
      const fs = await import("fs/promises");
      const path = filePath || this.configFile || "./neonflare-config.json";
      await fs.writeFile(path, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error("Failed to save config:", error);
      throw error;
    }
  }
  /**
   * Reset configuration to defaults
   */
  reset() {
    this.config = this.loadDefaultConfig();
    this.configFile = void 0;
    this.loadEnvironmentOverrides();
  }
  /**
   * Validate current configuration
   */
  validate() {
    const errors = [];
    if (!this.config.serviceName) {
      errors.push("Service name is required");
    }
    if (this.config.samplingRate !== void 0) {
      if (this.config.samplingRate < 0 || this.config.samplingRate > 1) {
        errors.push("Sampling rate must be between 0 and 1");
      }
    }
    if (this.config.requestTimeout !== void 0) {
      if (this.config.requestTimeout < 0) {
        errors.push("Request timeout must be positive");
      }
    }
    if (this.config.maxAttributes !== void 0) {
      if (this.config.maxAttributes < 0) {
        errors.push("Max attributes must be positive");
      }
    }
    if (this.config.otlpEndpoint) {
      try {
        new URL(this.config.otlpEndpoint);
      } catch {
        errors.push("OTLP endpoint must be a valid URL");
      }
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
  /**
   * Create configuration for different environments
   */
  static forEnvironment(environment) {
    const baseConfig = {
      serviceName: "mcp-server",
      serviceVersion: "1.0.0",
      tracingEnabled: true,
      metricsEnabled: false,
      samplingRate: 1,
      requestTimeout: 3e4,
      maxAttributes: 128,
      maxEvents: 128,
      consoleExport: false
    };
    switch (environment) {
      case "development":
        return {
          ...baseConfig,
          consoleExport: true,
          samplingRate: 1,
          rotel: {
            enabled: true,
            autoInstrument: true,
            instrumentations: ["http", "fs", "dns"]
          }
        };
      case "staging":
        return {
          ...baseConfig,
          samplingRate: 0.5,
          otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://staging-collector:4317",
          rotel: {
            enabled: true,
            autoInstrument: true,
            instrumentations: ["http", "fs", "dns"]
          }
        };
      case "production":
        return {
          ...baseConfig,
          samplingRate: 0.1,
          otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://production-collector:4317",
          rotel: {
            enabled: true,
            autoInstrument: true,
            instrumentations: ["http", "fs", "dns", "net", "os"]
          }
        };
      default:
        return baseConfig;
    }
  }
};
var globalConfigManager = null;
function getConfigurationManager() {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigurationManager();
  }
  return globalConfigManager;
}
function setConfigurationManager(manager) {
  globalConfigManager = manager;
}
function resetConfigurationManager() {
  globalConfigManager = null;
}
var Config = {
  /**
   * Create development configuration
   */
  development: () => ConfigurationManager.forEnvironment("development"),
  /**
   * Create staging configuration
   */
  staging: () => ConfigurationManager.forEnvironment("staging"),
  /**
   * Create production configuration
   */
  production: () => ConfigurationManager.forEnvironment("production"),
  /**
   * Create minimal configuration
   */
  minimal: () => ({
    serviceName: "mcp-server",
    serviceVersion: "1.0.0",
    tracingEnabled: false,
    metricsEnabled: false
  }),
  /**
   * Create full-featured configuration
   */
  full: () => ({
    serviceName: "mcp-server",
    serviceVersion: "1.0.0",
    tracingEnabled: true,
    metricsEnabled: true,
    samplingRate: 1,
    requestTimeout: 3e4,
    maxAttributes: 128,
    maxEvents: 128,
    consoleExport: true,
    otlpEndpoint: "http://localhost:4317",
    rotel: {
      enabled: true,
      autoInstrument: true,
      instrumentations: ["http", "fs", "dns", "net", "os"]
    }
  })
};

// src/utils/index.ts
function createMCPAttributes(method, operationId, additionalAttributes) {
  return {
    "mcp.method": method,
    "mcp.operation_id": operationId,
    "mcp.timestamp": Date.now(),
    "mcp.success": true,
    // Default value, should be overridden
    "mcp.duration_ms": 0,
    // Default value, should be overridden
    ...additionalAttributes
  };
}
function createErrorAttributes(error) {
  if (error instanceof Error) {
    return {
      "mcp.error_code": "UNKNOWN_ERROR",
      "mcp.error_message": error.message,
      "mcp.error_stack": error.stack || ""
    };
  }
  return {
    "mcp.error_code": error.code,
    "mcp.error_message": error.message,
    "mcp.error_details": JSON.stringify(error.details || {})
  };
}
function createPerformanceAttributes(duration, memoryUsage, cpuUsage) {
  return {
    "mcp.duration_ms": duration,
    ...memoryUsage !== void 0 ? { "perf.memory_mb": Math.round(memoryUsage / 1024 / 1024) } : {},
    ...cpuUsage !== void 0 ? { "perf.cpu_percent": cpuUsage } : {}
  };
}
function createCorrelationAttributes(traceId, spanId, parentSpanId) {
  return {
    ...traceId ? { "correlation.trace_id": traceId } : {},
    ...spanId ? { "correlation.span_id": spanId } : {},
    ...parentSpanId ? { "correlation.parent_span_id": parentSpanId } : {}
  };
}
function sanitizeAttributeValue(value) {
  if (value === null || value === void 0) {
    return "";
  }
  if (typeof value === "string") {
    return value.length > 256 ? value.substring(0, 256) + "..." : value;
  }
  if (typeof value === "number") {
    if (!isFinite(value)) {
      return 0;
    }
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value).substring(0, 256);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}
function sanitizeAttributes(attributes) {
  const sanitized = {};
  for (const [key, value] of Object.entries(attributes)) {
    sanitized[key] = sanitizeAttributeValue(value);
  }
  return sanitized;
}
function generateCorrelationId() {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function extractCorrelationInfo(spanContext) {
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags
  };
}
function createSpanLink(spanContext, attributes) {
  return {
    context: spanContext,
    attributes: attributes || {}
  };
}
function formatAttributesForLogging(attributes) {
  const pairs = Object.entries(attributes).map(([key, value]) => `${key}=${value}`).join(" ");
  return pairs;
}
function createDatabaseAttributes(operation, table, rowsAffected, connectionString) {
  return {
    "db.operation": operation,
    ...table ? { "db.table": table } : {},
    ...rowsAffected !== void 0 ? { "db.rows_affected": rowsAffected } : {},
    ...connectionString ? { "db.connection_string": sanitizeConnectionString(connectionString) } : {}
  };
}
function createHTTPRequestAttributes(method, url, statusCode, duration) {
  return {
    "http.method": method,
    "http.url": url,
    ...statusCode ? { "http.status_code": statusCode } : {},
    ...duration ? { "http.duration_ms": duration } : {}
  };
}
function createUserAttributes(userId, sessionId, action) {
  return {
    ...userId ? { "user.id": userId } : {},
    ...sessionId ? { "user.session_id": sessionId } : {},
    ...action ? { "user.action": action } : {}
  };
}
function sanitizeConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);
    if (url.password) {
      url.password = "***";
    }
    return url.toString();
  } catch {
    return connectionString.replace(/password=[^&\s]*/gi, "password=***").replace(/pwd=[^&\s]*/gi, "pwd=***");
  }
}
function createBusinessAttributes(domain, operation, entityType, entityId) {
  return {
    "business.domain": domain,
    "business.operation": operation,
    ...entityType ? { "business.entity_type": entityType } : {},
    ...entityId ? { "business.entity_id": entityId } : {}
  };
}
function mergeAttributes(...attributeObjects) {
  const merged = {};
  for (const attrs of attributeObjects) {
    if (attrs) {
      Object.assign(merged, attrs);
    }
  }
  return merged;
}
function filterAttributes(attributes, includePatterns, excludePatterns) {
  const filtered = {};
  for (const [key, value] of Object.entries(attributes)) {
    const shouldInclude = !includePatterns || includePatterns.some(
      (pattern) => key.includes(pattern) || new RegExp(pattern).test(key)
    );
    const shouldExclude = excludePatterns?.some(
      (pattern) => key.includes(pattern) || new RegExp(pattern).test(key)
    );
    if (shouldInclude && !shouldExclude) {
      filtered[key] = value;
    }
  }
  return filtered;
}
function createSpanEvent(name, attributes, timestamp) {
  return {
    name,
    attributes: attributes ? sanitizeAttributes(attributes) : void 0,
    timestamp: timestamp || Date.now()
  };
}
function isValidAttributeKey(key) {
  if (typeof key !== "string" || key.length === 0) {
    return false;
  }
  if (key.startsWith("_")) {
    return false;
  }
  const validPattern = /^[a-zA-Z][a-zA-Z0-9._-]*$/;
  return validPattern.test(key);
}
function sanitizeAttributeKeys(attributes) {
  const sanitized = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (isValidAttributeKey(key)) {
      sanitized[key] = sanitizeAttributeValue(value);
    } else {
      const sanitizedKey = key.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, "").toLowerCase();
      if (sanitizedKey.length > 0 && isValidAttributeKey(sanitizedKey)) {
        sanitized[sanitizedKey] = sanitizeAttributeValue(value);
      }
    }
  }
  return sanitized;
}
function createTimingAttributes(operationName, startTime, endTime) {
  const now = endTime || Date.now();
  const duration = now - startTime;
  return {
    [`timing.${operationName}_start`]: startTime,
    [`timing.${operationName}_duration`]: duration,
    ...endTime ? { [`timing.${operationName}_end`]: endTime } : {}
  };
}
function createResourceAttributes(resourceType, usage, unit) {
  return {
    [`resource.${resourceType}_usage`]: usage,
    ...unit ? { [`resource.${resourceType}_unit`]: unit } : {}
  };
}
function createSecurityAttributes(action, resource, userId, success) {
  return {
    "security.action": action,
    ...resource ? { "security.resource": resource } : {},
    ...userId ? { "security.user_id": userId } : {},
    ...success !== void 0 ? { "security.success": success } : {}
  };
}
function createMetricAttributes(metricName, value, unit, tags) {
  return {
    [`metric.${metricName}_value`]: value,
    ...unit ? { [`metric.${metricName}_unit`]: unit } : {},
    ...Object.entries(tags || {}).reduce((acc, [key, tagValue]) => {
      acc[`metric.${metricName}_tag_${key}`] = tagValue;
      return acc;
    }, {})
  };
}
var AttributeManager = class _AttributeManager {
  attributes = /* @__PURE__ */ new Map();
  set(key, value) {
    this.attributes.set(key, value);
  }
  get(key) {
    return this.attributes.get(key);
  }
  has(key) {
    return this.attributes.has(key);
  }
  delete(key) {
    return this.attributes.delete(key);
  }
  clear() {
    this.attributes.clear();
  }
  size() {
    return this.attributes.size;
  }
  toAttributes() {
    return sanitizeAttributes(Object.fromEntries(this.attributes));
  }
  merge(other) {
    const merged = new _AttributeManager();
    merged.attributes = new Map([...this.attributes, ...other.attributes]);
    return merged;
  }
  filter(predicate) {
    const filtered = new _AttributeManager();
    for (const [key, value] of this.attributes) {
      if (predicate(key, value)) {
        filtered.set(key, value);
      }
    }
    return filtered;
  }
};

// src/core/errors.ts
import { SpanStatusCode as SpanStatusCode2 } from "@opentelemetry/api";
var MCPErrorType = /* @__PURE__ */ ((MCPErrorType2) => {
  MCPErrorType2["INVALID_REQUEST"] = "invalid_request";
  MCPErrorType2["METHOD_NOT_FOUND"] = "method_not_found";
  MCPErrorType2["INVALID_PARAMS"] = "invalid_params";
  MCPErrorType2["INTERNAL_ERROR"] = "internal_error";
  MCPErrorType2["AUTHENTICATION_FAILED"] = "authentication_failed";
  MCPErrorType2["AUTHORIZATION_FAILED"] = "authorization_failed";
  MCPErrorType2["RESOURCE_NOT_FOUND"] = "resource_not_found";
  MCPErrorType2["RESOURCE_EXHAUSTED"] = "resource_exhausted";
  MCPErrorType2["TIMEOUT"] = "timeout";
  MCPErrorType2["CANCELLED"] = "cancelled";
  MCPErrorType2["CONNECTION_ERROR"] = "connection_error";
  MCPErrorType2["PROTOCOL_ERROR"] = "protocol_error";
  return MCPErrorType2;
})(MCPErrorType || {});
var MCPError = class _MCPError extends Error {
  type;
  code;
  details;
  retryable;
  timestamp;
  constructor(type, message, code, details, retryable = false) {
    super(message);
    this.name = "MCPError";
    this.type = type;
    this.code = code || type;
    this.details = details;
    this.retryable = retryable;
    this.timestamp = Date.now();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, _MCPError);
    }
  }
  /**
   * Convert to MCP method result error format
   */
  toMethodResultError() {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
  /**
   * Create a user-friendly error message
   */
  toUserMessage() {
    switch (this.type) {
      case "invalid_request" /* INVALID_REQUEST */:
        return "The request was malformed or missing required information.";
      case "method_not_found" /* METHOD_NOT_FOUND */:
        return "The requested method does not exist.";
      case "invalid_params" /* INVALID_PARAMS */:
        return "The request parameters are invalid or missing.";
      case "authentication_failed" /* AUTHENTICATION_FAILED */:
        return "Authentication failed. Please check your credentials.";
      case "authorization_failed" /* AUTHORIZATION_FAILED */:
        return "You do not have permission to perform this action.";
      case "resource_not_found" /* RESOURCE_NOT_FOUND */:
        return "The requested resource was not found.";
      case "resource_exhausted" /* RESOURCE_EXHAUSTED */:
        return "The service is temporarily unavailable due to high load.";
      case "timeout" /* TIMEOUT */:
        return "The operation timed out. Please try again.";
      case "connection_error" /* CONNECTION_ERROR */:
        return "Unable to connect to the service. Please check your connection.";
      default:
        return this.message || "An unexpected error occurred.";
    }
  }
};
var MCPErrorHandler = class {
  errorCounts = /* @__PURE__ */ new Map();
  lastErrorTime = /* @__PURE__ */ new Map();
  errorThreshold = 10;
  // errors per time window
  timeWindow = 6e4;
  // 1 minute
  /**
   * Handle an error in an MCP operation
   */
  async handleError(error, context, span) {
    const mcpError = error instanceof MCPError ? error : this.convertToMCPError(error);
    this.updateErrorStats(mcpError.type);
    if (span) {
      span.setStatus({
        code: SpanStatusCode2.ERROR,
        message: mcpError.message
      });
      span.setAttributes({
        "mcp.error_type": mcpError.type,
        "mcp.error_code": mcpError.code,
        "mcp.error_message": mcpError.message,
        "mcp.error_retryable": mcpError.retryable,
        "mcp.error_timestamp": mcpError.timestamp,
        ...mcpError.details ? { "mcp.error_details": JSON.stringify(mcpError.details) } : {}
      });
    }
    this.logError(mcpError, context);
    if (this.isErrorStorm(mcpError.type)) {
      console.warn(`[MCP Error Handler] Error storm detected for ${mcpError.type}`);
    }
    return mcpError;
  }
  /**
   * Convert generic error to MCPError
   */
  convertToMCPError(error) {
    if (error.message.includes("timeout") || error.name === "TimeoutError") {
      return new MCPError("timeout" /* TIMEOUT */, error.message, "TIMEOUT", error);
    }
    if (error.message.includes("connection") || error.message.includes("ECONNREFUSED")) {
      return new MCPError("connection_error" /* CONNECTION_ERROR */, error.message, "CONNECTION_ERROR", error);
    }
    if (error.message.includes("authentication") || error.message.includes("unauthorized")) {
      return new MCPError("authentication_failed" /* AUTHENTICATION_FAILED */, error.message, "AUTH_FAILED", error);
    }
    if (error.message.includes("permission") || error.message.includes("forbidden")) {
      return new MCPError("authorization_failed" /* AUTHORIZATION_FAILED */, error.message, "AUTHZ_FAILED", error);
    }
    if (error.message.includes("not found")) {
      return new MCPError("resource_not_found" /* RESOURCE_NOT_FOUND */, error.message, "NOT_FOUND", error);
    }
    return new MCPError("internal_error" /* INTERNAL_ERROR */, error.message, "INTERNAL_ERROR", error);
  }
  /**
   * Update error statistics
   */
  updateErrorStats(errorType) {
    const now = Date.now();
    const count = this.errorCounts.get(errorType) || 0;
    const lastTime = this.lastErrorTime.get(errorType) || 0;
    if (now - lastTime > this.timeWindow) {
      this.errorCounts.set(errorType, 1);
      this.lastErrorTime.set(errorType, now);
    } else {
      this.errorCounts.set(errorType, count + 1);
    }
  }
  /**
   * Check if we're experiencing an error storm
   */
  isErrorStorm(errorType) {
    const count = this.errorCounts.get(errorType) || 0;
    return count >= this.errorThreshold;
  }
  /**
   * Log error with appropriate level and context
   */
  logError(error, context) {
    const logData = {
      type: error.type,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      timestamp: error.timestamp,
      ...context ? {
        operationId: context.operationId,
        method: context.metadata?.method,
        requestId: context.metadata?.requestId
      } : {}
    };
    if (error.retryable) {
      console.warn("[MCP Error]", logData);
    } else {
      console.error("[MCP Error]", logData);
    }
  }
  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {};
    for (const [errorType, count] of this.errorCounts) {
      stats[errorType] = {
        count,
        lastOccurrence: this.lastErrorTime.get(errorType) || 0
      };
    }
    return stats;
  }
  /**
   * Reset error statistics
   */
  resetErrorStats() {
    this.errorCounts.clear();
    this.lastErrorTime.clear();
  }
  /**
   * Set error threshold for storm detection
   */
  setErrorThreshold(threshold) {
    this.errorThreshold = threshold;
  }
  /**
   * Set time window for error counting
   */
  setTimeWindow(windowMs) {
    this.timeWindow = windowMs;
  }
};
var MCPErrorBoundary = class {
  errorHandler;
  constructor(errorHandler) {
    this.errorHandler = errorHandler || new MCPErrorHandler();
  }
  /**
   * Execute an operation with error handling
   */
  async execute(operation, context, span) {
    try {
      return await operation();
    } catch (error) {
      const mcpError = await this.errorHandler.handleError(error, context, span);
      throw mcpError;
    }
  }
  /**
   * Wrap a synchronous operation with error handling
   */
  executeSync(operation, context, span) {
    try {
      return operation();
    } catch (error) {
      const mcpError = this.errorHandler.handleError(error, context, span);
      throw mcpError;
    }
  }
  /**
   * Get the error handler instance
   */
  getErrorHandler() {
    return this.errorHandler;
  }
};
var MCPErrorRecovery = class {
  recoveryStrategies = /* @__PURE__ */ new Map();
  /**
   * Register a recovery strategy for an error type
   */
  registerRecoveryStrategy(errorType, strategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }
  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(error) {
    const strategy = this.recoveryStrategies.get(error.type);
    if (!strategy) {
      return false;
    }
    try {
      await strategy();
      console.log(`[MCP Error Recovery] Successfully recovered from ${error.type}`);
      return true;
    } catch (recoveryError) {
      console.error(`[MCP Error Recovery] Failed to recover from ${error.type}:`, recoveryError);
      return false;
    }
  }
  /**
   * Get all registered recovery strategies
   */
  getRecoveryStrategies() {
    return new Map(this.recoveryStrategies);
  }
};
var MCPErrorFilter = class {
  suppressedErrors = /* @__PURE__ */ new Set();
  suppressedPatterns = [];
  /**
   * Suppress an error by message
   */
  suppressError(message) {
    this.suppressedErrors.add(message);
  }
  /**
   * Suppress errors matching a pattern
   */
  suppressErrorPattern(pattern) {
    this.suppressedPatterns.push(pattern);
  }
  /**
   * Check if an error should be suppressed
   */
  shouldSuppress(error) {
    const message = error.message;
    if (this.suppressedErrors.has(message)) {
      return true;
    }
    return this.suppressedPatterns.some((pattern) => pattern.test(message));
  }
  /**
   * Remove suppression for an error message
   */
  unsuppressError(message) {
    this.suppressedErrors.delete(message);
  }
  /**
   * Remove suppression for an error pattern
   */
  unsuppressErrorPattern(pattern) {
    const index = this.suppressedPatterns.indexOf(pattern);
    if (index > -1) {
      this.suppressedPatterns.splice(index, 1);
    }
  }
  /**
   * Clear all suppressions
   */
  clearSuppressions() {
    this.suppressedErrors.clear();
    this.suppressedPatterns.length = 0;
  }
};
var globalErrorHandler = null;
function getErrorHandler() {
  if (!globalErrorHandler) {
    globalErrorHandler = new MCPErrorHandler();
  }
  return globalErrorHandler;
}
function setErrorHandler(handler) {
  globalErrorHandler = handler;
}
function resetErrorHandler() {
  globalErrorHandler = null;
}
var Errors = {
  invalidRequest: (message, details) => new MCPError("invalid_request" /* INVALID_REQUEST */, message, "INVALID_REQUEST", details),
  methodNotFound: (method) => new MCPError("method_not_found" /* METHOD_NOT_FOUND */, `Method '${method}' not found`, "METHOD_NOT_FOUND", { method }),
  invalidParams: (param, details) => new MCPError("invalid_params" /* INVALID_PARAMS */, `Invalid parameter: ${param}`, "INVALID_PARAMS", details),
  internalError: (message, details) => new MCPError("internal_error" /* INTERNAL_ERROR */, message, "INTERNAL_ERROR", details),
  authenticationFailed: (details) => new MCPError("authentication_failed" /* AUTHENTICATION_FAILED */, "Authentication failed", "AUTH_FAILED", details),
  authorizationFailed: (resource) => new MCPError("authorization_failed" /* AUTHORIZATION_FAILED */, "Authorization failed", "AUTHZ_FAILED", { resource }),
  resourceNotFound: (resource) => new MCPError("resource_not_found" /* RESOURCE_NOT_FOUND */, `Resource not found: ${resource}`, "NOT_FOUND", { resource }),
  resourceExhausted: (resource) => new MCPError("resource_exhausted" /* RESOURCE_EXHAUSTED */, `Resource exhausted: ${resource}`, "RESOURCE_EXHAUSTED", { resource }, true),
  timeout: (operation) => new MCPError("timeout" /* TIMEOUT */, `Operation timed out: ${operation}`, "TIMEOUT", { operation }),
  cancelled: (operation) => new MCPError("cancelled" /* CANCELLED */, `Operation cancelled: ${operation}`, "CANCELLED", { operation }),
  connectionError: (target, details) => new MCPError("connection_error" /* CONNECTION_ERROR */, `Connection error: ${target}`, "CONNECTION_ERROR", details, true),
  protocolError: (message, details) => new MCPError("protocol_error" /* PROTOCOL_ERROR */, message, "PROTOCOL_ERROR", details)
};

// src/core/performance.ts
var PerformanceMonitor = class {
  config;
  metricsHistory = [];
  maxHistorySize = 1e3;
  constructor(config = {}) {
    this.config = {
      enabled: true,
      collectSystemMetrics: false,
      samplingRate: 1,
      thresholds: {
        maxDuration: 5e3,
        // 5 seconds
        maxMemoryUsage: 100,
        // 100 MB
        maxCpuUsage: 80
        // 80%
      },
      ...config
    };
  }
  /**
   * Monitor the performance of an async operation
   */
  async monitorAsync(operation, operationName, context, span) {
    if (!this.config.enabled || Math.random() > (this.config.samplingRate || 1)) {
      const result = await operation();
      return { result, metrics: { duration: 0 } };
    }
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();
    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;
      const metrics = {
        duration,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: await this.getCpuUsage()
      };
      this.checkThresholds(metrics, operationName);
      this.recordMetrics(metrics);
      if (span) {
        const perfAttributes = this.createPerformanceAttributes(metrics);
        span.setAttributes(perfAttributes);
      }
      return { result, metrics };
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const metrics = {
        duration,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: await this.getCpuUsage()
      };
      this.recordMetrics(metrics);
      throw error;
    }
  }
  /**
   * Monitor the performance of a synchronous operation
   */
  monitorSync(operation, operationName, context, span) {
    if (!this.config.enabled || Math.random() > (this.config.samplingRate || 1)) {
      const result = operation();
      return { result, metrics: { duration: 0 } };
    }
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();
    try {
      const result = operation();
      const endTime = performance.now();
      const duration = endTime - startTime;
      const metrics = {
        duration,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCpuUsageSync()
      };
      this.checkThresholds(metrics, operationName);
      this.recordMetrics(metrics);
      if (span) {
        const perfAttributes = this.createPerformanceAttributes(metrics);
        span.setAttributes(perfAttributes);
      }
      return { result, metrics };
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const metrics = {
        duration,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCpuUsageSync()
      };
      this.recordMetrics(metrics);
      throw error;
    }
  }
  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }
  /**
   * Get current CPU usage (async)
   */
  async getCpuUsage() {
    if (!this.config.collectSystemMetrics) {
      return 0;
    }
    try {
      if (typeof process !== "undefined" && process.cpuUsage) {
        const usage = process.cpuUsage();
        return Math.min(100, (usage.user + usage.system) / 1e3);
      }
    } catch {
    }
    return 0;
  }
  /**
   * Get current CPU usage (sync)
   */
  getCpuUsageSync() {
    if (!this.config.collectSystemMetrics) {
      return 0;
    }
    try {
      if (typeof process !== "undefined" && process.cpuUsage) {
        const usage = process.cpuUsage();
        return Math.min(100, (usage.user + usage.system) / 1e3);
      }
    } catch {
    }
    return 0;
  }
  /**
   * Check performance thresholds and log warnings
   */
  checkThresholds(metrics, operationName) {
    const thresholds = this.config.thresholds;
    if (!thresholds) return;
    const warnings = [];
    if (thresholds.maxDuration && metrics.duration > thresholds.maxDuration) {
      warnings.push(`Duration ${metrics.duration}ms exceeds threshold ${thresholds.maxDuration}ms`);
    }
    if (thresholds.maxMemoryUsage && metrics.memoryUsage) {
      const memoryMB = metrics.memoryUsage / 1024 / 1024;
      if (memoryMB > thresholds.maxMemoryUsage) {
        warnings.push(`Memory usage ${memoryMB.toFixed(2)}MB exceeds threshold ${thresholds.maxMemoryUsage}MB`);
      }
    }
    if (thresholds.maxCpuUsage && metrics.cpuUsage && metrics.cpuUsage > thresholds.maxCpuUsage) {
      warnings.push(`CPU usage ${metrics.cpuUsage.toFixed(2)}% exceeds threshold ${thresholds.maxCpuUsage}%`);
    }
    if (warnings.length > 0) {
      const message = `Performance warning${warnings.length > 1 ? "s" : ""} for ${operationName || "operation"}: ${warnings.join(", ")}`;
      console.warn(`[Performance Monitor] ${message}`);
    }
  }
  /**
   * Record performance metrics
   */
  recordMetrics(metrics) {
    this.metricsHistory.push({
      timestamp: Date.now(),
      metrics
    });
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }
  /**
   * Create performance attributes for span
   */
  createPerformanceAttributes(metrics) {
    return {
      "perf.duration_ms": metrics.duration,
      ...metrics.memoryUsage ? { "perf.memory_bytes": metrics.memoryUsage } : {},
      ...metrics.cpuUsage ? { "perf.cpu_percent": metrics.cpuUsage } : {},
      ...metrics.networkLatency ? { "perf.network_latency_ms": metrics.networkLatency } : {},
      ...metrics.dbQueryTime ? { "perf.db_query_ms": metrics.dbQueryTime } : {},
      ...metrics.cacheHitRate ? { "perf.cache_hit_rate": metrics.cacheHitRate } : {},
      ...metrics.errorRate ? { "perf.error_rate": metrics.errorRate } : {},
      ...metrics.throughput ? { "perf.throughput_ops": metrics.throughput } : {}
    };
  }
  /**
   * Get performance statistics
   */
  getPerformanceStats(timeRange) {
    const range = timeRange || 6e4;
    const cutoffTime = Date.now() - range;
    const recentMetrics = this.metricsHistory.filter((entry) => entry.timestamp >= cutoffTime).map((entry) => entry.metrics);
    if (recentMetrics.length === 0) {
      return {
        averageDuration: 0,
        maxDuration: 0,
        minDuration: 0,
        totalOperations: 0,
        slowOperations: 0
      };
    }
    const durations = recentMetrics.map((m) => m.duration);
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    const threshold = this.config.thresholds?.maxDuration || 5e3;
    const slowOperations = recentMetrics.filter((m) => m.duration > threshold).length;
    return {
      averageDuration,
      maxDuration,
      minDuration,
      totalOperations: recentMetrics.length,
      slowOperations
    };
  }
  /**
   * Get memory usage trend
   */
  getMemoryTrend(timeRange) {
    const range = timeRange || 6e4;
    const cutoffTime = Date.now() - range;
    return this.metricsHistory.filter((entry) => entry.timestamp >= cutoffTime && entry.metrics.memoryUsage).map((entry) => ({
      timestamp: entry.timestamp,
      usage: entry.metrics.memoryUsage
    }));
  }
  /**
   * Clear performance history
   */
  clearHistory() {
    this.metricsHistory.length = 0;
  }
  /**
   * Update configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
};
function withPerformanceMonitoring(operationName, config) {
  const monitor = new PerformanceMonitor(config);
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function(...args) {
      return monitor.monitorAsync(
        () => originalMethod.apply(this, args),
        operationName || `${target.constructor.name}.${propertyKey}`
      );
    };
    return descriptor;
  };
}
function withSyncPerformanceMonitoring(operationName, config) {
  const monitor = new PerformanceMonitor(config);
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function(...args) {
      return monitor.monitorSync(
        () => originalMethod.apply(this, args),
        operationName || `${target.constructor.name}.${propertyKey}`
      );
    };
    return descriptor;
  };
}
var PerformanceTimer = class {
  startTime;
  marks = /* @__PURE__ */ new Map();
  constructor() {
    this.startTime = performance.now();
  }
  /**
   * Mark a point in time
   */
  mark(name) {
    this.marks.set(name, performance.now());
  }
  /**
   * Measure duration between two marks
   */
  measure(fromMark, toMark) {
    const fromTime = this.marks.get(fromMark);
    const toTime = toMark ? this.marks.get(toMark) : performance.now();
    if (fromTime === void 0) {
      throw new Error(`Mark '${fromMark}' not found`);
    }
    return (toTime || performance.now()) - fromTime;
  }
  /**
   * Measure duration from start
   */
  measureFromStart(toMark) {
    return this.measure("start", toMark);
  }
  /**
   * Get all marks
   */
  getMarks() {
    return Object.fromEntries(this.marks);
  }
  /**
   * Get elapsed time since start
   */
  getElapsed() {
    return performance.now() - this.startTime;
  }
  /**
   * Reset timer
   */
  reset() {
    this.startTime = performance.now();
    this.marks.clear();
  }
};
var globalPerformanceMonitor = null;
function getPerformanceMonitor() {
  if (!globalPerformanceMonitor) {
    globalPerformanceMonitor = new PerformanceMonitor();
  }
  return globalPerformanceMonitor;
}
function setPerformanceMonitor(monitor) {
  globalPerformanceMonitor = monitor;
}
function resetPerformanceMonitor() {
  globalPerformanceMonitor = null;
}
async function measurePerformance(operation, operationName) {
  const monitor = getPerformanceMonitor();
  const { result, metrics } = await monitor.monitorAsync(operation, operationName);
  return { result, duration: metrics.duration };
}
function measureSyncPerformance(operation, operationName) {
  const monitor = getPerformanceMonitor();
  const { result, metrics } = monitor.monitorSync(operation, operationName);
  return { result, duration: metrics.duration };
}

// src/enrichment/context-injector.ts
function injectContextIntoSchema(schema, config = {}) {
  const {
    enabled = true,
    description = "Explain why you are calling this tool and what you hope to accomplish",
    required = false,
    parameterName = "context"
  } = config;
  if (!enabled) {
    return schema;
  }
  if (!schema) {
    return {
      type: "object",
      properties: {
        [parameterName]: {
          type: "string",
          description
        }
      },
      required: required ? [parameterName] : []
    };
  }
  const modifiedSchema = JSON.parse(JSON.stringify(schema));
  if (!modifiedSchema.properties) {
    modifiedSchema.properties = {};
  }
  modifiedSchema.properties[parameterName] = {
    type: "string",
    description
  };
  if (required) {
    modifiedSchema.required = modifiedSchema.required || [];
    if (!modifiedSchema.required.includes(parameterName)) {
      modifiedSchema.required.push(parameterName);
    }
  }
  return modifiedSchema;
}
function extractContextFromArgs(args, parameterName = "context") {
  if (!args || typeof args !== "object") {
    return void 0;
  }
  const context = args[parameterName];
  if (typeof context === "string") {
    return context;
  }
  return void 0;
}
function stripContextFromArgs(args, parameterName = "context") {
  if (!args || typeof args !== "object") {
    return args;
  }
  const { [parameterName]: _, ...cleanedArgs } = args;
  return cleanedArgs;
}
function hasContextInjection(schema, parameterName = "context") {
  return schema?.properties?.[parameterName]?.type === "string";
}
var ContextInjectionMiddleware = class {
  config;
  constructor(config = {}) {
    this.config = {
      enabled: true,
      description: "Explain why you are calling this tool and what you hope to accomplish",
      required: false,
      parameterName: "context",
      ...config
    };
  }
  /**
   * Process a tool schema during registration
   */
  processToolSchema(toolName, schema) {
    if (!this.config.enabled) {
      return schema;
    }
    console.log(`[Context Injection] Injecting context into tool: ${toolName}`);
    return injectContextIntoSchema(schema, this.config);
  }
  /**
   * Process tool arguments during execution
   */
  processToolArguments(toolName, args) {
    const context = extractContextFromArgs(args, this.config.parameterName);
    const cleanedArgs = stripContextFromArgs(args, this.config.parameterName);
    if (context) {
      console.log(`[Context Injection] Extracted context for ${toolName}: ${context.substring(0, 100)}...`);
    }
    return { context, cleanedArgs };
  }
  /**
   * Update configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
};

// src/index.ts
function trackmcp(server, config) {
  const tracker = new MCPTracker(config);
  const instrumentation = new MCPInstrumentation(tracker);
  const contextInjector = new ContextInjectionMiddleware(config?.contextInjection);
  server.__neonflare_instrumentation = instrumentation;
  server.__neonflare_tracker = tracker;
  server.__neonflare_context_injector = contextInjector;
  server.__neonflare_config = config;
  wrapServerMethods(server, instrumentation, tracker, contextInjector, config);
  return server;
}
function wrapServerMethods(server, instrumentation, tracker, contextInjector, config) {
  const originalSetRequestHandler = server.setRequestHandler.bind(server);
  server.setRequestHandler = function(schema, handler) {
    const method = schema.shape?.method?.value || "unknown";
    let modifiedSchema = schema;
    if (method === "tools/call" && schema.shape?.params?.shape?.arguments) {
      const originalArgsSchema = schema.shape.params.shape.arguments._def.innerType;
      const injectedSchema = contextInjector.processToolSchema(
        schema.shape.params.shape.name?._def.value || "unknown",
        originalArgsSchema
      );
      modifiedSchema = {
        ...schema,
        shape: {
          ...schema.shape,
          params: {
            ...schema.shape.params,
            shape: {
              ...schema.shape.params.shape,
              arguments: {
                ...schema.shape.params.shape.arguments,
                _def: {
                  ...schema.shape.params.shape.arguments._def,
                  innerType: injectedSchema
                }
              }
            }
          }
        }
      };
    }
    const wrappedHandler = async (request, extra) => {
      const requestId = request.id || `req_${Date.now()}`;
      const context = tracker.createOperationContext(method, requestId, request.params);
      const span = tracker.startMCPSpan(method, context);
      let aiContext;
      let cleanedParams = request.params;
      if (method === "tools/call" && request.params?.arguments) {
        const processed = contextInjector.processToolArguments(
          request.params.name || "unknown",
          request.params.arguments
        );
        aiContext = processed.context;
        cleanedParams = {
          ...request.params,
          arguments: processed.cleanedArgs
        };
        if (aiContext) {
          span.setAttributes({
            "mcp.tool.ai_context": aiContext,
            "mcp.tool.ai_intent": aiContext.substring(0, 200)
            // Truncated for storage
          });
        }
      }
      if (config?.projectId) {
        span.setAttributes({
          "neonflare.project_id": config.projectId
        });
      }
      try {
        const result = await handler({ ...request, params: cleanedParams }, extra);
        tracker.endMCPSpan(context.operationId, {
          success: true,
          data: result,
          duration: Date.now() - context.startTime,
          timestamp: Date.now()
        });
        return result;
      } catch (error) {
        tracker.endMCPSpan(context.operationId, {
          success: false,
          error: {
            code: error.code || "HANDLER_ERROR",
            message: error.message || "Handler execution failed",
            details: error
          },
          duration: Date.now() - context.startTime,
          timestamp: Date.now()
        });
        throw error;
      }
    };
    return originalSetRequestHandler(modifiedSchema, wrappedHandler);
  };
}
function getInstrumentation(server) {
  return server.__neonflare_instrumentation;
}
function getTracker(server) {
  return server.__neonflare_tracker;
}
function getContextInjector(server) {
  return server.__neonflare_context_injector;
}
export {
  AttributeManager,
  CompositeEnrichmentProvider,
  CompositeTelemetryProvider,
  Config,
  ConfigurationManager,
  ConsoleTelemetryProvider,
  ContextInjectionMiddleware,
  CustomEnrichmentProvider,
  DefaultTelemetryManager,
  EnrichmentManager,
  EnvironmentEnrichmentProvider,
  Errors,
  GeographicEnrichmentProvider,
  MCPError,
  MCPErrorBoundary,
  MCPErrorFilter,
  MCPErrorHandler,
  MCPErrorRecovery,
  MCPErrorType,
  MCPInstrumentation,
  MCPTracker,
  MemoryTelemetryProvider,
  OTLPTTelemetryProvider,
  PerformanceMonitor,
  PerformanceTimer,
  TelemetryProviderFactory,
  UserContextEnrichmentProvider,
  createBusinessAttributes,
  createCorrelationAttributes,
  createDatabaseAttributes,
  createErrorAttributes,
  createHTTPRequestAttributes,
  createMCPAttributes,
  createMCPInstrumentation,
  createMetricAttributes,
  createPerformanceAttributes,
  createResourceAttributes,
  createSecurityAttributes,
  createSpanEvent,
  createSpanLink,
  createTimingAttributes,
  createUserAttributes,
  extractContextFromArgs,
  extractCorrelationInfo,
  filterAttributes,
  formatAttributesForLogging,
  generateCorrelationId,
  getConfigurationManager,
  getContextInjector,
  getEnrichmentManager,
  getErrorHandler,
  getInstrumentation,
  getPerformanceMonitor,
  getTelemetryManager,
  getTracker,
  hasContextInjection,
  injectContextIntoSchema,
  isValidAttributeKey,
  measurePerformance,
  measureSyncPerformance,
  mergeAttributes,
  resetConfigurationManager,
  resetEnrichmentManager,
  resetErrorHandler,
  resetPerformanceMonitor,
  resetTelemetryManager,
  sanitizeAttributeKeys,
  sanitizeAttributeValue,
  sanitizeAttributes,
  sanitizeConnectionString,
  setConfigurationManager,
  setEnrichmentManager,
  setErrorHandler,
  setPerformanceMonitor,
  setTelemetryManager,
  stripContextFromArgs,
  trackmcp,
  withPerformanceMonitoring,
  withSyncPerformanceMonitoring
};
