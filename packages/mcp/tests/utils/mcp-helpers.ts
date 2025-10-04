/**
 * Test utilities for MCP server testing
 * Provides helpers for creating requests, invoking handlers, and testing instrumentation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * Create a mock tool call request
 */
export function createToolCallRequest(
  toolName: string,
  args: Record<string, any>,
  requestId?: string
) {
  return {
    id: requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    params: {
      name: toolName,
      arguments: args
    }
  };
}

/**
 * Create a mock list tools request
 */
export function createListToolsRequest(requestId?: string) {
  return {
    id: requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    params: {}
  };
}

/**
 * Create a mock list resources request
 */
export function createListResourcesRequest(requestId?: string) {
  return {
    id: requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    params: {}
  };
}

/**
 * Invoke a request handler directly (bypasses MCP protocol)
 * This is a workaround since MCP SDK doesn't expose handler invocation
 */
export async function invokeHandlerDirectly(
  server: Server,
  method: string,
  request: any
): Promise<any> {
  // This is a simplified approach - in reality we'd need to access the internal handler map
  // For now, we'll simulate the handler invocation

  // Access the internal request handlers map (this may not work in all versions)
  const handlers = (server as any)._requestHandlers || (server as any).requestHandlers;

  if (!handlers || !handlers.has(method)) {
    throw new Error(`No handler registered for method: ${method}`);
  }

  const handler = handlers.get(method);

  // Call the handler directly
  return await handler(request, {});
}

/**
 * Wait for telemetry events to be generated
 */
export async function waitForTelemetryEvents(
  getEvents: () => any[],
  expectedCount: number,
  timeout: number = 1000
): Promise<any[]> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const events = getEvents();
    if (events.length >= expectedCount) {
      return events;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error(`Timeout waiting for ${expectedCount} telemetry events. Got: ${getEvents().length}`);
}

/**
 * Wait for active spans to reach expected count
 */
export async function waitForActiveSpans(
  getActiveSpanCount: () => number,
  expectedCount: number,
  timeout: number = 1000
): Promise<number> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const count = getActiveSpanCount();
    if (count === expectedCount) {
      return count;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error(`Timeout waiting for ${expectedCount} active spans. Got: ${getActiveSpanCount()}`);
}

/**
 * Create a test server with common handlers
 */
export function createTestServer() {
  const server = new Server(
    {
      name: 'test-server',
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

  // Register test handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' }
            }
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'test-tool') {
      return {
        content: [
          { type: 'text', text: `Processed: ${args?.query || 'no query'}` }
        ]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

/**
 * Assert that telemetry events contain expected data
 */
export function assertTelemetryEvents(
  events: any[],
  expectations: {
    type?: string;
    method?: string;
    success?: boolean;
    projectId?: string;
    aiContext?: string;
  }
) {
  const matchingEvents = events.filter(event => {
    if (expectations.type && event.type !== expectations.type) return false;
    if (expectations.method && event.data?.method !== expectations.method) return false;
    if (expectations.success !== undefined && event.data?.success !== expectations.success) return false;
    if (expectations.projectId && event.data?.projectId !== expectations.projectId) return false;
    if (expectations.aiContext && event.data?.metadata?.aiContext !== expectations.aiContext) return false;
    return true;
  });

  if (matchingEvents.length === 0) {
    throw new Error(`No telemetry events found matching expectations: ${JSON.stringify(expectations)}`);
  }

  return matchingEvents;
}

/**
 * Create a request with AI context for testing
 */
export function createRequestWithContext(
  method: string,
  params: any,
  context: string,
  requestId?: string
) {
  const baseRequest = {
    id: requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    params
  };

  if (method === 'tools/call' && params.arguments) {
    return {
      ...baseRequest,
      params: {
        ...params,
        arguments: {
          ...params.arguments,
          context
        }
      }
    };
  }

  return baseRequest;
}