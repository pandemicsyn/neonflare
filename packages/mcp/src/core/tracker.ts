import { trace, Tracer, Span, SpanStatusCode, Attributes } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import {
  MCPInstrumentationConfig,
  MCPOperationContext,
  MCPMethodCall,
  MCPMethodResult,
  MCPSpanAttributes,
  TelemetryEvent,
  TelemetryEventType,
  InstrumentationHook
} from '../types/index.js';

/**
 * Core MCP server tracker that manages OpenTelemetry instrumentation
 */
export class MCPTracker {
  private tracer!: Tracer;
  private config: MCPInstrumentationConfig;
  private hooks: InstrumentationHook[] = [];
  private telemetryEvents: TelemetryEvent[] = [];
  private activeSpans = new Map<string, Span>();
  private startTime = Date.now();

  constructor(config: MCPInstrumentationConfig = {}) {
    this.config = {
      serviceName: 'mcp-server',
      serviceVersion: '1.0.0',
      tracingEnabled: true,
      metricsEnabled: false,
      samplingRate: 1.0,
      requestTimeout: 30000,
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
  private initializeTracer(): void {
    const resource = Resource.default().merge(new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName || 'mcp-server',
      [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion || '1.0.0',
      [SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE]: 'nodejs',
      [SemanticResourceAttributes.TELEMETRY_SDK_NAME]: 'opentelemetry',
    }));

    // For now, we'll use a simple console-based setup
    // In a production environment, you'd configure proper exporters
    this.tracer = trace.getTracer('neonflare-mcp', this.config.serviceVersion);
  }

  /**
   * Create a new operation context for tracking
   */
  createOperationContext(method: string, requestId?: string, params?: any): MCPOperationContext {
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
  startMCPSpan(method: string, context: MCPOperationContext): Span {
    const span = this.tracer.startSpan(`mcp.${method}`, {
      kind: 1, // SERVER kind
      attributes: {
        'mcp.operation_id': context.operationId,
        'mcp.method': method,
        'mcp.start_time': context.startTime,
        ...(this.config.projectId ? { 'neonflare.project_id': this.config.projectId } : {}),
        ...this.config.defaultAttributes,
        ...(context.metadata?.requestId ? { 'mcp.request_id': context.metadata.requestId } : {}),
        ...(context.metadata?.aiContext ? { 'mcp.tool.ai_context': context.metadata.aiContext } : {})
      } as Attributes
    });

    // Store span for later completion
    this.activeSpans.set(context.operationId, span);

    // Add telemetry event
    this.addTelemetryEvent({
      type: TelemetryEventType.REQUEST_START,
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
  endMCPSpan(operationId: string, result: MCPMethodResult): void {
    const span = this.activeSpans.get(operationId);
    if (!span) return;

    const attributes: MCPSpanAttributes = {
      'mcp.method': this.extractMethodFromOperationId(operationId),
      'mcp.success': result.success,
      'mcp.duration_ms': result.duration
    };

    if (!result.success && result.error) {
      attributes['mcp.error_code'] = result.error.code;
      attributes['mcp.error_message'] = result.error.message;
      span.setStatus({ code: SpanStatusCode.ERROR, message: result.error.message });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    // Add method-specific attributes
    this.addMethodSpecificAttributes(attributes, operationId, result);

    span.setAttributes(attributes as Attributes);
    span.end();

    this.activeSpans.delete(operationId);

    // Add telemetry event
    this.addTelemetryEvent({
      type: TelemetryEventType.REQUEST_END,
      timestamp: result.timestamp,
      data: {
        operationId,
        success: result.success,
        duration: result.duration,
        error: result.error,
        projectId: this.config.projectId
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
  private addMethodSpecificAttributes(
    attributes: MCPSpanAttributes,
    operationId: string,
    result: MCPMethodResult
  ): void {
    const method = this.extractMethodFromOperationId(operationId);

    switch (method) {
      case 'tools/list':
        if (result.data?.tools) {
          attributes['mcp.tools_count'] = Array.isArray(result.data.tools) ? result.data.tools.length : 0;
        }
        break;
      case 'resources/list':
        if (result.data?.resources) {
          attributes['mcp.resources_count'] = Array.isArray(result.data.resources) ? result.data.resources.length : 0;
        }
        break;
      case 'prompts/list':
        if (result.data?.prompts) {
          attributes['mcp.prompts_count'] = Array.isArray(result.data.prompts) ? result.data.prompts.length : 0;
        }
        break;
      case 'tools/call':
        if (result.data?.tool) {
          attributes['mcp.tool_name'] = result.data.tool;
        }
        break;
      case 'resources/read':
        if (result.data?.uri) {
          attributes['mcp.resource_uri'] = result.data.uri;
        }
        break;
      case 'prompts/get':
        if (result.data?.name) {
          attributes['mcp.prompt_name'] = result.data.name;
        }
        break;
    }
  }

  /**
   * Execute before-method hooks
   */
  async executeBeforeHooks(
    context: MCPOperationContext,
    methodCall: MCPMethodCall
  ): Promise<void> {
    for (const hook of this.hooks) {
      if (hook.beforeMethod) {
        try {
          await hook.beforeMethod(context, methodCall);
        } catch (error) {
          console.warn('Error in beforeMethod hook:', error);
        }
      }
    }
  }

  /**
   * Execute after-method hooks
   */
  async executeAfterHooks(
    context: MCPOperationContext,
    result: MCPMethodResult
  ): Promise<void> {
    for (const hook of this.hooks) {
      if (hook.afterMethod) {
        try {
          await hook.afterMethod(context, result);
        } catch (error) {
          console.warn('Error in afterMethod hook:', error);
        }
      }
    }
  }

  /**
   * Execute error hooks
   */
  async executeErrorHooks(
    context: MCPOperationContext,
    error: Error
  ): Promise<void> {
    for (const hook of this.hooks) {
      if (hook.onError) {
        try {
          await hook.onError(context, error);
        } catch (hookError) {
          console.warn('Error in onError hook:', hookError);
        }
      }
    }
  }

  /**
   * Add a telemetry event
   */
  private addTelemetryEvent(event: TelemetryEvent): void {
    this.telemetryEvents.push(event);

    // Keep only recent events to prevent memory leaks
    const maxEvents = 1000;
    if (this.telemetryEvents.length > maxEvents) {
      this.telemetryEvents = this.telemetryEvents.slice(-maxEvents);
    }
  }

  /**
   * Extract method from operation ID
   */
  private extractMethodFromOperationId(operationId: string): string {
    return 'unknown';
  }

  /**
   * Generate a unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): any {
    return {
      totalRequests: this.telemetryEvents.filter(e => e.type === TelemetryEventType.REQUEST_END).length,
      successfulRequests: this.telemetryEvents.filter(e =>
        e.type === TelemetryEventType.REQUEST_END && e.data.success
      ).length,
      failedRequests: this.telemetryEvents.filter(e =>
        e.type === TelemetryEventType.REQUEST_END && !e.data.success
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
  private calculateAverageDuration(): number {
    const completedRequests = this.telemetryEvents.filter(e =>
      e.type === TelemetryEventType.REQUEST_END && e.data.duration
    );

    if (completedRequests.length === 0) return 0;

    const totalDuration = completedRequests.reduce((sum: number, event) => sum + (event.data.duration || 0), 0);
    return totalDuration / completedRequests.length;
  }

  /**
   * Calculate current requests per second
   */
  private calculateRequestsPerSecond(): number {
    const recentEvents = this.telemetryEvents.filter(e =>
      e.type === TelemetryEventType.REQUEST_END &&
      Date.now() - e.timestamp < 60000 // Last minute
    );

    return recentEvents.length / 60; // Per second over last minute
  }

  /**
   * Add an instrumentation hook
   */
  addHook(hook: InstrumentationHook): void {
    this.hooks.push(hook);
  }

  /**
   * Remove an instrumentation hook
   */
  removeHook(hook: InstrumentationHook): void {
    const index = this.hooks.indexOf(hook);
    if (index > -1) {
      this.hooks.splice(index, 1);
    }
  }

  /**
   * Get current telemetry events
   */
  getTelemetryEvents(): TelemetryEvent[] {
    return [...this.telemetryEvents];
  }

  /**
   * Get active span count
   */
  getActiveSpanCount(): number {
    return this.activeSpans.size;
  }

  /**
   * Shutdown the tracker and cleanup resources
   */
  async shutdown(): Promise<void> {
    // End all active spans
    for (const [operationId, span] of this.activeSpans) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Tracker shutdown' });
      span.end();
    }
    this.activeSpans.clear();

    // Clear telemetry events
    this.telemetryEvents.length = 0;
  }

  /**
   * Get the tracer instance for custom instrumentation
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * Get the configuration
   */
  getConfig(): MCPInstrumentationConfig {
    return { ...this.config };
  }
}