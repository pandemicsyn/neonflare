import { describe, it, expect } from 'vitest';
import { trackmcp, getInstrumentation, getTracker, getContextInjector } from '../../src/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createTestServer, waitForTelemetryEvents, assertTelemetryEvents } from '../utils/mcp-helpers.js';

describe('Server Wrapping Integration', () => {
  describe('Basic Wrapping', () => {
    it('should wrap server and attach instrumentation', () => {
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

      const instrumentedServer = trackmcp(server, {
        serviceName: 'test-integration-server',
        serviceVersion: '1.0.0',
        consoleExport: false
      });

      expect(instrumentedServer).toBe(server);
      expect(getTracker(server)).toBeDefined();
      expect(getInstrumentation(server)).toBeDefined();
      expect(getContextInjector(server)).toBeDefined();
    });

    it('should allow access to tracker and instrumentation', () => {
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

      const tracker = getTracker(server);
      const instrumentation = getInstrumentation(server);
      const contextInjector = getContextInjector(server);

      expect(tracker).toBeDefined();
      expect(instrumentation).toBeDefined();
      expect(contextInjector).toBeDefined();

      const metrics = tracker!.getCurrentMetrics();
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successfulRequests');

      const events = instrumentation!.getTelemetryEvents();
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('Context Injection Integration', () => {
    it('should attach context injector with proper configuration', () => {
      const server = new Server(
        {
          name: 'context-test-server',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );

      trackmcp(server, {
        projectId: 'proj_test_context',
        serviceName: 'context-test',
        contextInjection: {
          enabled: true,
          description: 'Tell me why you are calling this tool',
          required: false
        }
      });

      const contextInjector = getContextInjector(server);
      expect(contextInjector).toBeDefined();

      const config = contextInjector!.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.description).toBe('Tell me why you are calling this tool');
      expect(config.required).toBe(false);
    });

    it('should process tool arguments with context extraction', () => {
      const server = new Server(
        {
          name: 'context-processing-server',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );

      trackmcp(server, {
        projectId: 'proj_context_processing',
        contextInjection: { enabled: true }
      });

      const contextInjector = getContextInjector(server)!;

      const toolName = 'search';
      const toolArgs = {
        query: 'MCP servers',
        limit: 10,
        context: 'The user asked about MCP server implementations'
      };

      const { context: aiContext, cleanedArgs } = contextInjector.processToolArguments(toolName, toolArgs);

      expect(aiContext).toBe(toolArgs.context);
      expect(cleanedArgs.context).toBeUndefined();
      expect(cleanedArgs.query).toBe('MCP servers');
      expect(cleanedArgs.limit).toBe(10);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect metrics from operations', async () => {
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
        tracingEnabled: true,
        projectId: 'proj_metrics_test'
      });

      const tracker = getTracker(server)!;

      // Simulate operations
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

      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageDuration).toBe(125);

      await tracker.shutdown();
    });

    it('should include projectId in all telemetry events', async () => {
      const server = new Server(
        {
          name: 'project-id-test-server',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );

      const projectId = 'proj_telemetry_test';
      trackmcp(server, {
        projectId,
        serviceName: 'telemetry-test'
      });

      const tracker = getTracker(server)!;

      // Simulate an operation
      const context = tracker.createOperationContext('tools/list', 'req-telemetry');
      tracker.startMCPSpan('tools/list', context);
      tracker.endMCPSpan(context.operationId, {
        success: true,
        data: { tools: [] },
        duration: 50,
        timestamp: Date.now()
      });

      const events = tracker.getTelemetryEvents();
      const requestStart = events.find(e => e.type === 'request_start');
      const requestEnd = events.find(e => e.type === 'request_end');

      expect(requestStart).toBeDefined();
      expect(requestEnd).toBeDefined();
      expect(requestStart!.data.projectId).toBe(projectId);
      expect(requestEnd!.data.projectId).toBe(projectId);

      await tracker.shutdown();
    });
  });

  describe('Error Handling', () => {
    it('should track errors in operations', async () => {
      const server = new Server(
        {
          name: 'error-test-server',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );

      trackmcp(server, {
        projectId: 'proj_error_test',
        serviceName: 'error-test'
      });

      const tracker = getTracker(server)!;

      // Simulate failed operation
      const context = tracker.createOperationContext('tools/call', 'req-error');
      tracker.startMCPSpan('tools/call', context);
      tracker.endMCPSpan(context.operationId, {
        success: false,
        error: {
          code: 'TOOL_ERROR',
          message: 'Tool execution failed',
          details: { tool: 'failing-tool' }
        },
        duration: 75,
        timestamp: Date.now()
      });

      const metrics = tracker.getCurrentMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);

      const events = tracker.getTelemetryEvents();
      const errorEvent = events.find(e => e.type === 'request_end' && !e.data.success);
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.data.error).toBeDefined();
      expect(errorEvent!.data.error.code).toBe('TOOL_ERROR');

      await tracker.shutdown();
    });
  });

  describe('Configuration Integration', () => {
    it('should apply configuration to server instrumentation', () => {
      const server = new Server(
        {
          name: 'config-test-server',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );

      const config = {
        projectId: 'proj_config_test',
        serviceName: 'config-test-service',
        serviceVersion: '2.0.0',
        samplingRate: 0.8,
        contextInjection: {
          enabled: true,
          description: 'Custom description'
        }
      };

      trackmcp(server, config);

      const tracker = getTracker(server)!;
      const contextInjector = getContextInjector(server)!;

      // Verify configuration was applied
      const trackerConfig = tracker.getConfig();
      expect(trackerConfig.projectId).toBe(config.projectId);
      expect(trackerConfig.serviceName).toBe(config.serviceName);
      expect(trackerConfig.samplingRate).toBe(config.samplingRate);

      const injectorConfig = contextInjector.getConfig();
      expect(injectorConfig.enabled).toBe(true);
      expect(injectorConfig.description).toBe('Custom description');
    });
  });
});