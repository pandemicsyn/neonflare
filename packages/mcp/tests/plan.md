# Server Wrapping Tests - Implementation Plan

## Priority: CRITICAL
The server wrapping tests currently only verify that instrumentation *attaches* to the server, but don't test that the wrapping actually *works* when request handlers are invoked.

## Current Test Coverage: 30%

### What's Tested Now ✅
- Server instrumentation attachment
- Tracker/instrumentation accessor functions
- Direct tracker API calls (not through wrapping)

### What's Missing ❌
- **Request handler interception** - The core functionality!
- **Automatic span creation** when handlers are called
- **Context injection** into actual tool calls
- **Error propagation** through wrapped handlers
- **Telemetry event generation** from real requests

## Test Implementation Plan

### Phase 1: Core Handler Interception Tests (CRITICAL)

#### Test 1: Request Handler Interception
**Goal:** Verify that `setRequestHandler()` is intercepted and handlers are wrapped

```typescript
it('should intercept setRequestHandler and wrap handlers', async () => {
  const server = new Server({...});
  trackmcp(server, { projectId: 'proj_test' });
  
  let handlerCalled = false;
  let receivedRequest: any;
  
  // Register a handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    handlerCalled = true;
    receivedRequest = request;
    return { content: [{ type: 'text', text: 'success' }] };
  });
  
  // Create a mock request
  const mockRequest = {
    id: 'req-1',
    params: {
      name: 'testTool',
      arguments: { query: 'test' }
    }
  };
  
  // Manually invoke the wrapped handler (simulate MCP protocol)
  // This requires accessing the handler through server internals
  
  // Verify:
  expect(handlerCalled).toBe(true);
  
  // Verify span was created
  const tracker = getTracker(server)!;
  const events = tracker.getTelemetryEvents();
  expect(events.some(e => e.type === 'request_start')).toBe(true);
});
```

**Complexity:** HIGH - Requires accessing wrapped handler  
**Value:** CRITICAL - Tests core functionality  
**Dependencies:** Understanding of MCP SDK's internal handler storage  

#### Test 2: Automatic Span Creation on Handler Invocation
**Goal:** Verify spans are created automatically when handlers execute

```typescript
it('should automatically create spans for handler invocations', async () => {
  const server = new Server({...});
  trackmcp(server, { projectId: 'proj_test' });
  
  const tracker = getTracker(server)!;
  
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Inside handler - verify span exists
    expect(tracker.getActiveSpanCount()).toBeGreaterThan(0);
    return { tools: [] };
  });
  
  // Invoke handler somehow
  // Verify span lifecycle completed
  const metrics = tracker.getCurrentMetrics();
  expect(metrics.totalRequests).toBe(1);
});
```

**Complexity:** HIGH - Requires handler invocation mechanism  
**Value:** CRITICAL - Validates automatic instrumentation  

#### Test 3: Context Injection in Real Handlers
**Goal:** Verify context is injected into schemas and extracted during calls

```typescript
it('should inject context into tool schemas and extract during calls', async () => {
  const server = new Server({...});
  trackmcp(server, {
    projectId: 'proj_test',
    contextInjection: { enabled: true, required: true }
  });
  
  let receivedArgs: any;
  
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    receivedArgs = request.params.arguments;
    return { content: [] };
  });
  
  // Simulate call with context
  const callWithContext = {
    id: 'req-1',
    params: {
      name: 'search',
      arguments: {
        query: 'test',
        context: 'User wants to search for test data'
      }
    }
  };
  
  // Invoke handler
  
  // Verify:
  // 1. Handler received args WITHOUT context
  expect(receivedArgs.context).toBeUndefined();
  expect(receivedArgs.query).toBe('test');
  
  // 2. Context was captured in span
  const tracker = getTracker(server)!;
  const events = tracker.getTelemetryEvents();
  const requestEnd = events.find(e => e.type === 'request_end');
  expect(requestEnd?.data.metadata?.aiContext).toBeDefined();
});
```

**Complexity:** HIGH - Requires full request simulation  
**Value:** CRITICAL - Tests THE key feature  

### Phase 2: Error Handling Tests (HIGH PRIORITY)

#### Test 4: Error Propagation Through Wrappers
```typescript
it('should propagate errors from handlers and track them', async () => {
  const server = new Server({...});
  trackmcp(server, { projectId: 'proj_test' });
  
  server.setRequestHandler(CallToolRequestSchema, async () => {
    throw new Error('Tool execution failed');
  });
  
  // Invoke and expect error
  await expect(invokeHandler()).rejects.toThrow('Tool execution failed');
  
  // Verify error was tracked
  const tracker = getTracker(server)!;
  const metrics = tracker.getCurrentMetrics();
  expect(metrics.failedRequests).toBe(1);
  
  const events = tracker.getTelemetryEvents();
  const errorEvent = events.find(e => e.type === 'request_end' && !e.data.success);
  expect(errorEvent).toBeDefined();
  expect(errorEvent?.data.error).toBeDefined();
});
```

**Complexity:** MEDIUM  
**Value:** HIGH - Critical for production use  

#### Test 5: MCP Error Type Handling
```typescript
it('should handle MCP-specific errors correctly', async () => {
  // Test each MCPErrorType
  // Verify error attributes in spans
  // Verify retryable flag is preserved
});
```

### Phase 3: Hook Execution Tests (HIGH PRIORITY)

