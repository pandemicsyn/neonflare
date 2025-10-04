/**
 * Basic usage example for @neonflare/mcp
 *
 * This example demonstrates the fundamental usage of the MCP instrumentation library
 * for tracing MCP server operations with OpenTelemetry.
 */

import { createMCPInstrumentation, getEnrichmentManager } from '../src/index.js';

async function basicUsageExample() {
  console.log('🚀 Neonflare MCP Basic Usage Example\n');

  // Initialize instrumentation with basic configuration
  const instrumentation = createMCPInstrumentation({
    serviceName: 'example-mcp-server',
    serviceVersion: '1.0.0',
    consoleExport: true, // Enable console logging for demonstration
    tracingEnabled: true,
    samplingRate: 1.0 // Sample all requests for demo
  });

  // Set up enrichment context
  const enrichment = getEnrichmentManager();
  enrichment.setUserContext({
    userId: 'demo-user-123',
    sessionId: 'demo-session-456',
    clientIp: '192.168.1.100',
    userAgent: 'DemoApp/1.0',
    customTags: ['demo', 'example']
  });

  try {
    // Example 1: Instrument a tools/list operation
    console.log('📋 Example 1: Tools List Operation');
    const toolsResult = await instrumentation.instrumentToolsList(async () => {
      console.log('   → Executing tools list...');

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        tools: [
          {
            name: 'calculator',
            description: 'Basic arithmetic operations',
            inputSchema: {
              type: 'object',
              properties: {
                operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
                a: { type: 'number' },
                b: { type: 'number' }
              }
            }
          },
          {
            name: 'weather',
            description: 'Get current weather information',
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' }
              }
            }
          }
        ]
      };
    }, 'req-tools-list-001');

    console.log(`   ✓ Found ${toolsResult.tools.length} tools\n`);

    // Example 2: Instrument a tools/call operation
    console.log('🔧 Example 2: Tools Call Operation');
    const calculationResult = await instrumentation.instrumentToolsCall(
      async (toolName: string, args: any) => {
        console.log(`   → Executing tool: ${toolName}`);

        // Simulate tool execution
        await new Promise(resolve => setTimeout(resolve, 150));

        if (toolName === 'calculator') {
          const { operation, a, b } = args;
          let result: number;

          switch (operation) {
            case 'add':
              result = a + b;
              break;
            case 'subtract':
              result = a - b;
              break;
            case 'multiply':
              result = a * b;
              break;
            case 'divide':
              if (b === 0) throw new Error('Division by zero');
              result = a / b;
              break;
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }

          return { result };
        }

        throw new Error(`Unknown tool: ${toolName}`);
      },
      'calculator',
      { operation: 'add', a: 10, b: 5 },
      'req-tools-call-001'
    );

    console.log(`   ✓ Calculation result: ${calculationResult.result}\n`);

    // Example 3: Instrument a resources/list operation
    console.log('📁 Example 3: Resources List Operation');
    const resourcesResult = await instrumentation.instrumentResourcesList(async () => {
      console.log('   → Listing resources...');

      await new Promise(resolve => setTimeout(resolve, 80));

      return {
        resources: [
          {
            uri: 'file:///data/config.json',
            name: 'Configuration',
            description: 'Application configuration file',
            mimeType: 'application/json'
          },
          {
            uri: 'file:///data/users.csv',
            name: 'Users',
            description: 'User data export',
            mimeType: 'text/csv'
          }
        ]
      };
    }, 'req-resources-list-001');

    console.log(`   ✓ Found ${resourcesResult.resources.length} resources\n`);

    // Example 4: Demonstrate error handling
    console.log('❌ Example 4: Error Handling');
    try {
      await instrumentation.instrumentToolsCall(
        async () => {
          console.log('   → Executing failing operation...');
          throw new Error('Simulated tool failure');
        },
        'failing-tool',
        {},
        'req-error-demo-001'
      );
    } catch (error: any) {
      console.log(`   ✓ Caught expected error: ${error.message}\n`);
    }

    // Example 5: Show performance metrics
    console.log('📊 Example 5: Performance Metrics');
    const metrics = instrumentation.getMetrics();
    console.log(`   → Total requests: ${metrics.totalRequests}`);
    console.log(`   → Success rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)}%`);
    console.log(`   → Average duration: ${metrics.averageDuration.toFixed(2)}ms\n`);

    // Example 6: Show telemetry events
    console.log('📈 Example 6: Telemetry Events');
    const events = instrumentation.getTelemetryEvents();
    console.log(`   → Total events recorded: ${events.length}`);
    console.log(`   → Event types: ${[...new Set(events.map(e => e.type))].join(', ')}\n`);

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  } finally {
    // Cleanup
    await instrumentation.shutdown();
    console.log('✅ Example completed successfully!');
  }
}

// Export for use in other examples
export { basicUsageExample };

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  basicUsageExample().catch(console.error);
}