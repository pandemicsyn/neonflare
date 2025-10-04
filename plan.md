# Neonflare MCP Instrumentation - Implementation Plan

## Overview

Neonflare is a TypeScript package that instruments MCP (Model Context Protocol) servers with OpenTelemetry tracing via rotel. It provides observability into MCP server usage patterns, performance metrics, and user interactions.

## Project Structure

```
neonflare/
├── src/
│   ├── index.ts                 # Main entry point, exports trackmcp
│   ├── core/
│   │   ├── tracer.ts           # OpenTelemetry tracer initialization
│   │   ├── rotel-manager.ts    # Rotel instance management
│   │   └── constants.ts        # Configuration constants
│   ├── instrumentation/
│   │   ├── server-wrapper.ts   # MCP server wrapping logic
│   │   ├── tool-interceptor.ts # Tool call interception
│   │   ├── resource-interceptor.ts # Resource access interception
│   │   ├── prompt-interceptor.ts   # Prompt execution interception
│   │   └── transport-interceptor.ts # Transport layer monitoring
│   ├── telemetry/
│   │   ├── span-builder.ts     # OpenTelemetry span creation
│   │   ├── attributes.ts       # Span attribute definitions
│   │   ├── events.ts           # Event tracking utilities
│   │   └── context-propagation.ts # Context management
│   ├── enrichment/
│   │   ├── context-injector.ts # Inject context parameter into tools
│   │   ├── metadata-collector.ts # Collect client/session metadata
│   │   └── error-handler.ts    # Error tracking and recovery
│   ├── config/
│   │   ├── options.ts          # Configuration interfaces
│   │   ├── validator.ts        # Configuration validation
│   │   └── defaults.ts         # Default configuration values
│   ├── types/
│   │   ├── mcp.ts             # MCP type extensions
│   │   ├── telemetry.ts       # Telemetry type definitions
│   │   └── config.ts          # Configuration types
│   └── utils/
│       ├── async-queue.ts      # Event buffering
│       ├── redaction.ts        # Sensitive data redaction
│       └── logger.ts           # Internal logging
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── examples/
│   ├── basic-usage/
│   ├── custom-exporters/
│   └── advanced-configuration/
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
├── jest.config.js
└── README.md
```

## Core Components

### 1. MCP Server Instrumentation

#### Server Wrapping
- Use Proxy pattern to intercept server method calls
- Preserve original server functionality
- Support both `McpServer` and legacy `Server` classes
- Handle async/sync method variations

#### Tool Interception
- Intercept `registerTool()` and `setRequestHandler(CallToolRequestSchema)`
- Inject context parameter into tool schemas for intent tracking
- Capture tool arguments, results, and errors
- Measure execution timing

#### Resource Monitoring
- Track `registerResource()` calls
- Monitor resource list/read operations
- Capture URI patterns and access frequency

#### Prompt Tracking
- Track prompt registrations and invocations
- Capture prompt parameters and results

### 2. OpenTelemetry Integration via Rotel

#### Rotel Configuration
```typescript
interface RotelConfig {
  enabled: boolean;
  exporter: {
    endpoint: string;
    protocol: 'grpc' | 'http';
    headers?: Record<string, string>;
  };
  serviceName?: string;
  environment?: string;
}
```

#### Span Management
- Root span for MCP sessions
- Child spans for individual operations
- Proper context propagation
- Span attributes following OpenTelemetry semantic conventions

#### Exporter Support
- Rotel handles the OpenTelemetry export to any OTLP-compatible backend
- OTLP as default protocol (both HTTP and gRPC)
- Pluggable configuration for different telemetry backends

### 3. Context Enrichment

#### Intent Tracking
```typescript
interface ContextInjection {
  injectContext: boolean;
  contextDescription?: string;
  contextRequired?: boolean;
}
```
- Inject a `context` parameter into tool schemas
- AI assistants naturally provide reasoning in this field
- Extract intent without affecting tool implementation

#### Session Management
- Session ID generation and tracking
- Session timeout detection
- Session metadata collection (client info, duration, tool sequences)

#### Client Identification
- Extract client information from transport layer
- Support for Claude, Cursor, Cline, and other MCP clients
- Custom client identification callback option

### 4. API Design

#### Primary API
```typescript
import { trackmcp } from '@neonflare/mcp';

// Basic usage
trackmcp(mcpServer, {
  projectId: 'proj_xyz',
  rotel: {
    endpoint: 'https://your-telemetry-backend.com',
    protocol: 'http', // or 'grpc'
    headers: {
      // Any headers required by your telemetry backend
      'Authorization': 'Bearer token'
    }
  }
});

// Advanced configuration
trackmcp(mcpServer, {
  projectId: 'proj_xyz',
  rotel: { /* rotel config */ },
  
  // Optional configurations
  contextInjection: {
    enabled: true,
    description: 'Explain why you are calling this tool'
  },
  
  redaction: {
    patterns: [/password/gi, /api[_-]?key/gi],
    customRedactor: (data) => { /* custom logic */ }
  },
  
  identify: async (request) => {
    // Custom user identification
    return {
      userId: 'user123',
      metadata: { /* custom data */ }
    };
  },
  
  exporters: {
    // Additional exporters beyond rotel
    custom: new CustomExporter()
  }
});
```

