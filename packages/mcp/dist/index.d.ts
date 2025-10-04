import { Tracer, Span, Attributes, SpanContext, Link } from '@opentelemetry/api';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Rotel-specific configuration options
 */
interface RotelConfig {
    /** Whether to enable rotel instrumentation */
    enabled?: boolean;
    /** Whether to auto-instrument common modules */
    autoInstrument?: boolean;
    /** Specific instrumentations to enable */
    instrumentations?: string[];
    /** Custom rotel configuration */
    config?: Record<string, any>;
}
/**
 * Context injection configuration
 */
interface ContextInjectionConfig$1 {
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
interface MCPInstrumentationConfig {
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
    contextInjection?: ContextInjectionConfig$1;
}
/**
 * Context information for MCP operations
 */
interface MCPOperationContext {
    /** Operation ID for correlation */
    operationId: string;
    /** Client ID that initiated the request */
    clientId?: string;
    /** Session ID for stateful operations */
    sessionId?: string;
    /** Request metadata */
    metadata?: Record<string, any>;
    /** Timestamp when operation started */
    startTime: number;
    /** Parent span context for trace correlation */
    parentSpan?: Span;
}
/**
 * MCP protocol method types that can be instrumented
 */
declare enum MCPMethodType {
    TOOLS_LIST = "tools/list",
    TOOLS_CALL = "tools/call",
    RESOURCES_LIST = "resources/list",
    RESOURCES_READ = "resources/read",
    PROMPTS_LIST = "prompts/list",
    PROMPTS_GET = "prompts/get",
    PING = "ping",
    INITIALIZE = "initialize",
    INITIALIZED = "initialized"
}
/**
 * Information about an MCP method call
 */
interface MCPMethodCall {
    /** The MCP method being called */
    method: MCPMethodType;
    /** Parameters passed to the method */
    params?: Record<string, any>;
    /** Method call metadata */
    metadata?: Record<string, any>;
    /** Timestamp when call was made */
    timestamp: number;
}
/**
 * Result of an MCP method call
 */
interface MCPMethodResult {
    /** Whether the call was successful */
    success: boolean;
    /** Result data if successful */
    data?: any;
    /** Error information if failed */
    error?: {
        code: string | number;
        message: string;
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
interface MCPSpanAttributes extends Record<string, string | number | boolean | undefined> {
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
interface MCPMetrics {
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
declare enum TelemetryEventType {
    REQUEST_START = "request_start",
    REQUEST_END = "request_end",
    ERROR = "error",
    SESSION_START = "session_start",
    SESSION_END = "session_end",
    METRIC_UPDATE = "metric_update"
}
/**
 * Telemetry event data
 */
interface TelemetryEvent {
    /** Event type */
    type: TelemetryEventType;
    /** Timestamp when event occurred */
    timestamp: number;
    /** Event data */
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
interface EnrichmentData {
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
interface InstrumentationHook {
    /** Called before method execution */
    beforeMethod?: (context: MCPOperationContext, methodCall: MCPMethodCall) => Promise<void> | void;
    /** Called after method execution */
    afterMethod?: (context: MCPOperationContext, result: MCPMethodResult) => Promise<void> | void;
    /** Called when an error occurs */
    onError?: (context: MCPOperationContext, error: Error) => Promise<void> | void;
    /** Called to enrich span attributes */
    enrichAttributes?: (context: MCPOperationContext, attributes: MCPSpanAttributes) => Promise<Record<string, any>> | Record<string, any>;
    /** Called to enrich telemetry events */
    enrichEvent?: (event: TelemetryEvent) => Promise<TelemetryEvent> | TelemetryEvent;
}
/**
 * Complete MCP server instance with instrumentation
 */
interface InstrumentedMCPServer {
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
 * Core MCP server tracker that manages OpenTelemetry instrumentation
 */
declare class MCPTracker {
    private tracer;
    private config;
    private hooks;
    private telemetryEvents;
    private activeSpans;
    private startTime;
    constructor(config?: MCPInstrumentationConfig);
    /**
     * Initialize the OpenTelemetry tracer
     */
    private initializeTracer;
    /**
     * Create a new operation context for tracking
     */
    createOperationContext(method: string, requestId?: string, params?: any): MCPOperationContext;
    /**
     * Start a new span for an MCP operation
     */
    startMCPSpan(method: string, context: MCPOperationContext): Span;
    /**
     * End a span with result information
     */
    endMCPSpan(operationId: string, result: MCPMethodResult): void;
    /**
     * Add method-specific attributes to span
     */
    private addMethodSpecificAttributes;
    /**
     * Execute before-method hooks
     */
    executeBeforeHooks(context: MCPOperationContext, methodCall: MCPMethodCall): Promise<void>;
    /**
     * Execute after-method hooks
     */
    executeAfterHooks(context: MCPOperationContext, result: MCPMethodResult): Promise<void>;
    /**
     * Execute error hooks
     */
    executeErrorHooks(context: MCPOperationContext, error: Error): Promise<void>;
    /**
     * Add a telemetry event
     */
    private addTelemetryEvent;
    /**
     * Extract method from operation ID
     */
    private extractMethodFromOperationId;
    /**
     * Generate a unique operation ID
     */
    private generateOperationId;
    /**
     * Get current metrics
     */
    getCurrentMetrics(): any;
    /**
     * Calculate average request duration
     */
    private calculateAverageDuration;
    /**
     * Calculate current requests per second
     */
    private calculateRequestsPerSecond;
    /**
     * Add an instrumentation hook
     */
    addHook(hook: InstrumentationHook): void;
    /**
     * Remove an instrumentation hook
     */
    removeHook(hook: InstrumentationHook): void;
    /**
     * Get current telemetry events
     */
    getTelemetryEvents(): TelemetryEvent[];
    /**
     * Get active span count
     */
    getActiveSpanCount(): number;
    /**
     * Shutdown the tracker and cleanup resources
     */
    shutdown(): Promise<void>;
    /**
     * Get the tracer instance for custom instrumentation
     */
    getTracer(): Tracer;
    /**
     * Get the configuration
     */
    getConfig(): MCPInstrumentationConfig;
}

/**
 * High-level instrumentation API for MCP protocol methods
 */
declare class MCPInstrumentation {
    private tracker;
    private methodContexts;
    constructor(tracker: MCPTracker);
    /**
     * Instrument a tools/list method call
     */
    instrumentToolsList(handler: () => Promise<any>, requestId?: string): Promise<any>;
    /**
     * Instrument a tools/call method call
     */
    instrumentToolsCall(handler: (toolName: string, args: any) => Promise<any>, toolName: string, args: any, requestId?: string): Promise<any>;
    /**
     * Instrument a resources/list method call
     */
    instrumentResourcesList(handler: () => Promise<any>, requestId?: string): Promise<any>;
    /**
     * Instrument a resources/read method call
     */
    instrumentResourcesRead(handler: (uri: string) => Promise<any>, uri: string, requestId?: string): Promise<any>;
    /**
     * Instrument a prompts/list method call
     */
    instrumentPromptsList(handler: () => Promise<any>, requestId?: string): Promise<any>;
    /**
     * Instrument a prompts/get method call
     */
    instrumentPromptsGet(handler: (promptName: string, args?: any) => Promise<any>, promptName: string, args?: any, requestId?: string): Promise<any>;
    /**
     * Instrument a ping method call
     */
    instrumentPing(handler: () => Promise<any>, requestId?: string): Promise<any>;
    /**
     * Generic method instrumentation
     */
    private instrumentMethod;
    /**
     * Add an instrumentation hook
     */
    addHook(hook: InstrumentationHook): void;
    /**
     * Remove an instrumentation hook
     */
    removeHook(hook: InstrumentationHook): void;
    /**
     * Get current metrics
     */
    getMetrics(): any;
    /**
     * Get telemetry events
     */
    getTelemetryEvents(): TelemetryEvent[];
    /**
     * Get active span count
     */
    getActiveSpanCount(): number;
    /**
     * Shutdown instrumentation
     */
    shutdown(): Promise<void>;
    /**
     * Get the underlying tracker instance
     */
    getTracker(): MCPTracker;
}
/**
 * Factory function to create MCP instrumentation
 */
declare function createMCPInstrumentation(config?: MCPInstrumentationConfig): MCPInstrumentation;

/**
 * Interface for collecting and providing metrics
 */
interface MetricsProvider {
    /**
     * Record a telemetry event
     */
    recordEvent(event: TelemetryEvent): void;
    /**
     * Get current metrics
     */
    getMetrics(): MCPMetrics;
    /**
     * Get all recorded events
     */
    getEvents(): TelemetryEvent[];
    /**
     * Shutdown the provider and cleanup resources
     */
    shutdown(): Promise<void>;
}
/**
 * Interface for trace export functionality
 */
interface TraceProvider {
    /**
     * Record a telemetry event for tracing
     */
    recordEvent(event: TelemetryEvent): void;
    /**
     * Get current metrics (may not be applicable for all trace providers)
     */
    getMetrics(): MCPMetrics;
    /**
     * Get all recorded events
     */
    getEvents(): TelemetryEvent[];
    /**
     * Export traces to external systems
     */
    exportTraces(): Promise<void>;
    /**
     * Shutdown the provider and cleanup resources
     */
    shutdown(): Promise<void>;
}
/**
 * Configuration for telemetry providers
 */
interface TelemetryProviderConfig {
    /** Provider type */
    type: 'console' | 'memory' | 'otlp' | 'composite';
    /** Provider-specific configuration */
    config?: {
        /** Console provider config */
        console?: {
            /** Whether to enable colored output */
            colored?: boolean;
            /** Log level */
            level?: 'debug' | 'info' | 'warn' | 'error';
        };
        /** Memory provider config */
        memory?: {
            /** Maximum number of events to keep in memory */
            maxEvents?: number;
            /** Whether to enable event filtering */
            enableFiltering?: boolean;
        };
        /** OTLP provider config */
        otlp?: {
            /** OTLP endpoint URL */
            endpoint?: string;
            /** Headers for OTLP requests */
            headers?: Record<string, string>;
            /** Export timeout in milliseconds */
            timeout?: number;
            /** Whether to use secure connection */
            secure?: boolean;
        };
        /** Composite provider config */
        composite?: {
            /** Child providers to combine */
            providers?: TelemetryProviderConfig[];
        };
    };
}
/**
 * Telemetry manager that coordinates multiple providers
 */
interface TelemetryManager {
    /**
     * Add a provider
     */
    addProvider(provider: MetricsProvider | TraceProvider): void;
    /**
     * Remove a provider
     */
    removeProvider(provider: MetricsProvider | TraceProvider): void;
    /**
     * Get all providers
     */
    getProviders(): (MetricsProvider | TraceProvider)[];
    /**
     * Record event across all providers
     */
    recordEvent(event: TelemetryEvent): void;
    /**
     * Get aggregated metrics from all providers
     */
    getMetrics(): MCPMetrics;
    /**
     * Export traces from all trace providers
     */
    exportTraces(): Promise<void>;
    /**
     * Shutdown all providers
     */
    shutdown(): Promise<void>;
}

/**
 * Console-based telemetry provider for development and debugging
 */
declare class ConsoleTelemetryProvider implements MetricsProvider, TraceProvider {
    private events;
    private startTime;
    recordEvent(event: TelemetryEvent): void;
    getMetrics(): MCPMetrics;
    getEvents(): TelemetryEvent[];
    exportTraces(): Promise<void>;
    shutdown(): Promise<void>;
}
/**
 * In-memory telemetry provider for testing and development
 */
declare class MemoryTelemetryProvider implements MetricsProvider, TraceProvider {
    private events;
    private maxEvents;
    recordEvent(event: TelemetryEvent): void;
    getMetrics(): MCPMetrics;
    getEvents(): TelemetryEvent[];
    private calculateRequestsPerSecond;
    exportTraces(): Promise<void>;
    shutdown(): Promise<void>;
    /**
     * Get events by type
     */
    getEventsByType(type: string): TelemetryEvent[];
    /**
     * Get events within time range
     */
    getEventsInRange(startTime: number, endTime: number): TelemetryEvent[];
    /**
     * Clear all events
     */
    clear(): void;
}
/**
 * OTLP telemetry provider for production trace export
 */
declare class OTLPTTelemetryProvider implements TraceProvider {
    private otlpEndpoint?;
    private headers?;
    constructor(config?: {
        endpoint?: string;
        headers?: Record<string, string>;
    });
    recordEvent(event: TelemetryEvent): void;
    getMetrics(): MCPMetrics;
    getEvents(): TelemetryEvent[];
    exportTraces(): Promise<void>;
    shutdown(): Promise<void>;
}
/**
 * Composite telemetry provider that combines multiple providers
 */
declare class CompositeTelemetryProvider implements MetricsProvider, TraceProvider {
    private providers;
    constructor(providers?: (MetricsProvider | TraceProvider)[]);
    addProvider(provider: MetricsProvider | TraceProvider): void;
    removeProvider(provider: MetricsProvider | TraceProvider): void;
    recordEvent(event: TelemetryEvent): void;
    getMetrics(): MCPMetrics;
    getEvents(): TelemetryEvent[];
    exportTraces(): Promise<void>;
    shutdown(): Promise<void>;
}

/**
 * Factory for creating telemetry providers based on configuration
 */
declare class TelemetryProviderFactory {
    static createProvider(config: TelemetryProviderConfig): MetricsProvider | TraceProvider;
}
/**
 * Default telemetry manager implementation
 */
declare class DefaultTelemetryManager implements TelemetryManager {
    private providers;
    constructor(providers?: (MetricsProvider | TraceProvider)[]);
    addProvider(provider: MetricsProvider | TraceProvider): void;
    removeProvider(provider: MetricsProvider | TraceProvider): void;
    getProviders(): (MetricsProvider | TraceProvider)[];
    recordEvent(event: TelemetryEvent): void;
    getMetrics(): MCPMetrics;
    exportTraces(): Promise<void>;
    shutdown(): Promise<void>;
    /**
     * Create a telemetry manager from configuration
     */
    static fromConfig(config: TelemetryProviderConfig[]): DefaultTelemetryManager;
}
/**
 * Get or create the global telemetry manager
 */
declare function getTelemetryManager(): DefaultTelemetryManager;
/**
 * Set the global telemetry manager
 */
declare function setTelemetryManager(manager: DefaultTelemetryManager): void;
/**
 * Reset the global telemetry manager (mainly for testing)
 */
declare function resetTelemetryManager(): void;

/**
 * Enrichment provider interface for adding contextual data
 */
interface EnrichmentProvider {
    /**
     * Get enrichment data for the current context
     */
    getEnrichmentData(): Promise<EnrichmentData> | EnrichmentData;
    /**
     * Enrich telemetry event with additional context
     */
    enrichEvent(event: TelemetryEvent): Promise<TelemetryEvent> | TelemetryEvent;
    /**
     * Enrich span attributes with additional context
     */
    enrichAttributes(attributes: MCPSpanAttributes): Promise<MCPSpanAttributes> | MCPSpanAttributes;
}
/**
 * Environment enrichment provider that adds system and environment information
 */
declare class EnvironmentEnrichmentProvider implements EnrichmentProvider {
    private environment;
    constructor();
    private getHostname;
    getEnrichmentData(): EnrichmentData;
    enrichEvent(event: TelemetryEvent): TelemetryEvent;
    enrichAttributes(attributes: MCPSpanAttributes): MCPSpanAttributes;
    private getEnvironment;
}
/**
 * User context enrichment provider for tracking user-specific information
 */
declare class UserContextEnrichmentProvider implements EnrichmentProvider {
    private userContext;
    setUserContext(context: {
        userId?: string;
        sessionId?: string;
        clientIp?: string;
        userAgent?: string;
        customTags?: string[];
    }): void;
    clearUserContext(): void;
    getEnrichmentData(): EnrichmentData;
    enrichEvent(event: TelemetryEvent): TelemetryEvent;
    enrichAttributes(attributes: MCPSpanAttributes): MCPSpanAttributes;
}
/**
 * Geographic enrichment provider for location-based context
 */
declare class GeographicEnrichmentProvider implements EnrichmentProvider {
    private location;
    setLocation(location: {
        country?: string;
        region?: string;
        city?: string;
        timezone?: string;
    }): void;
    getEnrichmentData(): EnrichmentData;
    enrichEvent(event: TelemetryEvent): TelemetryEvent;
    enrichAttributes(attributes: MCPSpanAttributes): MCPSpanAttributes;
}
/**
 * Custom enrichment provider for application-specific context
 */
declare class CustomEnrichmentProvider implements EnrichmentProvider {
    private customData;
    setCustomData(data: Record<string, any>): void;
    addCustomField(key: string, value: any): void;
    removeCustomField(key: string): void;
    getEnrichmentData(): EnrichmentData;
    enrichEvent(event: TelemetryEvent): TelemetryEvent;
    enrichAttributes(attributes: MCPSpanAttributes): MCPSpanAttributes;
}
/**
 * Composite enrichment provider that combines multiple providers
 */
declare class CompositeEnrichmentProvider implements EnrichmentProvider {
    private providers;
    constructor(providers?: EnrichmentProvider[]);
    addProvider(provider: EnrichmentProvider): void;
    removeProvider(provider: EnrichmentProvider): void;
    getEnrichmentData(): Promise<EnrichmentData>;
    enrichEvent(event: TelemetryEvent): Promise<TelemetryEvent>;
    enrichAttributes(attributes: MCPSpanAttributes): Promise<MCPSpanAttributes>;
}
/**
 * Enrichment manager for coordinating enrichment providers
 */
declare class EnrichmentManager {
    private compositeProvider;
    constructor();
    /**
     * Add an enrichment provider
     */
    addProvider(provider: EnrichmentProvider): void;
    /**
     * Remove an enrichment provider
     */
    removeProvider(provider: EnrichmentProvider): void;
    /**
     * Get enrichment data from all providers
     */
    getEnrichmentData(): Promise<EnrichmentData>;
    /**
     * Enrich a telemetry event
     */
    enrichEvent(event: TelemetryEvent): Promise<TelemetryEvent>;
    /**
     * Enrich span attributes
     */
    enrichAttributes(attributes: MCPSpanAttributes): Promise<MCPSpanAttributes>;
    /**
     * Set user context across all providers
     */
    setUserContext(context: {
        userId?: string;
        sessionId?: string;
        clientIp?: string;
        userAgent?: string;
        customTags?: string[];
    }): void;
    /**
     * Set geographic location
     */
    setLocation(location: {
        country?: string;
        region?: string;
        city?: string;
        timezone?: string;
    }): void;
    /**
     * Set custom data
     */
    setCustomData(data: Record<string, any>): void;
}
/**
 * Get or create the global enrichment manager
 */
declare function getEnrichmentManager(): EnrichmentManager;
/**
 * Set the global enrichment manager
 */
declare function setEnrichmentManager(manager: EnrichmentManager): void;
/**
 * Reset the global enrichment manager (mainly for testing)
 */
declare function resetEnrichmentManager(): void;

/**
 * Configuration manager for MCP instrumentation settings
 */
declare class ConfigurationManager {
    private config;
    private configFile?;
    private environmentOverrides;
    constructor(config?: MCPInstrumentationConfig);
    /**
     * Load default configuration
     */
    private loadDefaultConfig;
    /**
     * Merge provided configuration with defaults
     */
    private mergeConfig;
    /**
     * Load configuration overrides from environment variables
     */
    private loadEnvironmentOverrides;
    /**
     * Get current configuration
     */
    getConfig(): MCPInstrumentationConfig;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<MCPInstrumentationConfig>): void;
    /**
     * Get specific configuration value
     */
    get<K extends keyof MCPInstrumentationConfig>(key: K): MCPInstrumentationConfig[K];
    /**
     * Set specific configuration value
     */
    set<K extends keyof MCPInstrumentationConfig>(key: K, value: MCPInstrumentationConfig[K]): void;
    /**
     * Load configuration from file
     */
    loadFromFile(filePath: string): Promise<void>;
    /**
     * Save current configuration to file
     */
    saveToFile(filePath?: string): Promise<void>;
    /**
     * Reset configuration to defaults
     */
    reset(): void;
    /**
     * Validate current configuration
     */
    validate(): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Create configuration for different environments
     */
    static forEnvironment(environment: 'development' | 'staging' | 'production'): MCPInstrumentationConfig;
}
/**
 * Get or create the global configuration manager
 */
declare function getConfigurationManager(): ConfigurationManager;
/**
 * Set the global configuration manager
 */
declare function setConfigurationManager(manager: ConfigurationManager): void;
/**
 * Reset the global configuration manager (mainly for testing)
 */
declare function resetConfigurationManager(): void;
/**
 * Quick configuration helpers
 */
declare const Config: {
    /**
     * Create development configuration
     */
    development: () => MCPInstrumentationConfig;
    /**
     * Create staging configuration
     */
    staging: () => MCPInstrumentationConfig;
    /**
     * Create production configuration
     */
    production: () => MCPInstrumentationConfig;
    /**
     * Create minimal configuration
     */
    minimal: () => MCPInstrumentationConfig;
    /**
     * Create full-featured configuration
     */
    full: () => MCPInstrumentationConfig;
};

/**
 * Utility functions for working with OpenTelemetry spans and attributes
 */
/**
 * Create standardized span attributes for MCP operations
 */
declare function createMCPAttributes(method: string, operationId: string, additionalAttributes?: Record<string, string | number | boolean>): MCPSpanAttributes;
/**
 * Create error attributes for failed operations
 */
declare function createErrorAttributes(error: Error | {
    code: string | number;
    message: string;
    details?: any;
}): Partial<MCPSpanAttributes>;
/**
 * Create performance-related attributes
 */
declare function createPerformanceAttributes(duration: number, memoryUsage?: number, cpuUsage?: number): Partial<MCPSpanAttributes>;
/**
 * Create correlation attributes for distributed tracing
 */
declare function createCorrelationAttributes(traceId?: string, spanId?: string, parentSpanId?: string): Partial<MCPSpanAttributes>;
/**
 * Sanitize attribute values to ensure they're valid for OpenTelemetry
 */
declare function sanitizeAttributeValue(value: any): string | number | boolean;
/**
 * Sanitize all attributes in an object
 */
declare function sanitizeAttributes(attributes: Record<string, any>): Attributes;
/**
 * Generate a correlation ID for tracing across service boundaries
 */
declare function generateCorrelationId(): string;
/**
 * Extract correlation information from span context
 */
declare function extractCorrelationInfo(spanContext: SpanContext): {
    traceId: string;
    spanId: string;
    traceFlags: number;
};
/**
 * Create a span link for correlation
 */
declare function createSpanLink(spanContext: SpanContext, attributes?: Attributes): Link;
/**
 * Format span attributes for logging
 */
declare function formatAttributesForLogging(attributes: Attributes): string;
/**
 * Create database operation attributes
 */
declare function createDatabaseAttributes(operation: string, table?: string, rowsAffected?: number, connectionString?: string): Partial<MCPSpanAttributes>;
/**
 * Create HTTP request attributes
 */
declare function createHTTPRequestAttributes(method: string, url: string, statusCode?: number, duration?: number): Partial<MCPSpanAttributes>;
/**
 * Create user interaction attributes
 */
declare function createUserAttributes(userId?: string, sessionId?: string, action?: string): Partial<MCPSpanAttributes>;
/**
 * Sanitize connection string for logging (remove sensitive data)
 */
declare function sanitizeConnectionString(connectionString: string): string;
/**
 * Create business logic attributes
 */
declare function createBusinessAttributes(domain: string, operation: string, entityType?: string, entityId?: string): Partial<MCPSpanAttributes>;
/**
 * Merge multiple attribute objects
 */
declare function mergeAttributes(...attributeObjects: (Attributes | undefined)[]): Attributes;
/**
 * Filter attributes based on patterns
 */
declare function filterAttributes(attributes: Attributes, includePatterns?: string[], excludePatterns?: string[]): Attributes;
/**
 * Create a span event with formatted message
 */
declare function createSpanEvent(name: string, attributes?: Attributes, timestamp?: number): {
    name: string;
    attributes?: Attributes;
    timestamp?: number;
};
/**
 * Validate span attribute key (OpenTelemetry specification)
 */
declare function isValidAttributeKey(key: string): boolean;
/**
 * Validate and sanitize attribute keys
 */
declare function sanitizeAttributeKeys(attributes: Record<string, any>): Attributes;
/**
 * Create a timing attribute for measuring operation duration
 */
declare function createTimingAttributes(operationName: string, startTime: number, endTime?: number): Partial<MCPSpanAttributes>;
/**
 * Create resource usage attributes
 */
declare function createResourceAttributes(resourceType: 'memory' | 'cpu' | 'disk' | 'network', usage: number, unit?: string): Partial<MCPSpanAttributes>;
/**
 * Create security-related attributes
 */
declare function createSecurityAttributes(action: string, resource?: string, userId?: string, success?: boolean): Partial<MCPSpanAttributes>;
/**
 * Create custom metric attributes
 */
declare function createMetricAttributes(metricName: string, value: number, unit?: string, tags?: Record<string, string>): Partial<MCPSpanAttributes>;
/**
 * Utility class for managing span attributes
 */
declare class AttributeManager {
    private attributes;
    set(key: string, value: string | number | boolean): void;
    get(key: string): string | number | boolean | undefined;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    size(): number;
    toAttributes(): Attributes;
    merge(other: AttributeManager): AttributeManager;
    filter(predicate: (key: string, value: any) => boolean): AttributeManager;
}

/**
 * MCP-specific error types
 */
declare enum MCPErrorType {
    INVALID_REQUEST = "invalid_request",
    METHOD_NOT_FOUND = "method_not_found",
    INVALID_PARAMS = "invalid_params",
    INTERNAL_ERROR = "internal_error",
    AUTHENTICATION_FAILED = "authentication_failed",
    AUTHORIZATION_FAILED = "authorization_failed",
    RESOURCE_NOT_FOUND = "resource_not_found",
    RESOURCE_EXHAUSTED = "resource_exhausted",
    TIMEOUT = "timeout",
    CANCELLED = "cancelled",
    CONNECTION_ERROR = "connection_error",
    PROTOCOL_ERROR = "protocol_error"
}
/**
 * MCP-specific error class
 */
declare class MCPError extends Error {
    readonly type: MCPErrorType;
    readonly code: string | number;
    readonly details?: any;
    readonly retryable: boolean;
    readonly timestamp: number;
    constructor(type: MCPErrorType, message: string, code?: string | number, details?: any, retryable?: boolean);
    /**
     * Convert to MCP method result error format
     */
    toMethodResultError(): MCPMethodResult['error'];
    /**
     * Create a user-friendly error message
     */
    toUserMessage(): string;
}
/**
 * Error handler for MCP operations
 */
declare class MCPErrorHandler {
    private errorCounts;
    private lastErrorTime;
    private errorThreshold;
    private timeWindow;
    /**
     * Handle an error in an MCP operation
     */
    handleError(error: Error | MCPError, context?: MCPOperationContext, span?: Span): Promise<MCPError>;
    /**
     * Convert generic error to MCPError
     */
    private convertToMCPError;
    /**
     * Update error statistics
     */
    private updateErrorStats;
    /**
     * Check if we're experiencing an error storm
     */
    private isErrorStorm;
    /**
     * Log error with appropriate level and context
     */
    private logError;
    /**
     * Get error statistics
     */
    getErrorStats(): Record<MCPErrorType, {
        count: number;
        lastOccurrence: number;
    }>;
    /**
     * Reset error statistics
     */
    resetErrorStats(): void;
    /**
     * Set error threshold for storm detection
     */
    setErrorThreshold(threshold: number): void;
    /**
     * Set time window for error counting
     */
    setTimeWindow(windowMs: number): void;
}
/**
 * Error boundary for wrapping MCP operations
 */
declare class MCPErrorBoundary {
    private errorHandler;
    constructor(errorHandler?: MCPErrorHandler);
    /**
     * Execute an operation with error handling
     */
    execute<T>(operation: () => Promise<T>, context?: MCPOperationContext, span?: Span): Promise<T>;
    /**
     * Wrap a synchronous operation with error handling
     */
    executeSync<T>(operation: () => T, context?: MCPOperationContext, span?: Span): T;
    /**
     * Get the error handler instance
     */
    getErrorHandler(): MCPErrorHandler;
}
/**
 * Error recovery strategies
 */
declare class MCPErrorRecovery {
    private recoveryStrategies;
    /**
     * Register a recovery strategy for an error type
     */
    registerRecoveryStrategy(errorType: MCPErrorType, strategy: () => Promise<void>): void;
    /**
     * Attempt to recover from an error
     */
    attemptRecovery(error: MCPError): Promise<boolean>;
    /**
     * Get all registered recovery strategies
     */
    getRecoveryStrategies(): Map<MCPErrorType, () => Promise<void>>;
}
/**
 * Error filter for suppressing known harmless errors
 */
declare class MCPErrorFilter {
    private suppressedErrors;
    private suppressedPatterns;
    /**
     * Suppress an error by message
     */
    suppressError(message: string): void;
    /**
     * Suppress errors matching a pattern
     */
    suppressErrorPattern(pattern: RegExp): void;
    /**
     * Check if an error should be suppressed
     */
    shouldSuppress(error: Error | MCPError): boolean;
    /**
     * Remove suppression for an error message
     */
    unsuppressError(message: string): void;
    /**
     * Remove suppression for an error pattern
     */
    unsuppressErrorPattern(pattern: RegExp): void;
    /**
     * Clear all suppressions
     */
    clearSuppressions(): void;
}
/**
 * Get or create the global error handler
 */
declare function getErrorHandler(): MCPErrorHandler;
/**
 * Set the global error handler
 */
declare function setErrorHandler(handler: MCPErrorHandler): void;
/**
 * Reset the global error handler (mainly for testing)
 */
declare function resetErrorHandler(): void;
/**
 * Convenience functions for creating common MCP errors
 */
declare const Errors: {
    invalidRequest: (message: string, details?: any) => MCPError;
    methodNotFound: (method: string) => MCPError;
    invalidParams: (param: string, details?: any) => MCPError;
    internalError: (message: string, details?: any) => MCPError;
    authenticationFailed: (details?: any) => MCPError;
    authorizationFailed: (resource?: string) => MCPError;
    resourceNotFound: (resource: string) => MCPError;
    resourceExhausted: (resource: string) => MCPError;
    timeout: (operation: string) => MCPError;
    cancelled: (operation: string) => MCPError;
    connectionError: (target: string, details?: any) => MCPError;
    protocolError: (message: string, details?: any) => MCPError;
};

/**
 * Performance monitoring configuration
 */
interface PerformanceConfig {
    /** Whether to enable performance monitoring */
    enabled?: boolean;
    /** Performance thresholds for warnings */
    thresholds?: {
        /** Maximum operation duration in milliseconds */
        maxDuration?: number;
        /** Maximum memory usage in MB */
        maxMemoryUsage?: number;
        /** Maximum CPU usage percentage */
        maxCpuUsage?: number;
    };
    /** Whether to collect system metrics */
    collectSystemMetrics?: boolean;
    /** Performance sampling rate (0.0 to 1.0) */
    samplingRate?: number;
}
/**
 * Performance metrics data
 */
interface PerformanceMetrics {
    /** Operation duration in milliseconds */
    duration: number;
    /** Memory usage in bytes */
    memoryUsage?: number;
    /** CPU usage percentage */
    cpuUsage?: number;
    /** Network latency in milliseconds */
    networkLatency?: number;
    /** Database query time in milliseconds */
    dbQueryTime?: number;
    /** Cache hit rate percentage */
    cacheHitRate?: number;
    /** Error rate percentage */
    errorRate?: number;
    /** Throughput (operations per second) */
    throughput?: number;
}
/**
 * Performance monitor for tracking operation performance
 */
declare class PerformanceMonitor {
    private config;
    private metricsHistory;
    private maxHistorySize;
    constructor(config?: PerformanceConfig);
    /**
     * Monitor the performance of an async operation
     */
    monitorAsync<T>(operation: () => Promise<T>, operationName?: string, context?: MCPOperationContext, span?: Span): Promise<{
        result: T;
        metrics: PerformanceMetrics;
    }>;
    /**
     * Monitor the performance of a synchronous operation
     */
    monitorSync<T>(operation: () => T, operationName?: string, context?: MCPOperationContext, span?: Span): {
        result: T;
        metrics: PerformanceMetrics;
    };
    /**
     * Get current memory usage
     */
    private getMemoryUsage;
    /**
     * Get current CPU usage (async)
     */
    private getCpuUsage;
    /**
     * Get current CPU usage (sync)
     */
    private getCpuUsageSync;
    /**
     * Check performance thresholds and log warnings
     */
    private checkThresholds;
    /**
     * Record performance metrics
     */
    private recordMetrics;
    /**
     * Create performance attributes for span
     */
    private createPerformanceAttributes;
    /**
     * Get performance statistics
     */
    getPerformanceStats(timeRange?: number): {
        averageDuration: number;
        maxDuration: number;
        minDuration: number;
        totalOperations: number;
        slowOperations: number;
    };
    /**
     * Get memory usage trend
     */
    getMemoryTrend(timeRange?: number): Array<{
        timestamp: number;
        usage: number;
    }>;
    /**
     * Clear performance history
     */
    clearHistory(): void;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<PerformanceConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): PerformanceConfig;
}
/**
 * Performance timing decorator for methods
 */
declare function withPerformanceMonitoring(operationName?: string, config?: PerformanceConfig): <T extends (...args: any[]) => any>(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => TypedPropertyDescriptor<T>;
/**
 * Synchronous performance timing decorator
 */
declare function withSyncPerformanceMonitoring(operationName?: string, config?: PerformanceConfig): <T extends (...args: any[]) => any>(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => TypedPropertyDescriptor<T>;
/**
 * Performance measurement utility
 */
declare class PerformanceTimer {
    private startTime;
    private marks;
    constructor();
    /**
     * Mark a point in time
     */
    mark(name: string): void;
    /**
     * Measure duration between two marks
     */
    measure(fromMark: string, toMark?: string): number;
    /**
     * Measure duration from start
     */
    measureFromStart(toMark?: string): number;
    /**
     * Get all marks
     */
    getMarks(): Record<string, number>;
    /**
     * Get elapsed time since start
     */
    getElapsed(): number;
    /**
     * Reset timer
     */
    reset(): void;
}
/**
 * Get or create the global performance monitor
 */
declare function getPerformanceMonitor(): PerformanceMonitor;
/**
 * Set the global performance monitor
 */
declare function setPerformanceMonitor(monitor: PerformanceMonitor): void;
/**
 * Reset the global performance monitor (mainly for testing)
 */
declare function resetPerformanceMonitor(): void;
/**
 * Convenience function for quick performance measurement
 */
declare function measurePerformance<T>(operation: () => Promise<T>, operationName?: string): Promise<{
    result: T;
    duration: number;
}>;
/**
 * Synchronous performance measurement
 */
declare function measureSyncPerformance<T>(operation: () => T, operationName?: string): {
    result: T;
    duration: number;
};

/**
 * Context injection for MCP tool schemas
 *
 * This module provides the critical feature of injecting a "context" parameter
 * into tool schemas, allowing AI assistants to naturally provide their reasoning
 * and intent when calling tools.
 */
interface ContextInjectionConfig {
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
 * Inject a context parameter into a tool's input schema
 */
declare function injectContextIntoSchema(schema: any, config?: ContextInjectionConfig): any;
/**
 * Extract context from tool call arguments
 */
declare function extractContextFromArgs(args: any, parameterName?: string): string | undefined;
/**
 * Remove context parameter from arguments before passing to tool implementation
 */
declare function stripContextFromArgs(args: any, parameterName?: string): any;
/**
 * Validate that a schema has context injection
 */
declare function hasContextInjection(schema: any, parameterName?: string): boolean;
/**
 * Context injection middleware for tool registration
 */
declare class ContextInjectionMiddleware {
    private config;
    constructor(config?: ContextInjectionConfig);
    /**
     * Process a tool schema during registration
     */
    processToolSchema(toolName: string, schema: any): any;
    /**
     * Process tool arguments during execution
     */
    processToolArguments(toolName: string, args: any): {
        context?: string;
        cleanedArgs: any;
    };
    /**
     * Update configuration
     */
    updateConfig(config: Partial<ContextInjectionConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): ContextInjectionConfig;
}

/**
 * Main entry point for MCP server instrumentation
 *
 * Usage:
 * ```typescript
 * import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
 * import { trackmcp } from '@neonflare/mcp';
 *
 * const server = new McpServer({ name: "my-server", version: "1.0.0" });
 * trackmcp(server, {
 *   projectId: "proj_xyz",
 *   serviceName: "my-service",
 *   rotel: { enabled: true },
 *   contextInjection: { enabled: true }
 * });
 * ```
 */
declare function trackmcp(server: Server, config?: MCPInstrumentationConfig): Server;
/**
 * Get instrumentation instance from an instrumented server
 */
declare function getInstrumentation(server: Server): MCPInstrumentation | undefined;
/**
 * Get tracker instance from an instrumented server
 */
declare function getTracker(server: Server): MCPTracker | undefined;
/**
 * Get context injector instance from an instrumented server
 */
declare function getContextInjector(server: Server): ContextInjectionMiddleware | undefined;

export { AttributeManager, CompositeEnrichmentProvider, CompositeTelemetryProvider, Config, ConfigurationManager, ConsoleTelemetryProvider, type ContextInjectionConfig$1 as ContextInjectionConfig, ContextInjectionMiddleware, CustomEnrichmentProvider, DefaultTelemetryManager, type EnrichmentData, EnrichmentManager, EnvironmentEnrichmentProvider, Errors, GeographicEnrichmentProvider, type InstrumentationHook, type InstrumentedMCPServer, MCPError, MCPErrorBoundary, MCPErrorFilter, MCPErrorHandler, MCPErrorRecovery, MCPErrorType, MCPInstrumentation, type MCPInstrumentationConfig, type MCPMethodCall, type MCPMethodResult, type MCPOperationContext, type MCPSpanAttributes, MCPTracker, MemoryTelemetryProvider, OTLPTTelemetryProvider, PerformanceMonitor, PerformanceTimer, type TelemetryEvent, TelemetryProviderFactory, UserContextEnrichmentProvider, createBusinessAttributes, createCorrelationAttributes, createDatabaseAttributes, createErrorAttributes, createHTTPRequestAttributes, createMCPAttributes, createMCPInstrumentation, createMetricAttributes, createPerformanceAttributes, createResourceAttributes, createSecurityAttributes, createSpanEvent, createSpanLink, createTimingAttributes, createUserAttributes, extractContextFromArgs, extractCorrelationInfo, filterAttributes, formatAttributesForLogging, generateCorrelationId, getConfigurationManager, getContextInjector, getEnrichmentManager, getErrorHandler, getInstrumentation, getPerformanceMonitor, getTelemetryManager, getTracker, hasContextInjection, injectContextIntoSchema, isValidAttributeKey, measurePerformance, measureSyncPerformance, mergeAttributes, resetConfigurationManager, resetEnrichmentManager, resetErrorHandler, resetPerformanceMonitor, resetTelemetryManager, sanitizeAttributeKeys, sanitizeAttributeValue, sanitizeAttributes, sanitizeConnectionString, setConfigurationManager, setEnrichmentManager, setErrorHandler, setPerformanceMonitor, setTelemetryManager, stripContextFromArgs, trackmcp, withPerformanceMonitoring, withSyncPerformanceMonitoring };
