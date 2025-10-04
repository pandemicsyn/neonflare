export { MCPTracker } from './core/tracker.js';
export { MCPInstrumentation, createMCPInstrumentation } from './instrumentation/index.js';
export {
  ConsoleTelemetryProvider,
  MemoryTelemetryProvider,
  OTLPTTelemetryProvider,
  CompositeTelemetryProvider
} from './telemetry/providers.js';
export {
  DefaultTelemetryManager,
  TelemetryProviderFactory,
  getTelemetryManager,
  setTelemetryManager,
  resetTelemetryManager
} from './telemetry/manager.js';
export {
  EnvironmentEnrichmentProvider,
  UserContextEnrichmentProvider,
  GeographicEnrichmentProvider,
  CustomEnrichmentProvider,
  CompositeEnrichmentProvider,
  EnrichmentManager,
  getEnrichmentManager,
  setEnrichmentManager,
  resetEnrichmentManager
} from './enrichment/index.js';
export {
  ConfigurationManager,
  getConfigurationManager,
  setConfigurationManager,
  resetConfigurationManager,
  Config
} from './config/index.js';
export {
  createMCPAttributes,
  createErrorAttributes,
  createPerformanceAttributes,
  createCorrelationAttributes,
  sanitizeAttributeValue,
  sanitizeAttributes,
  generateCorrelationId,
  extractCorrelationInfo,
  createSpanLink,
  formatAttributesForLogging,
  createDatabaseAttributes,
  createHTTPRequestAttributes,
  createUserAttributes,
  sanitizeConnectionString,
  createBusinessAttributes,
  mergeAttributes,
  filterAttributes,
  createSpanEvent,
  isValidAttributeKey,
  sanitizeAttributeKeys,
  createTimingAttributes,
  createResourceAttributes,
  createSecurityAttributes,
  createMetricAttributes,
  AttributeManager
} from './utils/index.js';
export {
  MCPError,
  MCPErrorType,
  MCPErrorHandler,
  MCPErrorBoundary,
  MCPErrorRecovery,
  MCPErrorFilter,
  getErrorHandler,
  setErrorHandler,
  resetErrorHandler,
  Errors
} from './core/errors.js';
export {
  PerformanceMonitor,
  PerformanceTimer,
  withPerformanceMonitoring,
  withSyncPerformanceMonitoring,
  getPerformanceMonitor,
  setPerformanceMonitor,
  resetPerformanceMonitor,
  measurePerformance,
  measureSyncPerformance
} from './core/performance.js';
import { createMCPInstrumentation } from './instrumentation/index.js';
import { MCPTracker } from './core/tracker.js';
import { MCPInstrumentation } from './instrumentation/index.js';
import { ContextInjectionMiddleware } from './enrichment/context-injector.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export type {
  MCPInstrumentationConfig,
  MCPOperationContext,
  MCPMethodCall,
  MCPMethodResult,
  MCPSpanAttributes,
  TelemetryEvent,
  EnrichmentData,
  InstrumentationHook,
  InstrumentedMCPServer,
  ContextInjectionConfig
} from './types/index.js';

export {
  injectContextIntoSchema,
  extractContextFromArgs,
  stripContextFromArgs,
  hasContextInjection,
  ContextInjectionMiddleware
} from './enrichment/context-injector.js';

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
export function trackmcp(
  server: Server,
  config?: import('./types/index.js').MCPInstrumentationConfig
): Server {
  const tracker = new MCPTracker(config);
  const instrumentation = new MCPInstrumentation(tracker);
  const contextInjector = new ContextInjectionMiddleware(config?.contextInjection);
  
  // Store instrumentation on server for later access
  (server as any).__neonflare_instrumentation = instrumentation;
  (server as any).__neonflare_tracker = tracker;
  (server as any).__neonflare_context_injector = contextInjector;
  (server as any).__neonflare_config = config;
  
  // Wrap server methods with instrumentation
  wrapServerMethods(server, instrumentation, tracker, contextInjector, config);
  
  return server;
}

/**
 * Wrap MCP server methods with automatic instrumentation
 *
 * Note: Context injection is handled at the application level by modifying
 * tool schemas before calling trackmcp(). The server wrapping focuses on
 * intercepting handler execution for tracing and telemetry.
 */
function wrapServerMethods(
  server: Server,
  instrumentation: MCPInstrumentation,
  tracker: MCPTracker,
  contextInjector: ContextInjectionMiddleware,
  config?: import('./types/index.js').MCPInstrumentationConfig
): void {
  const originalSetRequestHandler = server.setRequestHandler.bind(server);

  // Intercept setRequestHandler to wrap all method handlers
  server.setRequestHandler = function(schema: any, handler: any) {
    const method = schema.shape?.method?.value || 'unknown';

    const wrappedHandler = async (request: any, extra: any) => {
      const requestId = request.id || `req_${Date.now()}`;

      const context = tracker.createOperationContext(method, requestId, request.params);
      const span = tracker.startMCPSpan(method, context);

      // Extract AI context if this is a tool call and context was injected
      let aiContext: string | undefined;

      if (method === 'tools/call' && request.params?.arguments?.context) {
        aiContext = request.params.arguments.context;

        // Add AI context to span
        if (aiContext) {
          span.setAttributes({
            'mcp.tool.ai_context': aiContext,
            'mcp.tool.ai_intent': aiContext.substring(0, 200) // Truncated for storage
          } as any);
        }
      }

      // Add project ID to span if configured
      if (config?.projectId) {
        span.setAttributes({
          'neonflare.project_id': config.projectId
        } as any);
      }

      try {
        // Call original handler
        const result = await handler(request, extra);

        tracker.endMCPSpan(context.operationId, {
          success: true,
          data: result,
          duration: Date.now() - context.startTime,
          timestamp: Date.now()
        });

        return result;
      } catch (error: any) {
        tracker.endMCPSpan(context.operationId, {
          success: false,
          error: {
            code: error.code || 'HANDLER_ERROR',
            message: error.message || 'Handler execution failed',
            details: error
          },
          duration: Date.now() - context.startTime,
          timestamp: Date.now()
        });

        throw error;
      }
    };

    return originalSetRequestHandler(schema, wrappedHandler);
  };
}

/**
 * Get instrumentation instance from an instrumented server
 */
export function getInstrumentation(server: Server): MCPInstrumentation | undefined {
  return (server as any).__neonflare_instrumentation;
}

/**
 * Get tracker instance from an instrumented server
 */
export function getTracker(server: Server): MCPTracker | undefined {
  return (server as any).__neonflare_tracker;
}

/**
 * Get context injector instance from an instrumented server
 */
export function getContextInjector(server: Server): ContextInjectionMiddleware | undefined {
  return (server as any).__neonflare_context_injector;
}
