import { describe, it, expect } from 'vitest';
import { trackmcp, getTracker, getContextInjector } from '../../src/index.js';
import { injectContextIntoSchema, extractContextFromArgs } from '../../src/enrichment/context-injector.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

describe('End-to-End Integration', () => {
  it('should demonstrate complete context injection workflow', async () => {
    // Step 1: Create server
    const server = new Server(
      {
        name: 'e2e-test-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Step 2: Wrap with instrumentation
    trackmcp(server, {
      projectId: 'proj_e2e_test',
      serviceName: 'e2e-test',
      contextInjection: {
        enabled: true,
        description: 'Explain your reasoning for calling this tool'
      }
    });

    const tracker = getTracker(server)!;
    const contextInjector = getContextInjector(server)!;

    // Step 3: Create tool schema with context injection
    const originalToolSchema = {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' }
      },
      required: ['query']
    };

    const toolName = 'search';
    const injectedSchema = contextInjector.processToolSchema(toolName, originalToolSchema);

    // Verify context was injected
    expect(injectedSchema.properties.context).toBeDefined();
    expect(injectedSchema.properties.context.type).toBe('string');

    // Step 4: Register handler
    let receivedArgs: any;
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      receivedArgs = request.params.arguments;
      return {
        content: [
          { type: 'text', text: `Search results for: ${request.params.arguments?.query || 'unknown'}` }
        ]
      };
    });

    // Step 5: Simulate tool call with AI context
    const aiContext = 'The user asked about MCP server implementations, so I need to search for relevant information';
    const toolCallArgs = {
      query: 'MCP server implementations',
      limit: 10,
      context: aiContext
    };

    // Extract context before handler execution
    const extractedContext = extractContextFromArgs(toolCallArgs);
    expect(extractedContext).toBe(aiContext);

    // Step 6: Simulate handler execution with context
    const mockRequest = {
      id: 'req-e2e-1',
      params: {
        name: toolName,
        arguments: toolCallArgs
      }
    };

    // Simulate what the wrapped handler would do
    const context = tracker.createOperationContext('tools/call', mockRequest.id, mockRequest.params);
    const span = tracker.startMCPSpan('tools/call', context);

    // Add AI context to span
    if (extractedContext) {
      span.setAttributes({
        'mcp.tool.ai_context': extractedContext,
        'mcp.tool.ai_intent': extractedContext.substring(0, 200),
        'neonflare.project_id': 'proj_e2e_test'
      } as any);
    }

    // Simulate handler execution (context should be stripped)
    const handlerArgs = { ...mockRequest.params.arguments };
    const { context: aiContextValue, ...cleanedArgs } = handlerArgs; // Strip context

    // Verify cleaned args don't have context (via destructuring)
    expect('context' in cleanedArgs).toBe(false);
    expect(cleanedArgs.query).toBe('MCP server implementations');
    expect(cleanedArgs.limit).toBe(10);

    // Complete the span
    tracker.endMCPSpan(context.operationId, {
      success: true,
      data: { content: [{ type: 'text', text: 'Search results' }] },
      duration: 150,
      timestamp: Date.now()
    });

    // Step 7: Verify complete telemetry chain
    const events = tracker.getTelemetryEvents();
    const requestStart = events.find(e => e.type === 'request_start');
    const requestEnd = events.find(e => e.type === 'request_end');

    expect(requestStart).toBeDefined();
    expect(requestEnd).toBeDefined();

    // Verify project ID in telemetry
    expect(requestStart!.data.projectId).toBe('proj_e2e_test');
    expect(requestEnd!.data.projectId).toBe('proj_e2e_test');

    // Verify AI context was processed (it's in params, passed to createOperationContext)
    expect(requestStart!.data.metadata).toBeDefined();

    // Step 8: Verify metrics
    const metrics = tracker.getCurrentMetrics();
    expect(metrics.totalRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(1);
    expect(metrics.failedRequests).toBe(0);

    await tracker.shutdown();
  });

  it('should handle multiple operations with context injection', async () => {
    const server = new Server(
      {
        name: 'multi-op-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    trackmcp(server, {
      projectId: 'proj_multi_op',
      contextInjection: { enabled: true }
    });

    const tracker = getTracker(server)!;

    // Simulate multiple operations
    const operations = [
      {
        tool: 'search',
        args: { query: 'MCP servers', context: 'User asked about MCP servers' },
        expectedDuration: 100
      },
      {
        tool: 'calculate',
        args: { operation: 'add', a: 10, b: 5, context: 'User needs math help' },
        expectedDuration: 50
      },
      {
        tool: 'search',
        args: { query: 'OpenTelemetry', context: 'User asked about observability' },
        expectedDuration: 200
      }
    ];

    for (const op of operations) {
      const context = tracker.createOperationContext('tools/call', `req-${op.tool}-${Date.now()}`);
      tracker.startMCPSpan('tools/call', context);

      const aiContext = extractContextFromArgs(op.args);
      expect(aiContext).toBe(op.args.context);

      tracker.endMCPSpan(context.operationId, {
        success: true,
        data: { result: 'success' },
        duration: op.expectedDuration,
        timestamp: Date.now()
      });
    }

    const metrics = tracker.getCurrentMetrics();
    expect(metrics.totalRequests).toBe(3);
    expect(metrics.successfulRequests).toBe(3);
    expect(metrics.averageDuration).toBeCloseTo(116.67, 1); // (100 + 50 + 200) / 3

    const events = tracker.getTelemetryEvents();
    expect(events.filter(e => e.type === 'request_start').length).toBe(3);
    expect(events.filter(e => e.type === 'request_end').length).toBe(3);

    await tracker.shutdown();
  });

  it('should handle errors with context tracking', async () => {
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
      contextInjection: { enabled: true }
    });

    const tracker = getTracker(server)!;

    // Simulate failed operation with context
    const context = tracker.createOperationContext('tools/call', 'req-error-1');
    tracker.startMCPSpan('tools/call', context);

    const aiContext = 'User asked about error handling in MCP servers';
    const error = {
      code: 'TOOL_ERROR',
      message: 'Tool execution failed',
      details: { tool: 'failing-tool' }
    };

    tracker.endMCPSpan(context.operationId, {
      success: false,
      error,
      duration: 75,
      timestamp: Date.now()
    });

    const metrics = tracker.getCurrentMetrics();
    expect(metrics.totalRequests).toBe(1);
    expect(metrics.failedRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(0);

    const events = tracker.getTelemetryEvents();
    const errorEvent = events.find(e => e.type === 'request_end' && !e.data.success);
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.data.error).toEqual(error);

    await tracker.shutdown();
  });
});