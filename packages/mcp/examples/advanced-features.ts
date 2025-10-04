/**
 * Advanced features example for @neonflare/mcp
 *
 * This example demonstrates advanced features including performance monitoring,
 * error handling, custom enrichment, and telemetry providers.
 */

import {
  createMCPInstrumentation,
  ConfigurationManager,
  Config,
  PerformanceMonitor,
  withPerformanceMonitoring,
  MCPError,
  Errors,
  MCPErrorBoundary,
  getEnrichmentManager,
  EnvironmentEnrichmentProvider,
  UserContextEnrichmentProvider,
  MemoryTelemetryProvider,
  CompositeTelemetryProvider
} from '../src/index.js';

class AdvancedMCPService {
  private instrumentation: any;
  private performanceMonitor: PerformanceMonitor;
  private errorBoundary: MCPErrorBoundary;

  constructor() {
    // Initialize with production-like configuration
    const configManager = new ConfigurationManager(Config.staging());

    this.instrumentation = createMCPInstrumentation({
      ...configManager.getConfig(),
      consoleExport: true
    });

    this.performanceMonitor = new PerformanceMonitor({
      enabled: true,
      thresholds: {
        maxDuration: 1000,
        maxMemoryUsage: 50
      },
      collectSystemMetrics: true
    });

    this.errorBoundary = new MCPErrorBoundary();

    this.setupEnrichment();
    this.setupCustomTelemetry();
  }

  private setupEnrichment() {
    const enrichment = getEnrichmentManager();

    // Add custom enrichment providers
    const customProvider = new EnvironmentEnrichmentProvider();
    enrichment.addProvider(customProvider);

    const userProvider = new UserContextEnrichmentProvider();
    enrichment.addProvider(userProvider);

    // Set up user context
    enrichment.setUserContext({
      userId: 'advanced-user-789',
      sessionId: 'advanced-session-101112',
      clientIp: '10.0.0.1',
      userAgent: 'AdvancedMCPClient/2.0',
      customTags: ['advanced', 'demo', 'performance-test']
    });

    // Set geographic context
    enrichment.setLocation({
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      timezone: 'America/Los_Angeles'
    });

    // Set business context
    enrichment.setCustomData({
      tenantId: 'tenant-advanced-123',
      featureSet: 'premium',
      experimentGroup: 'performance-optimization',
      deploymentEnv: 'staging'
    });
  }

  private setupCustomTelemetry() {
    // Add memory telemetry provider for testing
    const memoryProvider = new MemoryTelemetryProvider();
    const compositeProvider = new CompositeTelemetryProvider([memoryProvider]);

    // You could add this to the tracker if needed
    // this.instrumentation.getTracker().addTelemetryProvider(compositeProvider);
  }

