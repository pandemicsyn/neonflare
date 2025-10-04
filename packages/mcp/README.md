# @neonflare/mcp

MCP server instrumentation with OpenTelemetry via rotel.

## Installation

```bash
npm install @neonflare/mcp
# or
yarn add @neonflare/mcp
# or
pnpm add @neonflare/mcp
```

## Features

- 🚀 **OpenTelemetry Integration**: Full OpenTelemetry tracing support for MCP servers
- 📊 **Performance Monitoring**: Built-in performance tracking and metrics collection
- 🔧 **Error Handling**: Comprehensive error tracking and recovery mechanisms
- 🎯 **Method Instrumentation**: Easy-to-use decorators for MCP protocol methods
- 📈 **Telemetry Export**: Multiple telemetry providers (Console, Memory, OTLP)
- 🌍 **Context Enrichment**: Automatic enrichment with environment and user context
- ⚙️ **Configuration Management**: Environment-based configuration with validation
- 🛠️ **Developer Tools**: Rich utilities for span attributes and correlation

## Quick Start

### Basic Usage

```typescript
import { createMCPInstrumentation } from '@neonflare/mcp';

// Create instrumentation instance
const instrumentation = createMCPInstrumentation({
  serviceName: 'my-mcp-server',
  serviceVersion: '1.0.0',
  consoleExport: true // Enable console logging for development
});

// Instrument your MCP methods
const instrumentedToolsList = await instrumentation.instrumentToolsList(async () => {
  // Your tools list logic here
  return { tools: [] };
});

const instrumentedToolsCall = await instrumentation.instrumentToolsCall(
  async (toolName, args) => {
    // Your tool execution logic here
    return { result: 'success' };
  },
  'my-tool',
  { param: 'value' }
);
```

### Advanced Configuration

```typescript
import { ConfigurationManager, Config } from '@neonflare/mcp';

// Use environment-specific configuration
const configManager = new ConfigurationManager(Config.production());

// Or create custom configuration
const customConfig = {
  serviceName: 'my-service',
  serviceVersion: '2.0.0',
  tracingEnabled: true,
  metricsEnabled: true,
  samplingRate: 0.1,
  otlpEndpoint: 'http://collector:4317',
  rotel: {
    enabled: true,
    autoInstrument: true,
    instrumentations: ['http', 'fs', 'dns']
  }
};

const instrumentation = createMCPInstrumentation(customConfig);
```

### Error Handling

```typescript
import { MCPError, Errors, MCPErrorBoundary } from '@neonflare/mcp';

try {
  await instrumentation.instrumentToolsCall(async () => {
    throw Errors.invalidParams('toolName');
  }, 'my-tool', {});
} catch (error) {
  if (error instanceof MCPError) {
    console.log('MCP Error:', error.type, error.message);
    console.log('Retryable:', error.retryable);
  }
}

// Or use error boundary
const errorBoundary = new MCPErrorBoundary();
const result = await errorBoundary.execute(async () => {
  // Your operation here
  return await riskyOperation();
});
```

### Performance Monitoring

```typescript
import { PerformanceMonitor, withPerformanceMonitoring } from '@neonflare/mcp';

const monitor = new PerformanceMonitor({
  enabled: true,
  thresholds: {
    maxDuration: 1000, // Warn if operations take longer than 1s
    maxMemoryUsage: 50 // Warn if memory usage exceeds 50MB
  }
});

// Monitor async operations
const { result, metrics } = await monitor.monitorAsync(
  async () => {
    // Your operation here
    return await longRunningOperation();
  },
  'long-running-operation'
);

// Monitor sync operations
const { result: syncResult, metrics: syncMetrics } = monitor.monitorSync(
  () => {
    return cpuIntensiveOperation();
  },
  'cpu-intensive-operation'
);

// Use decorators for automatic monitoring
class MyService {
  @withPerformanceMonitoring('database-query')
  async queryDatabase() {
    // This method will be automatically monitored
    return this.db.query('SELECT * FROM users');
  }
}
```

### Context Enrichment

```typescript
import { getEnrichmentManager } from '@neonflare/mcp';

const enrichment = getEnrichmentManager();

// Set user context
enrichment.setUserContext({
  userId: 'user123',
  sessionId: 'session456',
  clientIp: '192.168.1.1',
  userAgent: 'MyApp/1.0',
  customTags: ['premium', 'beta-tester']
});

// Set geographic location
enrichment.setLocation({
  country: 'US',
  region: 'CA',
  city: 'San Francisco',
  timezone: 'America/Los_Angeles'
});

// Set custom business context
enrichment.setCustomData({
  tenantId: 'tenant123',
  featureFlags: ['new-ui', 'analytics'],
  experimentGroup: 'group-a'
});
```

### Telemetry Providers

```typescript
import {
  ConsoleTelemetryProvider,
  MemoryTelemetryProvider,
  OTLPTTelemetryProvider,
  CompositeTelemetryProvider
} from '@neonflare/mcp';

// Console provider (development)
const consoleProvider = new ConsoleTelemetryProvider();

// Memory provider (testing)
const memoryProvider = new MemoryTelemetryProvider({
  maxEvents: 5000
});

// OTLP provider (production)
const otlpProvider = new OTLPTTelemetryProvider({
  endpoint: 'http://collector:4317',
  headers: {
    'authorization': 'Bearer your-token'
  }
});

// Composite provider (multiple providers)
const compositeProvider = new CompositeTelemetryProvider([
  consoleProvider,
  memoryProvider,
  otlpProvider
]);
```

### Utility Functions

