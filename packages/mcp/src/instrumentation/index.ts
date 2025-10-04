import { MCPTracker } from '../core/tracker.js';
import {
  MCPOperationContext,
  MCPMethodCall,
  MCPMethodResult,
  MCPMethodType,
  InstrumentationHook
} from '../types/index.js';

/**
 * High-level instrumentation API for MCP protocol methods
 */
export class MCPInstrumentation {
  private tracker: MCPTracker;
  private methodContexts = new Map<string, MCPOperationContext>();

  constructor(tracker: MCPTracker) {
    this.tracker = tracker;
  }

  /**
   * Instrument a tools/list method call
   */
  async instrumentToolsList(
    handler: () => Promise<unknown>,
    requestId?: string
  ): Promise<unknown> {
    return this.instrumentMethod(
      MCPMethodType.TOOLS_LIST,
      handler,
      requestId
    );
  }

  /**
   * Instrument a tools/call method call
   */
  async instrumentToolsCall(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (toolName: string, args: any) => Promise<any>,
    toolName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any,
    requestId?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    return this.instrumentMethod(
      MCPMethodType.TOOLS_CALL,
      () => handler(toolName, args),
      requestId,
      { toolName, args }
    );
  }

  /**
   * Instrument a resources/list method call
   */
  async instrumentResourcesList(
    handler: () => Promise<unknown>,
    requestId?: string
  ): Promise<unknown> {
    return this.instrumentMethod(
      MCPMethodType.RESOURCES_LIST,
      handler,
      requestId
    );
  }

  /**
   * Instrument a resources/read method call
   */
  async instrumentResourcesRead(
    handler: (uri: string) => Promise<unknown>,
    uri: string,
    requestId?: string
  ): Promise<unknown> {
    return this.instrumentMethod(
      MCPMethodType.RESOURCES_READ,
      () => handler(uri),
      requestId,
      { uri }
    );
  }

  /**
   * Instrument a prompts/list method call
   */
  async instrumentPromptsList(
    handler: () => Promise<unknown>,
    requestId?: string
  ): Promise<unknown> {
    return this.instrumentMethod(
      MCPMethodType.PROMPTS_LIST,
      handler,
      requestId
    );
  }

  /**
   * Instrument a prompts/get method call
   */
  async instrumentPromptsGet(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (promptName: string, args?: any) => Promise<any>,
    promptName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args?: any,
    requestId?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    return this.instrumentMethod(
      MCPMethodType.PROMPTS_GET,
      () => handler(promptName, args),
      requestId,
      { promptName, args }
    );
  }

  /**
   * Instrument a ping method call
   */
  async instrumentPing(
    handler: () => Promise<unknown>,
    requestId?: string
  ): Promise<unknown> {
    return this.instrumentMethod(
      MCPMethodType.PING,
      handler,
      requestId
    );
  }

  /**
   * Generic method instrumentation
   */
  private async instrumentMethod(
    methodType: MCPMethodType,
    handler: () => Promise<unknown>,
    requestId?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    methodParams?: any
  ): Promise<unknown> {
    const context = this.tracker.createOperationContext(
      methodType,
      requestId,
      methodParams
    );

    this.methodContexts.set(context.operationId, context);

    this.tracker.startMCPSpan(methodType, context);

    const methodCall: MCPMethodCall = {
      method: methodType,
      params: methodParams,
      timestamp: Date.now()
    };

    try {
      // Execute before hooks
      await this.tracker.executeBeforeHooks(context, methodCall);

      // Execute the handler
      const result = await handler();

      // End span successfully
      const methodResult: MCPMethodResult = {
        success: true,
        data: result,
        duration: Date.now() - context.startTime,
        timestamp: Date.now()
      };

      this.tracker.endMCPSpan(context.operationId, methodResult);

      // Execute after hooks
      await this.tracker.executeAfterHooks(context, methodResult);

      return result;

    } catch (error) {
      // End span with error
      const methodResult: MCPMethodResult = {
        success: false,
        error: {
          code: (error as Error & { code?: string })?.code || 'METHOD_ERROR',
          message: (error as Error)?.message || 'Method execution failed',
          details: error
        },
        duration: Date.now() - context.startTime,
        timestamp: Date.now()
      };

      this.tracker.endMCPSpan(context.operationId, methodResult);

      // Execute error hooks
      await this.tracker.executeErrorHooks(context, error as Error);

      throw error;
    } finally {
      this.methodContexts.delete(context.operationId);
    }
  }

  /**
   * Add an instrumentation hook
   */
  addHook(hook: InstrumentationHook): void {
    this.tracker.addHook(hook);
  }

  /**
   * Remove an instrumentation hook
   */
  removeHook(hook: InstrumentationHook): void {
    this.tracker.removeHook(hook);
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return this.tracker.getCurrentMetrics();
  }

  /**
   * Get telemetry events
   */
  getTelemetryEvents() {
    return this.tracker.getTelemetryEvents();
  }

  /**
   * Get active span count
   */
  getActiveSpanCount(): number {
    return this.tracker.getActiveSpanCount();
  }

  /**
   * Shutdown instrumentation
   */
  async shutdown(): Promise<void> {
    await this.tracker.shutdown();
  }

  /**
   * Get the underlying tracker instance
   */
  getTracker(): MCPTracker {
    return this.tracker;
  }
}

/**
 * Factory function to create MCP instrumentation
 */
export function createMCPInstrumentation(
  config?: import('../types/index.js').MCPInstrumentationConfig
): MCPInstrumentation {
  const tracker = new MCPTracker(config);
  return new MCPInstrumentation(tracker);
}