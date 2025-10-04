import { Span, Tracer } from '@opentelemetry/api';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Rotel-specific configuration options
 */
export interface RotelConfig {
  /** Whether to enable rotel instrumentation */
  enabled?: boolean;
  /** Whether to auto-instrument common modules */
  autoInstrument?: boolean;
  /** Specific instrumentations to enable */
  instrumentations?: string[];
  /** Custom rotel configuration */
  config?: Record<string, unknown>;
}

/**
 * Context injection configuration
 */
export interface ContextInjectionConfig {
  /** Whether to enable context injection */
  enabled?: boolean;
  /** Description for the context parameter */
  description?: string;
  /** Whether context is required */
  required?: boolean;
  /** Custom parameter name (default: 'context') */
  parameterName?: string;
}

/**
 * Configuration options for MCP server instrumentation
 */
export interface MCPInstrumentationConfig {
  /** Project ID for identifying this service in telemetry */
  projectId?: string;
  /** Service name for tracing */
  serviceName?: string;
  /** Service version for tracing */
  serviceVersion?: string;
  /** OpenTelemetry tracer instance */
  tracer?: Tracer;
  /** Whether to enable tracing (default: true) */
  tracingEnabled?: boolean;
  /** Whether to enable metrics collection (default: false) */
  metricsEnabled?: boolean;
  /** Custom span attributes to add to all traces */
  defaultAttributes?: Record<string, string | number | boolean>;
  /** Sampling rate for traces (0.0 to 1.0) */
  samplingRate?: number;
  /** OTLP endpoint for trace export */
  otlpEndpoint?: string;
  /** Headers for OTLP export */
  otlpHeaders?: Record<string, string>;
  /** Whether to export traces to console (development mode) */
  consoleExport?: boolean;
  /** Request timeout in milliseconds */
  requestTimeout?: number;
  /** Maximum span attribute count */
  maxAttributes?: number;
  /** Maximum span event count */
  maxEvents?: number;
  /** Rotel instrumentation configuration */
  rotel?: RotelConfig;
  /** Context injection configuration for capturing AI intent */
  contextInjection?: ContextInjectionConfig;
}

/**
 * Context information for MCP operations
 */
export interface MCPOperationContext {
  /** Operation ID for correlation */
  operationId: string;
  /** Client ID that initiated the request */
  clientId?: string;
  /** Session ID for stateful operations */
  sessionId?: string;
  /** Request metadata */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  /** Timestamp when operation started */
  startTime: number;
  /** Parent span context for trace correlation */
  parentSpan?: Span;
}

/**
 * MCP protocol method types that can be instrumented
 */
export enum MCPMethodType {
  TOOLS_LIST = 'tools/list',
  TOOLS_CALL = 'tools/call',
  RESOURCES_LIST = 'resources/list',
  RESOURCES_READ = 'resources/read',
  PROMPTS_LIST = 'prompts/list',
  PROMPTS_GET = 'prompts/get',
  PING = 'ping',
  INITIALIZE = 'initialize',
  INITIALIZED = 'initialized'
}

/**
 * Information about an MCP method call
 */
export interface MCPMethodCall {
  /** The MCP method being called */
  method: MCPMethodType;
  /** Parameters passed to the method */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
  /** Method call metadata */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  /** Timestamp when call was made */
  timestamp: number;
}

/**
 * Result of an MCP method call
 */
export interface MCPMethodResult {
  /** Whether the call was successful */
  success: boolean;
  /** Result data if successful */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  /** Error information if failed */
  error?: {
    code: string | number;
    message: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details?: any;
  };
  /** Duration of the method call in milliseconds */
  duration: number;
  /** Timestamp when result was received */
  timestamp: number;
}

/**
 * Span attributes specific to MCP operations
 */
