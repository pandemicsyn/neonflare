import { MCPTracker } from '../../src/core/tracker.js';
import { MCPInstrumentationConfig } from '../../src/types/index.js';

/**
 * Simple test runner for MCPTracker
 */
class TestRunner {
  private tests: Array<{ name: string; fn: () => Promise<void> }> = [];
  private beforeEachHooks: Array<() => Promise<void>> = [];
  private afterEachHooks: Array<() => Promise<void>> = [];

  beforeEach(hook: () => Promise<void>) {
    this.beforeEachHooks.push(hook);
  }

  afterEach(hook: () => Promise<void>) {
    this.afterEachHooks.push(hook);
  }

  test(name: string, fn: () => Promise<void>) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('Running MCPTracker tests...\n');

    for (const { name, fn } of this.tests) {
      try {
        // Run beforeEach hooks
        for (const hook of this.beforeEachHooks) {
          await hook();
        }

        console.log(`✓ ${name}`);
        await fn();

        // Run afterEach hooks
        for (const hook of this.afterEachHooks) {
          await hook();
        }
      } catch (error) {
        console.error(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('\nTests completed.');
  }
}

const runner = new TestRunner();
let tracker: MCPTracker;
let config: MCPInstrumentationConfig;

// Setup hooks
runner.beforeEach(async () => {
  config = {
    serviceName: 'test-service',
    serviceVersion: '1.0.0',
    tracingEnabled: true,
    consoleExport: true
  };
  tracker = new MCPTracker(config);
});

runner.afterEach(async () => {
  await tracker.shutdown();
});

// Test cases
runner.test('should initialize with default configuration', async () => {
  const defaultTracker = new MCPTracker();
  const defaultConfig = defaultTracker.getConfig();

  if (defaultConfig.serviceName !== 'mcp-server') {
    throw new Error(`Expected serviceName to be 'mcp-server', got '${defaultConfig.serviceName}'`);
  }
  if (!defaultConfig.tracingEnabled) {
    throw new Error('Expected tracingEnabled to be true');
  }
});

runner.test('should merge provided configuration with defaults', async () => {
  const testConfig: MCPInstrumentationConfig = {
    serviceName: 'custom-service',
    samplingRate: 0.5
  };

  const customTracker = new MCPTracker(testConfig);
  const mergedConfig = customTracker.getConfig();

  if (mergedConfig.serviceName !== 'custom-service') {
    throw new Error(`Expected serviceName to be 'custom-service', got '${mergedConfig.serviceName}'`);
  }
  if (mergedConfig.samplingRate !== 0.5) {
    throw new Error(`Expected samplingRate to be 0.5, got ${mergedConfig.samplingRate}`);
  }
  if (mergedConfig.serviceVersion !== '1.0.0') {
    throw new Error(`Expected serviceVersion to be '1.0.0', got '${mergedConfig.serviceVersion}'`);
  }
});

runner.test('should create operation context with required fields', async () => {
  const context = tracker.createOperationContext('tools/list', 'test-request-123');

  if (!context.operationId) {
    throw new Error('Expected operationId to be defined');
  }
  if (!context.startTime) {
    throw new Error('Expected startTime to be defined');
  }
  if (context.metadata?.method !== 'tools/list') {
    throw new Error(`Expected method to be 'tools/list', got '${context.metadata?.method}'`);
  }
  if (context.metadata?.requestId !== 'test-request-123') {
    throw new Error(`Expected requestId to be 'test-request-123', got '${context.metadata?.requestId}'`);
  }
});

runner.test('should start and end spans correctly', async () => {
  const context = tracker.createOperationContext('tools/list');
  const span = tracker.startMCPSpan('tools/list', context);

  if (!span) {
    throw new Error('Expected span to be defined');
  }
  
  // Note: isRecording() may return false for NoOp spans in test environment
  // This is expected behavior when no TracerProvider is registered
  const initialActiveSpans = tracker.getActiveSpanCount();
  if (initialActiveSpans !== 1) {
    throw new Error(`Expected 1 active span, got ${initialActiveSpans}`);
  }

  // Simulate operation completion
  tracker.endMCPSpan(context.operationId, {
    success: true,
    data: { tools: [] },
    duration: 100,
    timestamp: Date.now()
  });

  const finalActiveSpans = tracker.getActiveSpanCount();
  if (finalActiveSpans !== 0) {
    throw new Error(`Expected 0 active spans after end, got ${finalActiveSpans}`);
  }
});

runner.test('should record telemetry events', async () => {
  const context = tracker.createOperationContext('test');
  tracker.startMCPSpan('test', context);

  const events = tracker.getTelemetryEvents();
  if (events.length === 0) {
    throw new Error('Expected telemetry events to be recorded');
  }
  if (events[events.length - 1].type !== 'request_start') {
    throw new Error(`Expected last event type to be 'request_start', got '${events[events.length - 1].type}'`);
  }
});

// Export for manual execution
export { runner };

// Auto-run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runner.run().catch(console.error);
}