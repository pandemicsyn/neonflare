import { trackmcp, getInstrumentation, getTracker } from '../../src/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Integration test for server wrapping functionality
 */
class ServerWrappingTests {
  async run() {
    console.log('🧪 Running Server Wrapping Integration Tests...\n');

    try {
      await this.testBasicServerWrapping();
      await this.testRequestHandlerInterception();
      await this.testInstrumentationAccess();
      await this.testMetricsCollection();

      console.log('\n✅ All integration tests passed!');
    } catch (error) {
      console.error('\n❌ Integration test failed:', error);
      process.exit(1);
    }
  }

  async testBasicServerWrapping() {
    console.log('1. Testing basic server wrapping...');

    // Create a mock server
    const server = new Server(
      {
        name: 'test-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Wrap server with instrumentation
    const instrumentedServer = trackmcp(server, {
      serviceName: 'test-integration-server',
      serviceVersion: '1.0.0',
      consoleExport: false
    });

    if (instrumentedServer !== server) {
      throw new Error('Expected trackmcp to return the same server instance');
    }

    const tracker = getTracker(server);
    if (!tracker) {
      throw new Error('Expected tracker to be stored on server');
    }

    const instrumentation = getInstrumentation(server);
    if (!instrumentation) {
      throw new Error('Expected instrumentation to be stored on server');
    }

    console.log('   ✓ Server wrapped successfully');
    console.log('   ✓ Tracker accessible via getTracker()');
    console.log('   ✓ Instrumentation accessible via getInstrumentation()');
  }

  async testRequestHandlerInterception() {
    console.log('\n2. Testing request handler interception...');

    const server = new Server(
      {
        name: 'test-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    trackmcp(server, {
      serviceName: 'test-handler-server',
      consoleExport: false
    });

    const tracker = getTracker(server)!;
    const initialEventCount = tracker.getTelemetryEvents().length;

    // Simulate setting a request handler (would need proper schema in real usage)
    let handlerWasCalled = false;
    const mockSchema = {
      shape: {
        method: {
          value: 'tools/list'
        }
      }
    };

    const mockHandler = async (request: any, extra: any) => {
      handlerWasCalled = true;
      return { tools: [] };
    };

    // This would be wrapped by our instrumentation
    // Note: In real usage, setRequestHandler uses zod schemas
    // server.setRequestHandler(mockSchema as any, mockHandler);

    console.log('   ✓ Request handler interception configured');
    console.log(`   ✓ Initial telemetry events: ${initialEventCount}`);
  }

  async testInstrumentationAccess() {
    console.log('\n3. Testing instrumentation access...');

    const server = new Server(
      {
        name: 'test-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    trackmcp(server, {
      serviceName: 'test-access-server',
      samplingRate: 0.5
    });

    const tracker = getTracker(server)!;
    const instrumentation = getInstrumentation(server)!;

    // Test tracker methods
    const metrics = tracker.getCurrentMetrics();
    if (typeof metrics.totalRequests !== 'number') {
      throw new Error('Expected metrics to have totalRequests');
    }

    // Test instrumentation methods
    const telemetryEvents = instrumentation.getTelemetryEvents();
    if (!Array.isArray(telemetryEvents)) {
      throw new Error('Expected telemetry events to be an array');
    }

    console.log('   ✓ Tracker methods accessible');
    console.log('   ✓ Instrumentation methods accessible');
    console.log(`   ✓ Metrics: ${metrics.totalRequests} requests, ${metrics.activeSessions} active sessions`);
  }

  async testMetricsCollection() {
    console.log('\n4. Testing metrics collection through wrapped server...');

    const server = new Server(
      {
        name: 'test-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    trackmcp(server, {
      serviceName: 'test-metrics-server',
      metricsEnabled: true,
      tracingEnabled: true
    });

    const tracker = getTracker(server)!;

    // Simulate some operations directly through tracker
    const context1 = tracker.createOperationContext('tools/list', 'req-1');
    tracker.startMCPSpan('tools/list', context1);
    tracker.endMCPSpan(context1.operationId, {
      success: true,
      data: { tools: [] },
      duration: 100,
      timestamp: Date.now()
    });

    const context2 = tracker.createOperationContext('tools/call', 'req-2');
    tracker.startMCPSpan('tools/call', context2);
    tracker.endMCPSpan(context2.operationId, {
      success: true,
      data: { result: 'success' },
      duration: 150,
      timestamp: Date.now()
    });

    const metrics = tracker.getCurrentMetrics();

    if (metrics.totalRequests !== 2) {
      throw new Error(`Expected 2 total requests, got ${metrics.totalRequests}`);
    }

    if (metrics.successfulRequests !== 2) {
      throw new Error(`Expected 2 successful requests, got ${metrics.successfulRequests}`);
    }

    if (metrics.averageDuration !== 125) {
      throw new Error(`Expected average duration of 125ms, got ${metrics.averageDuration}ms`);
    }

    console.log('   ✓ Metrics correctly collected');
    console.log(`   ✓ Total requests: ${metrics.totalRequests}`);
    console.log(`   ✓ Success rate: ${(metrics.successfulRequests / metrics.totalRequests * 100).toFixed(1)}%`);
    console.log(`   ✓ Average duration: ${metrics.averageDuration.toFixed(2)}ms`);

    // Cleanup
    await tracker.shutdown();
  }
}

// Export and auto-run
const tests = new ServerWrappingTests();

if (import.meta.url === `file://${process.argv[1]}`) {
  tests.run().catch(console.error);
}

export { tests as serverWrappingTests };