#### Test 6: Before/After Hook Execution
```typescript
it('should execute hooks in correct order', async () => {
  const executionOrder: string[] = [];
  
  const server = new Server({...});
  trackmcp(server, { projectId: 'proj_test' });
  
  const tracker = getTracker(server)!;
  tracker.addHook({
    beforeMethod: async () => { executionOrder.push('before'); },
    afterMethod: async () => { executionOrder.push('after'); }
  });
  
  server.setRequestHandler(CallToolRequestSchema, async () => {
    executionOrder.push('handler');
    return { content: [] };
  });
  
  // Invoke handler
  
  expect(executionOrder).toEqual(['before', 'handler', 'after']);
});
```

**Complexity:** MEDIUM  
**Value:** HIGH - Validates hook system  

### Phase 4: Additional Coverage Tests (MEDIUM)

#### Test 7: Multiple Handler Types
```typescript
it('should wrap all MCP method types', async () => {
  // Test: tools/list, tools/call, resources/list, resources/read, 
  //       prompts/list, prompts/get, ping
  // Verify each creates appropriate spans
});
```

#### Test 8: Concurrent Requests
```typescript
it('should handle concurrent requests correctly', async () => {
  // Simulate multiple concurrent handler invocations
  // Verify spans don't interfere
  // Verify metrics count correctly
});
```

#### Test 9: Project ID Propagation
```typescript
it('should propagate projectId to all telemetry', async () => {
  const server = new Server({...});
  trackmcp(server, { projectId: 'proj_test_123' });
  
  // Execute some operations
  
  // Verify ALL telemetry events have projectId
  const tracker = getTracker(server)!;
  const events = tracker.getTelemetryEvents();
  events.forEach(event => {
    expect(event.data.projectId).toBe('proj_test_123');
  });
});
```

## Implementation Challenges

### Challenge 1: Handler Invocation
**Problem:** MCP SDK's `setRequestHandler()` stores handlers internally. Tests need to invoke them.

**Solutions:**
1. **Access internal handler map** (if exposed)
2. **Create test transport** that can send requests
3. **Mock the handler invocation** at a lower level
4. **Use reflection** to access private handler storage

**Recommended:** Option 2 - Create a test transport helper

### Challenge 2: Request/Response Simulation
**Problem:** Need to create valid MCP requests/responses

**Solution:** Create test utilities:
```typescript
// tests/utils/mcp-helpers.ts
export function createToolCallRequest(toolName: string, args: any) {
  return {
    id: `req_${Date.now()}`,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  };
}

export async function invokeHandler(
  server: Server,
  schema: any,
  request: any
): Promise<any> {
  // Helper to invoke wrapped handler
}
```

### Challenge 3: Async Timing
**Problem:** Spans/events may not be immediately available

**Solution:** Add small delays or use vitest's `waitFor`:
```typescript
import { waitFor } from '@testing-library/dom';

await waitFor(() => {
  expect(tracker.getTelemetryEvents().length).toBeGreaterThan(0);
});
```

## Test File Structure

```
tests/
├── core/
│   └── tracker.test.ts (existing - good)
├── integration/
│   ├── server-wrapping.test.ts (ENHANCE THIS)
│   ├── context-injection.test.ts (existing - good)
│   ├── error-handling.test.ts (NEW)
│   ├── hooks.test.ts (NEW)
│   └── end-to-end.test.ts (NEW - full workflow)
├── unit/
│   ├── context-injector.test.ts (NEW)
│   ├── performance-monitor.test.ts (NEW)
│   └── telemetry-providers.test.ts (NEW)
└── utils/
    └── mcp-helpers.ts (NEW - test utilities)
```

## Success Criteria

### Phase 1 Complete When:
- ✅ Request handlers are actually invoked in tests
- ✅ Spans are verified to be created from wrapped handlers
- ✅ Context injection works end-to-end in real scenarios
- ✅ Errors from handlers are properly tracked
- ✅ All telemetry includes projectId

### Metrics Target:
- **Test Coverage:** 80%+ overall
- **Server Wrapping Coverage:** 90%+ (currently 30%)
- **Test Execution Time:** < 2 seconds
- **Tests Passing:** 100%

## Implementation Steps

1. **Create test utilities** (`tests/utils/mcp-helpers.ts`)
   - Request builders
   - Handler invokers
   - Assertion helpers

2. **Enhance server-wrapping.test.ts**
   - Add handler invocation tests
   - Add automatic span creation tests
   - Add context injection integration tests
   - Add error propagation tests
   - Add concurrent request tests

3. **Add error-handling.test.ts**
   - Test each error type
   - Test error recovery
   - Test circuit breaker behavior

4. **Add hooks.test.ts**
   - Test beforeMethod/afterMethod/onError
   - Test hook error handling
   - Test attribute enrichment via hooks

5. **Add end-to-end.test.ts**
   - Full server lifecycle
   - Multiple operations
   - Verify complete telemetry chain

## Estimated Effort

- **Phase 1 (Critical):** 4-6 hours
  - Test utilities: 1-2 hours
  - Enhanced server wrapping tests: 2-3 hours
  - Debugging/refinement: 1 hour

- **Phase 2-4 (High/Medium):** 3-4 hours
  - Error handling tests: 1 hour
  - Hook tests: 1 hour
  - Additional coverage: 1-2 hours

**Total:** 7-10 hours for production-grade test coverage

## Notes

- Focus on **real-world scenarios** not just API coverage
- Each test should **validate actual behavior** not just that functions exist
- Tests should be **independent and idempotent**
- Use **descriptive test names** that explain what's being validated
- Include **edge cases** and **error scenarios**
- Tests should **fail meaningfully** when bugs are introduced