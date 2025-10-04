/**
 * Server wrapping example for @neonflare/mcp
 *
 * This example demonstrates the primary usage pattern: wrapping an MCP server
 * with automatic instrumentation.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { trackmcp, getInstrumentation, getTracker } from '../src/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

async function serverWrappingExample() {
  console.log('🔧 Server Wrapping Example\n');

  // Step 1: Create an MCP server
  console.log('1. Creating MCP server...');
  const server = new Server(
    {
      name: 'example-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    }
  );
  console.log('   ✓ Server created\n');

  // Step 2: Wrap server with Neonflare instrumentation
  console.log('2. Wrapping server with Neonflare instrumentation...');
  trackmcp(server, {
    serviceName: 'example-mcp-server',
    serviceVersion: '1.0.0',
    consoleExport: true,
    tracingEnabled: true,
    metricsEnabled: true,
    rotel: {
      enabled: true,
      autoInstrument: true,
      instrumentations: ['http', 'fs']
    }
  });
  console.log('   ✓ Server instrumented\n');

  // Step 3: Register handlers - they will be automatically instrumented
  console.log('3. Registering handlers (automatically instrumented)...');

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.log('   → Handler: tools/list called');
    return {
      tools: [
        {
          name: 'calculator',
          description: 'Perform basic arithmetic',
          inputSchema: {
            type: 'object',
            properties: {
              operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
              a: { type: 'number' },
              b: { type: 'number' }
            },
            required: ['operation', 'a', 'b']
          }
        },
        {
          name: 'timestamp',
          description: 'Get current timestamp',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.log(`   → Handler: tools/call called for tool: ${request.params.name}`);

    const { name, arguments: args } = request.params;

    if (name === 'calculator') {
      const { operation, a, b } = args as any;

      switch (operation) {
        case 'add':
          return {
            content: [
              { type: 'text', text: `Result: ${a + b}` }
            ]
          };
        case 'subtract':
          return {
            content: [
              { type: 'text', text: `Result: ${a - b}` }
            ]
          };
        case 'multiply':
          return {
            content: [
              { type: 'text', text: `Result: ${a * b}` }
            ]
          };
        case 'divide':
          if (b === 0) throw new Error('Division by zero');
          return {
            content: [
              { type: 'text', text: `Result: ${a / b}` }
            ]
          };
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    }

    if (name === 'timestamp') {
      return {
        content: [
          { type: 'text', text: `Current timestamp: ${Date.now()}` }
        ]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  console.log('   ✓ Handlers registered\n');

  // Step 4: Access instrumentation for metrics
  console.log('4. Accessing instrumentation metrics...');
  const tracker = getTracker(server);
  const instrumentation = getInstrumentation(server);

  if (!tracker || !instrumentation) {
    throw new Error('Failed to get instrumentation');
  }

  // Simulate some operations by directly using tracker
  console.log('   → Simulating operations...');
  
  const context1 = tracker.createOperationContext('tools/list', 'req-001');
  tracker.startMCPSpan('tools/list', context1);
  tracker.endMCPSpan(context1.operationId, {
    success: true,
    data: { tools: [] },
    duration: 50,
    timestamp: Date.now()
  });

  const context2 = tracker.createOperationContext('tools/call', 'req-002');
  tracker.startMCPSpan('tools/call', context2);
  tracker.endMCPSpan(context2.operationId, {
    success: true,
    data: { result: 'success' },
    duration: 100,
    timestamp: Date.now()
  });

  const metrics = tracker.getCurrentMetrics();
  console.log(`   ✓ Total requests: ${metrics.totalRequests}`);
  console.log(`   ✓ Successful requests: ${metrics.successfulRequests}`);
  console.log(`   ✓ Average duration: ${metrics.averageDuration.toFixed(2)}ms`);
  console.log(`   ✓ Active sessions: ${metrics.activeSessions}\n`);

  // Step 5: View telemetry events
  console.log('5. Viewing telemetry events...');
  const events = tracker.getTelemetryEvents();
  console.log(`   ✓ Total events recorded: ${events.length}`);
  
  const eventTypes = events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(eventTypes).forEach(([type, count]) => {
    console.log(`   ✓ ${type}: ${count}`);
  });

  // Cleanup
  await tracker.shutdown();
  console.log('\n✅ Example completed!');
}

// Export for use in other examples
export { serverWrappingExample };

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  serverWrappingExample().catch(console.error);
}