  async performDatabaseOperation(queryType: string, tableName: string) {
    return this.performanceMonitor.monitorAsync(async () => {
      console.log(`   → Executing ${queryType} on ${tableName}...`);

      // Simulate database work with varying performance
      const baseDelay = queryType === 'complex' ? 800 : 200;
      const variance = Math.random() * 200;
      await new Promise(resolve => setTimeout(resolve, baseDelay + variance));

      // Simulate occasional slow queries
      if (Math.random() < 0.1) {
        console.log('   ⚠️  Slow query detected!');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      return {
        queryType,
        tableName,
        rowsAffected: Math.floor(Math.random() * 100),
        executionTime: baseDelay + variance
      };
    }, `db-${queryType}-${tableName}`);
  }

  async demonstrateErrorHandling() {
    console.log('🛠️  Demonstrating Error Handling\n');

    // Example 1: MCP-specific errors
    console.log('1. MCP Error Types:');
    const errorTypes = [
      { name: 'Invalid Request', error: Errors.invalidRequest('Missing required field') },
      { name: 'Method Not Found', error: Errors.methodNotFound('nonexistentMethod') },
      { name: 'Invalid Params', error: Errors.invalidParams('toolName', { received: 'null' }) },
      { name: 'Resource Not Found', error: Errors.resourceNotFound('missing-file.txt') },
      { name: 'Timeout', error: Errors.timeout('long-running-operation') }
    ];

    for (const { name, error } of errorTypes) {
      console.log(`   ${name}: ${error.type} - ${error.message}`);
    }

    // Example 2: Error boundary usage
    console.log('\n2. Error Boundary Usage:');
    try {
      await this.errorBoundary.execute(async () => {
        throw Errors.internalError('Simulated internal error');
      });
    } catch (error) {
      if (error instanceof MCPError) {
        console.log(`   ✓ Caught MCP error: ${error.type}`);
        console.log(`   ✓ User message: ${error.toUserMessage()}`);
        console.log(`   ✓ Retryable: ${error.retryable}`);
      }
    }

    // Example 3: Recovery strategies
    console.log('\n3. Error Recovery:');
    const recoveryError = Errors.resourceExhausted('database-connections');
    console.log(`   Error: ${recoveryError.type} - ${recoveryError.message}`);
    console.log(`   Retryable: ${recoveryError.retryable}`);
  }

  async demonstratePerformanceMonitoring() {
    console.log('📊 Demonstrating Performance Monitoring\n');

    // Example 1: Monitor individual operations
    console.log('1. Individual Operation Monitoring:');
    const { result, metrics } = await this.performDatabaseOperation('simple', 'users');
    console.log(`   Duration: ${metrics.duration.toFixed(2)}ms`);
    console.log(`   Memory usage: ${(metrics.memoryUsage! / 1024 / 1024).toFixed(2)}MB`);

    // Example 2: Monitor complex operations
    console.log('\n2. Complex Operation Monitoring:');
    const complexResult = await this.performDatabaseOperation('complex', 'analytics');
    console.log(`   Complex query duration: ${complexResult.metrics.duration.toFixed(2)}ms`);

    // Example 3: Performance statistics
    console.log('\n3. Performance Statistics:');
    const stats = this.performanceMonitor.getPerformanceStats(60000); // Last minute
    console.log(`   Average duration: ${stats.averageDuration.toFixed(2)}ms`);
    console.log(`   Max duration: ${stats.maxDuration.toFixed(2)}ms`);
    console.log(`   Total operations: ${stats.totalOperations}`);
    console.log(`   Slow operations: ${stats.slowOperations}`);
  }

  async demonstrateEnrichment() {
    console.log('🌍 Demonstrating Context Enrichment\n');

    const enrichment = getEnrichmentManager();

    // Show current enrichment data
    const enrichmentData = await enrichment.getEnrichmentData();
    console.log('1. Current Enrichment Data:');
    console.log(`   User ID: ${enrichmentData.businessContext?.userId || 'Not set'}`);
    console.log(`   Session ID: ${enrichmentData.businessContext?.sessionId || 'Not set'}`);
    console.log(`   Location: ${enrichmentData.location?.city}, ${enrichmentData.location?.country}`);
    console.log(`   Tags: ${enrichmentData.tags?.join(', ') || 'None'}`);
    console.log(`   Custom data: ${JSON.stringify(enrichmentData.businessContext, null, 2)}`);
  }

  async demonstrateBatchOperations() {
    console.log('🔄 Demonstrating Batch Operations\n');

    const operations = [
      { type: 'simple', table: 'users' },
      { type: 'simple', table: 'products' },
      { type: 'complex', table: 'orders' },
      { type: 'simple', table: 'categories' },
      { type: 'complex', table: 'analytics' }
    ];

    console.log('Executing batch of database operations...');

    const results: Array<{
      type: string;
      table: string;
      success: boolean;
      result?: any;
      metrics?: any;
      error?: string;
    }> = [];

    for (const op of operations) {
      try {
        const result = await this.performDatabaseOperation(op.type, op.table);
        results.push({ ...op, ...result, success: true });
      } catch (error: any) {
        results.push({ ...op, error: error.message, success: false });
      }
    }

    console.log('\nBatch Results:');
    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} Operation ${index + 1}: ${result.type} on ${result.table}`);
      if (result.success && result.metrics) {
        console.log(`      Duration: ${result.metrics.duration.toFixed(2)}ms`);
      } else if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`\nSummary: ${successCount}/${results.length} operations succeeded`);
  }

  async demonstrateMetricsCollection() {
    console.log('📈 Demonstrating Metrics Collection\n');

    // Get current metrics
    const metrics = this.instrumentation.getMetrics();
    console.log('1. Current Metrics:');
    console.log(`   Total requests: ${metrics.totalRequests}`);
    console.log(`   Success rate: ${((metrics.successfulRequests / Math.max(metrics.totalRequests, 1)) * 100).toFixed(1)}%`);
    console.log(`   Average duration: ${metrics.averageDuration.toFixed(2)}ms`);
    console.log(`   Requests per second: ${metrics.requestsPerSecond.toFixed(2)}`);

    // Get telemetry events
    const events = this.instrumentation.getTelemetryEvents();
    console.log('\n2. Telemetry Events:');
    console.log(`   Total events: ${events.length}`);

    const eventTypes = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(eventTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    // Get performance stats
    const perfStats = this.performanceMonitor.getPerformanceStats();
    console.log('\n3. Performance Statistics:');
    console.log(`   Average duration: ${perfStats.averageDuration.toFixed(2)}ms`);
    console.log(`   Max duration: ${perfStats.maxDuration.toFixed(2)}ms`);
    console.log(`   Min duration: ${perfStats.minDuration.toFixed(2)}ms`);
    console.log(`   Total operations: ${perfStats.totalOperations}`);
    console.log(`   Slow operations (>1s): ${perfStats.slowOperations}`);
  }

  async run() {
    console.log('🚀 Neonflare MCP Advanced Features Demo\n');

    try {
      await this.demonstrateErrorHandling();
      await this.demonstratePerformanceMonitoring();
      await this.demonstrateEnrichment();
      await this.demonstrateBatchOperations();
      await this.demonstrateMetricsCollection();

      console.log('\n✅ Advanced features demo completed successfully!');

    } catch (error) {
      console.error('💥 Demo failed:', error);
    } finally {
      await this.instrumentation.shutdown();
    }
  }
}

/**
 * Integration example showing how to integrate with an existing MCP server
 */
export async function integrationExample() {
  console.log('🔗 Integration Example\n');

  // Simulate integration with an existing MCP server framework
  class MockMCPServer {
    private handlers = new Map<string, Function>();

    setRequestHandler(method: string, handler: Function) {
      this.handlers.set(method, handler);
    }

    async handleRequest(method: string, params: any, requestId?: string) {
      const handler = this.handlers.get(method);
      if (!handler) {
        throw Errors.methodNotFound(method);
      }

      // In a real implementation, you'd use the instrumentation here
      const instrumentation = createMCPInstrumentation({
        serviceName: 'integrated-mcp-server',
        consoleExport: true
      });

      try {
        const result = await instrumentation.instrumentToolsCall(
          async () => {
            return await handler(params);
          },
          method,
          params,
          requestId
        );

        return result;
      } finally {
        await instrumentation.shutdown();
      }
    }
  }

  const server = new MockMCPServer();

  // Register handlers
  server.setRequestHandler('add', async (params: { a: number; b: number }) => {
    return { result: params.a + params.b };
  });

  server.setRequestHandler('divide', async (params: { a: number; b: number }) => {
    if (params.b === 0) {
      throw Errors.invalidParams('b', 'Cannot divide by zero');
    }
    return { result: params.a / params.b };
  });

  // Test the integration
  try {
    const addResult = await server.handleRequest('add', { a: 10, b: 5 }, 'req-add-001');
    console.log(`   Addition result: ${addResult.result}`);

    const divideResult = await server.handleRequest('divide', { a: 10, b: 2 }, 'req-divide-001');
    console.log(`   Division result: ${divideResult.result}`);

    // Test error case
    try {
      await server.handleRequest('divide', { a: 10, b: 0 }, 'req-divide-error-001');
    } catch (error) {
      if (error instanceof MCPError) {
        console.log(`   ✓ Caught expected error: ${error.type}`);
      }
    }

  } catch (error) {
    console.error('   ✗ Integration test failed:', error);
  }
}

// Main demo function
async function advancedFeaturesDemo() {
  const service = new AdvancedMCPService();
  await service.run();

  console.log('\n' + '='.repeat(50) + '\n');

  await integrationExample();
}

// Export for use in other contexts
export { AdvancedMCPService, advancedFeaturesDemo };

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  advancedFeaturesDemo().catch(console.error);
}