```typescript
import {
  createMCPAttributes,
  generateCorrelationId,
  sanitizeAttributes,
  AttributeManager
} from '@neonflare/mcp';

// Create standardized attributes
const attributes = createMCPAttributes('tools/call', 'op123', {
  'tool.name': 'my-tool',
  'tool.version': '1.0'
});

// Generate correlation IDs
const correlationId = generateCorrelationId();

// Sanitize attributes
const safeAttributes = sanitizeAttributes(userProvidedAttributes);

// Use attribute manager
const attrManager = new AttributeManager();
attrManager.set('user.id', 'user123');
attrManager.set('operation.type', 'batch');
const allAttributes = attrManager.toAttributes();
```

## API Reference

### Core Classes

#### `MCPTracker`
Core tracker for managing OpenTelemetry spans and telemetry.

```typescript
class MCPTracker {
  constructor(config?: MCPInstrumentationConfig);
  createOperationContext(method: string, requestId?: string, params?: any): MCPOperationContext;
  startMCPSpan(method: string, context: MCPOperationContext): Span;
  endMCPSpan(operationId: string, result: MCPMethodResult): void;
  addHook(hook: InstrumentationHook): void;
  getCurrentMetrics(): MCPMetrics;
  shutdown(): Promise<void>;
}
```

#### `MCPInstrumentation`
High-level API for instrumenting MCP protocol methods.

```typescript
class MCPInstrumentation {
  constructor(tracker: MCPTracker);
  instrumentToolsList(handler: () => Promise<any>, requestId?: string): Promise<any>;
  instrumentToolsCall(handler: (toolName: string, args: any) => Promise<any>, toolName: string, args: any, requestId?: string): Promise<any>;
  instrumentResourcesList(handler: () => Promise<any>, requestId?: string): Promise<any>;
  instrumentResourcesRead(handler: (uri: string) => Promise<any>, uri: string, requestId?: string): Promise<any>;
  instrumentPromptsList(handler: () => Promise<any>, requestId?: string): Promise<any>;
  instrumentPromptsGet(handler: (promptName: string, args?: any) => Promise<any>, promptName: string, args?: any, requestId?: string): Promise<any>;
  instrumentPing(handler: () => Promise<any>, requestId?: string): Promise<any>;
}
```

#### `ConfigurationManager`
Manages configuration settings with environment variable support.

```typescript
class ConfigurationManager {
  constructor(config?: MCPInstrumentationConfig);
  getConfig(): MCPInstrumentationConfig;
  updateConfig(config: Partial<MCPInstrumentationConfig>): void;
  validate(): { valid: boolean; errors: string[] };
  static forEnvironment(environment: 'development' | 'staging' | 'production'): MCPInstrumentationConfig;
}
```

### Error Handling

#### `MCPError`
Specialized error class for MCP operations.

```typescript
class MCPError extends Error {
  readonly type: MCPErrorType;
  readonly code: string | number;
  readonly details?: any;
  readonly retryable: boolean;
  toMethodResultError(): MCPMethodResult['error'];
  toUserMessage(): string;
}
```

#### `MCPErrorBoundary`
Error boundary for wrapping operations with error handling.

```typescript
class MCPErrorBoundary {
  execute<T>(operation: () => Promise<T>, context?: MCPOperationContext, span?: Span): Promise<T>;
  executeSync<T>(operation: () => T, context?: MCPOperationContext, span?: Span): T;
}
```

### Performance Monitoring

#### `PerformanceMonitor`
Monitors operation performance and collects metrics.

```typescript
class PerformanceMonitor {
  constructor(config?: PerformanceConfig);
  monitorAsync<T>(operation: () => Promise<T>, operationName?: string, context?: MCPOperationContext, span?: Span): Promise<{ result: T; metrics: PerformanceMetrics }>;
  monitorSync<T>(operation: () => T, operationName?: string, context?: MCPOperationContext, span?: Span): { result: T; metrics: PerformanceMetrics };
  getPerformanceStats(timeRange?: number): PerformanceStats;
}
```

### Enrichment

#### `EnrichmentManager`
Manages contextual data enrichment for telemetry.

```typescript
class EnrichmentManager {
  setUserContext(context: { userId?: string; sessionId?: string; clientIp?: string; userAgent?: string; customTags?: string[] }): void;
  setLocation(location: { country?: string; region?: string; city?: string; timezone?: string }): void;
  setCustomData(data: Record<string, any>): void;
  getEnrichmentData(): Promise<EnrichmentData>;
}
```

## Environment Variables

Configure the library using environment variables:

```bash
# OpenTelemetry settings
export OTEL_SERVICE_NAME="my-mcp-server"
export OTEL_SERVICE_VERSION="1.0.0"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://collector:4317"
export OTEL_EXPORTER_OTLP_HEADERS='{"authorization":"Bearer token"}'

# Neonflare settings
export NEONFLARE_TRACING_ENABLED="true"
export NEONFLARE_METRICS_ENABLED="true"
export NEONFLARE_SAMPLING_RATE="0.1"
export NEONFLARE_REQUEST_TIMEOUT="30000"
export NEONFLARE_CONSOLE_EXPORT="true"

# Rotel settings
export NEONFLARE_ROTEL_ENABLED="true"
export NEONFLARE_ROTEL_AUTO_INSTRUMENT="true"
```

## Examples

See the `examples/` directory for complete usage examples:

- [Basic Usage](./examples/basic-usage.ts) - Simple instrumentation example
- [Advanced Configuration](./examples/advanced-config.ts) - Complex configuration scenarios
- [Error Handling](./examples/error-handling.ts) - Comprehensive error handling
- [Performance Monitoring](./examples/performance-monitoring.ts) - Performance tracking examples
- [Custom Enrichment](./examples/custom-enrichment.ts) - Context enrichment examples

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Run tests: `npm test`
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