### 5. Performance Considerations

#### Async Processing
- Event queue with configurable size (default 10,000)
- Background worker for telemetry submission
- Non-blocking instrumentation

#### Resource Management
- Configurable buffer limits
- Automatic cleanup of stale data
- Memory-efficient span storage

#### Error Handling
- Graceful degradation on telemetry failures
- Circuit breaker for failed endpoints
- Local buffering during network outages

### 6. TypeScript Architecture

#### Type Definitions
```typescript
// Core types
interface NeonflareConfig {
  projectId: string;
  rotel: RotelConfig;
  contextInjection?: ContextInjectionConfig;
  redaction?: RedactionConfig;
  identify?: IdentifyFunction;
  exporters?: ExporterConfig;
  performance?: PerformanceConfig;
}

interface MCPSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: 'tool' | 'resource' | 'prompt' | 'session';
  startTime: number;
  endTime?: number;
  attributes: Record<string, any>;
  events: SpanEvent[];
  status: SpanStatus;
}

interface ToolInvocation {
  name: string;
  arguments: Record<string, any>;
  context?: string;
  result?: any;
  error?: Error;
  duration: number;
  timestamp: number;
}
```

#### Module Exports
```typescript
// Main exports from index.ts
export { trackmcp } from './core/tracker';
export { NeonflareConfig, MCPSpan, ToolInvocation } from './types';
export { createCustomExporter } from './telemetry/exporters';
export { withRedaction } from './utils/redaction';
```

## Technical Dependencies

### Core Dependencies (packages/mcp)
- `@modelcontextprotocol/sdk`: ^1.18.0 (peer dependency)
- `@streamfold/rotel`: Latest
- `@opentelemetry/api`: ^1.9.0
- `@opentelemetry/sdk-trace-node`: ^1.25.0
- `@opentelemetry/exporter-trace-otlp-grpc`: ^0.52.0
- `@opentelemetry/semantic-conventions`: ^1.25.0

### Development Dependencies
- `typescript`: ^5.3.0
- `@types/node`: ^20.0.0
- `jest`: ^29.0.0
- `@typescript-eslint/eslint-plugin`: Latest
- `prettier`: Latest

## Implementation Details

### Server Wrapping Strategy

```typescript
// server-wrapper.ts
export function wrapMCPServer(server: MCPServer, config: NeonflareConfig): MCPServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      
      if (prop === 'registerTool') {
        return wrapRegisterTool(original, config);
      }
      
      if (prop === 'setRequestHandler') {
        return wrapRequestHandler(original, config);
      }
      
      return original;
    }
  });
}
```

### Context Injection Implementation

```typescript
// context-injector.ts
export function injectContextIntoSchema(schema: any): any {
  return {
    ...schema,
    properties: {
      ...schema.properties,
      context: {
        type: 'string',
        description: 'Describe why you are calling this tool and what you hope to accomplish'
      }
    },
    required: [...(schema.required || []), 'context']
  };
}
```

### Span Creation Pattern

```typescript
// span-builder.ts
export function createToolSpan(
  tracer: Tracer,
  tool: string,
  args: any,
  context?: string
): Span {
  const span = tracer.startSpan(`mcp.tool.${tool}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'mcp.tool.name': tool,
      'mcp.tool.context': context,
      'mcp.tool.args': JSON.stringify(args)
    }
  });
  
  return span;
}
```

### Rotel Integration

```typescript
// rotel-manager.ts
export class RotelManager {
  private rotel: Rotel;
  private provider: NodeTracerProvider;
  
  constructor(config: RotelConfig) {
    this.rotel = new Rotel({
      enabled: config.enabled,
      exporter: config.exporter
    });
    
    this.provider = this.initializeProvider();
  }
  
  private initializeProvider(): NodeTracerProvider {
    const exporter = new OTLPTraceExporter({
      url: 'http://127.0.0.1:4317' // Local rotel endpoint
    });
    
    const provider = new NodeTracerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.config.serviceName || 'mcp-server'
      }),
      spanProcessors: [new SimpleSpanProcessor(exporter)]
    });
    
    provider.register();
    return provider;
  }
  
  start(): void {
    this.rotel.start();
  }
  
  stop(): void {
    this.provider.shutdown();
    this.rotel.stop();
  }
}
```

## Testing Strategy

### Unit Tests
- Test each interceptor in isolation
- Mock MCP server interfaces
- Verify span creation and attributes
- Test configuration validation

### Integration Tests
- Full MCP server with neonflare instrumentation
- Verify end-to-end telemetry flow
- Test with different MCP server implementations
- Performance benchmarks

### Example Test
```typescript
describe('ToolInterceptor', () => {
  it('should inject context into tool schema', () => {
    const originalSchema = {
      type: 'object',
      properties: {
        query: { type: 'string' }
      }
    };
    
    const modified = injectContextIntoSchema(originalSchema);
    
    expect(modified.properties.context).toBeDefined();
    expect(modified.required).toContain('context');
  });
});
```

## Documentation Structure

### Quick Start Guide (docs/getting-started.md)
```markdown
# Getting Started with @neonflare/mcp