export interface MCPSpanAttributes extends Record<string, string | number | boolean | undefined> {
  /** MCP method being executed */
  'mcp.method': string;
  /** Client identifier */
  'mcp.client_id'?: string;
  /** Session identifier */
  'mcp.session_id'?: string;
  /** Operation success status */
  'mcp.success': boolean;
  /** Operation duration in milliseconds */
  'mcp.duration_ms': number;
  /** Error code if operation failed */
  'mcp.error_code'?: string | number;
  /** Error message if operation failed */
  'mcp.error_message'?: string;
  /** Number of tools available (for tools/list) */
  'mcp.tools_count'?: number;
  /** Number of resources available (for resources/list) */
  'mcp.resources_count'?: number;
  /** Number of prompts available (for prompts/list) */
  'mcp.prompts_count'?: number;
  /** Tool name (for tools/call) */
  'mcp.tool_name'?: string;
  /** Resource URI (for resources/read) */
  'mcp.resource_uri'?: string;
  /** Prompt name (for prompts/get) */
  'mcp.prompt_name'?: string;
}

/**
 * Metrics data for MCP server operations
 */
export interface MCPMetrics {
  /** Total number of requests processed */
  totalRequests: number;
  /** Number of successful requests */
  successfulRequests: number;
  /** Number of failed requests */
  failedRequests: number;
  /** Average request duration in milliseconds */
  averageDuration: number;
  /** Requests per second (current rate) */
  requestsPerSecond: number;
  /** Active sessions count */
  activeSessions: number;
  /** Method-specific metrics */
  methodMetrics: Record<MCPMethodType, {
    count: number;
    averageDuration: number;
    errorCount: number;
  }>;
}

/**
 * Telemetry event types
 */
export enum TelemetryEventType {
  REQUEST_START = 'request_start',
  REQUEST_END = 'request_end',
  ERROR = 'error',
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  METRIC_UPDATE = 'metric_update'
}

/**
 * Telemetry event data
 */
export interface TelemetryEvent {
  /** Event type */
  type: TelemetryEventType;
  /** Timestamp when event occurred */
  timestamp: number;
  /** Event data */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  /** Associated span context */
  spanContext?: {
    traceId: string;
    spanId: string;
  };
}

/**
 * Enrichment data for enhancing telemetry
 */
export interface EnrichmentData {
  /** User agent information */
  userAgent?: string;
  /** Client IP address */
  clientIp?: string;
  /** Geographic location data */
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  /** Custom tags for categorization */
  tags?: string[];
  /** Business context information */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessContext?: Record<string, any>;
  /** Performance metrics */
  performance?: {
    memoryUsage?: number;
    cpuUsage?: number;
    networkLatency?: number;
  };
}

/**
 * Instrumentation hook for customizing behavior
 */
export interface InstrumentationHook {
  /** Called before method execution */
  beforeMethod?: (context: MCPOperationContext, methodCall: MCPMethodCall) => Promise<void> | void;
  /** Called after method execution */
  afterMethod?: (context: MCPOperationContext, result: MCPMethodResult) => Promise<void> | void;
  /** Called when an error occurs */
  onError?: (context: MCPOperationContext, error: Error) => Promise<void> | void;
  /** Called to enrich span attributes */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enrichAttributes?: (context: MCPOperationContext, attributes: MCPSpanAttributes) => Promise<Record<string, any>> | Record<string, any>;
  /** Called to enrich telemetry events */
  enrichEvent?: (event: TelemetryEvent) => Promise<TelemetryEvent> | TelemetryEvent;
}

/**
 * Complete MCP server instance with instrumentation
 */
export interface InstrumentedMCPServer {
  /** The original MCP server instance */
  server: Server;
  /** Instrumentation configuration */
  config: MCPInstrumentationConfig;
  /** Current operation context */
  context?: MCPOperationContext;
  /** Instrumentation hooks */
  hooks?: InstrumentationHook[];
  /** Telemetry data */
  telemetry: {
    metrics: MCPMetrics;
    events: TelemetryEvent[];
  };
}

/**
 * Factory function type for creating instrumented servers
 */
export type MCPInstrumentationFactory = (
  server: Server,
  config?: MCPInstrumentationConfig
) => Promise<InstrumentedMCPServer>;