## Installation

\`\`\`bash
npm install @neonflare/mcp
# or
yarn add @neonflare/mcp
# or
pnpm add @neonflare/mcp
\`\`\`

## Basic Usage

@neonflare/mcp works with both the low-level `Server` class and the high-level `McpServer` class from the MCP SDK.

### Using with Low-level Server

\`\`\`typescript
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { trackmcp } from '@neonflare/mcp';

// Create your MCP server
const server = new Server({
  name: "my-mcp-server",
  version: "1.0.0"
});

// Add neonflare instrumentation
trackmcp(server, {
  projectId: "proj_xyz",
  rotel: {
    endpoint: process.env.OTEL_EXPORTER_ENDPOINT,
    protocol: "http", // or "grpc"
    headers: {
      // Add any headers required by your telemetry backend
      "Authorization": "Bearer " + process.env.OTEL_AUTH_TOKEN
    }
  }
});

// Set up your handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [...] };
});

// Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);
\`\`\`

### Using with High-level McpServer

\`\`\`typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { trackmcp } from '@neonflare/mcp';

// Create your MCP server
const server = new McpServer({
  name: "my-mcp-server",
  version: "1.0.0"
});

// Add neonflare instrumentation
trackmcp(server, {
  projectId: "proj_xyz",
  rotel: {
    endpoint: process.env.OTEL_EXPORTER_ENDPOINT,
    protocol: "http", // or "grpc"
    headers: {
      // Add any headers required by your telemetry backend
      "Authorization": "Bearer " + process.env.OTEL_AUTH_TOKEN
    }
  }
});

// Register tools using the high-level API
server.registerTool("search", {
  description: "Search for information",
  inputSchema: {
    query: z.string()
  }
}, async ({ query }) => {
  // Tool implementation
  return { content: [{ type: "text", text: results }] };
});

// Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);
\`\`\`

## Environment Variables

\`\`\`bash
# Required
NEONFLARE_PROJECT_ID=proj_xyz
OTEL_EXPORTER_ENDPOINT=https://your-telemetry-backend.com

# Optional
OTEL_AUTH_TOKEN=your_auth_token
NEONFLARE_ENABLED=true  # Enable/disable instrumentation
NEONFLARE_ENV=production  # Environment name
\`\`\`

## Next Steps

- [Configuration Options](./configuration.md)
- [Advanced Usage](./advanced-usage.md)
- [Custom Exporters](./custom-exporters.md)
\`\`\`

### Configuration Guide (docs/configuration.md)
```markdown
# Configuration

## Full Configuration Options

\`\`\`typescript
import { trackmcp } from 'neonflare';

trackmcp(server, {
  // Required
  projectId: 'proj_xyz',
  
  // Rotel configuration for OpenTelemetry
  rotel: {
    enabled: true,
    endpoint: 'https://your-telemetry-backend.com',
    protocol: 'http', // or 'grpc'
    headers: {
      // Headers for your telemetry backend
      'Authorization': 'Bearer token'
    },
    serviceName: 'my-mcp-server',
    environment: 'production'
  },
  
  // Context injection settings
  contextInjection: {
    enabled: true,
    description: 'Explain why you are calling this tool',
    required: false
  },
  
  // Data redaction
  redaction: {
    patterns: [/password/gi, /api[_-]?key/gi],
    fields: ['authorization', 'secret'],
    customRedactor: (data) => {
      // Custom redaction logic
      return data;
    }
  },
  
  // User identification
  identify: async (request) => {
    return {
      userId: 'user123',
      userName: 'John Doe',
      metadata: {
        team: 'engineering'
      }
    };
  },
  
  // Performance settings
  performance: {
    queueSize: 10000,
    flushInterval: 5000,
    maxRetries: 3
  }
});
\`\`\`

## Using Multiple Exporters

\`\`\`typescript
import { trackmcp, createCustomExporter } from '@neonflare/mcp';

trackmcp(server, {
  projectId: 'proj_xyz',
  rotel: { /* ... */ },
  
  exporters: {
    datadog: createCustomExporter({
      type: 'datadog',
      apiKey: process.env.DD_API_KEY,
      site: 'datadoghq.com'
    }),
    
    sentry: createCustomExporter({
      type: 'sentry',
      dsn: process.env.SENTRY_DSN,
      environment: 'production'
    })
  }
});
\`\`\`
\`\`\`