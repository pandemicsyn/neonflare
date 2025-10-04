import { Span, SpanStatusCode } from '@opentelemetry/api';
import { MCPOperationContext, MCPMethodResult } from '../types/index.js';

/**
 * MCP-specific error types
 */
export enum MCPErrorType {
  INVALID_REQUEST = 'invalid_request',
  METHOD_NOT_FOUND = 'method_not_found',
  INVALID_PARAMS = 'invalid_params',
  INTERNAL_ERROR = 'internal_error',
  AUTHENTICATION_FAILED = 'authentication_failed',
  AUTHORIZATION_FAILED = 'authorization_failed',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  RESOURCE_EXHAUSTED = 'resource_exhausted',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
  CONNECTION_ERROR = 'connection_error',
  PROTOCOL_ERROR = 'protocol_error'
}

/**
 * MCP-specific error class
 */
export class MCPError extends Error {
  public readonly type: MCPErrorType;
  public readonly code: string | number;
  public readonly details?: any;
  public readonly retryable: boolean;
  public readonly timestamp: number;

  constructor(
    type: MCPErrorType,
    message: string,
    code?: string | number,
    details?: any,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'MCPError';
    this.type = type;
    this.code = code || type;
    this.details = details;
    this.retryable = retryable;
    this.timestamp = Date.now();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPError);
    }
  }

  /**
   * Convert to MCP method result error format
   */
  toMethodResultError(): MCPMethodResult['error'] {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }

  /**
   * Create a user-friendly error message
   */
  toUserMessage(): string {
    switch (this.type) {
      case MCPErrorType.INVALID_REQUEST:
        return 'The request was malformed or missing required information.';
      case MCPErrorType.METHOD_NOT_FOUND:
        return 'The requested method does not exist.';
      case MCPErrorType.INVALID_PARAMS:
        return 'The request parameters are invalid or missing.';
      case MCPErrorType.AUTHENTICATION_FAILED:
        return 'Authentication failed. Please check your credentials.';
      case MCPErrorType.AUTHORIZATION_FAILED:
        return 'You do not have permission to perform this action.';
      case MCPErrorType.RESOURCE_NOT_FOUND:
        return 'The requested resource was not found.';
      case MCPErrorType.RESOURCE_EXHAUSTED:
        return 'The service is temporarily unavailable due to high load.';
      case MCPErrorType.TIMEOUT:
        return 'The operation timed out. Please try again.';
      case MCPErrorType.CONNECTION_ERROR:
        return 'Unable to connect to the service. Please check your connection.';
      default:
        return this.message || 'An unexpected error occurred.';
    }
  }
}

/**
 * Error handler for MCP operations
 */
export class MCPErrorHandler {
  private errorCounts = new Map<MCPErrorType, number>();
  private lastErrorTime = new Map<MCPErrorType, number>();
  private errorThreshold = 10; // errors per time window
  private timeWindow = 60000; // 1 minute

  /**
   * Handle an error in an MCP operation
   */
  async handleError(
    error: Error | MCPError,
    context?: MCPOperationContext,
    span?: Span
  ): Promise<MCPError> {
    // Convert to MCPError if needed
    const mcpError = error instanceof MCPError ? error : this.convertToMCPError(error);

    // Update error statistics
    this.updateErrorStats(mcpError.type);

    // Set span status if provided
    if (span) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: mcpError.message
      });

      // Add error attributes to span
      span.setAttributes({
        'mcp.error_type': mcpError.type,
        'mcp.error_code': mcpError.code,
        'mcp.error_message': mcpError.message,
        'mcp.error_retryable': mcpError.retryable,
        'mcp.error_timestamp': mcpError.timestamp,
        ...(mcpError.details ? { 'mcp.error_details': JSON.stringify(mcpError.details) } : {})
      });
    }

    // Log error with context
    this.logError(mcpError, context);

    // Check if we're experiencing an error storm
    if (this.isErrorStorm(mcpError.type)) {
      console.warn(`[MCP Error Handler] Error storm detected for ${mcpError.type}`);
    }

    return mcpError;
  }

  /**
   * Convert generic error to MCPError
   */
  private convertToMCPError(error: Error): MCPError {
    // Try to infer error type from error message or properties
    if (error.message.includes('timeout') || error.name === 'TimeoutError') {
      return new MCPError(MCPErrorType.TIMEOUT, error.message, 'TIMEOUT', error);
    }

    if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
      return new MCPError(MCPErrorType.CONNECTION_ERROR, error.message, 'CONNECTION_ERROR', error);
    }

    if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
      return new MCPError(MCPErrorType.AUTHENTICATION_FAILED, error.message, 'AUTH_FAILED', error);
    }

    if (error.message.includes('permission') || error.message.includes('forbidden')) {
      return new MCPError(MCPErrorType.AUTHORIZATION_FAILED, error.message, 'AUTHZ_FAILED', error);
    }

    if (error.message.includes('not found')) {
      return new MCPError(MCPErrorType.RESOURCE_NOT_FOUND, error.message, 'NOT_FOUND', error);
    }

    // Default to internal error
    return new MCPError(MCPErrorType.INTERNAL_ERROR, error.message, 'INTERNAL_ERROR', error);
  }

  /**
   * Update error statistics
   */
  private updateErrorStats(errorType: MCPErrorType): void {
    const now = Date.now();
    const count = this.errorCounts.get(errorType) || 0;
    const lastTime = this.lastErrorTime.get(errorType) || 0;

    // Reset count if time window has passed
    if (now - lastTime > this.timeWindow) {
      this.errorCounts.set(errorType, 1);
      this.lastErrorTime.set(errorType, now);
    } else {
      this.errorCounts.set(errorType, count + 1);
    }
  }

  /**
   * Check if we're experiencing an error storm
   */
  private isErrorStorm(errorType: MCPErrorType): boolean {
    const count = this.errorCounts.get(errorType) || 0;
    return count >= this.errorThreshold;
  }

  /**
   * Log error with appropriate level and context
   */
  private logError(error: MCPError, context?: MCPOperationContext): void {
    const logData = {
      type: error.type,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      timestamp: error.timestamp,
      ...(context ? {
        operationId: context.operationId,
        method: context.metadata?.method,
        requestId: context.metadata?.requestId
      } : {})
    };

    if (error.retryable) {
      console.warn('[MCP Error]', logData);
    } else {
      console.error('[MCP Error]', logData);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<MCPErrorType, { count: number; lastOccurrence: number }> {
    const stats: Partial<Record<MCPErrorType, { count: number; lastOccurrence: number }>> = {};

    for (const [errorType, count] of this.errorCounts) {
      stats[errorType] = {
        count,
        lastOccurrence: this.lastErrorTime.get(errorType) || 0
      };
    }

    return stats as Record<MCPErrorType, { count: number; lastOccurrence: number }>;
  }

  /**
   * Reset error statistics
   */
  resetErrorStats(): void {
    this.errorCounts.clear();
    this.lastErrorTime.clear();
  }

  /**
   * Set error threshold for storm detection
   */
  setErrorThreshold(threshold: number): void {
    this.errorThreshold = threshold;
  }

  /**
   * Set time window for error counting
   */
  setTimeWindow(windowMs: number): void {
    this.timeWindow = windowMs;
  }
}

/**
 * Error boundary for wrapping MCP operations
 */
export class MCPErrorBoundary {
  private errorHandler: MCPErrorHandler;

  constructor(errorHandler?: MCPErrorHandler) {
    this.errorHandler = errorHandler || new MCPErrorHandler();
  }

  /**
   * Execute an operation with error handling
   */
  async execute<T>(
    operation: () => Promise<T>,
    context?: MCPOperationContext,
    span?: Span
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const mcpError = await this.errorHandler.handleError(error as Error, context, span);
      throw mcpError;
    }
  }

  /**
   * Wrap a synchronous operation with error handling
   */
  executeSync<T>(
    operation: () => T,
    context?: MCPOperationContext,
    span?: Span
  ): T {
    try {
      return operation();
    } catch (error) {
      const mcpError = this.errorHandler.handleError(error as Error, context, span);
      throw mcpError;
    }
  }

  /**
   * Get the error handler instance
   */
  getErrorHandler(): MCPErrorHandler {
    return this.errorHandler;
  }
}

/**
 * Error recovery strategies
 */
export class MCPErrorRecovery {
  private recoveryStrategies = new Map<MCPErrorType, () => Promise<void>>();

  /**
   * Register a recovery strategy for an error type
   */
  registerRecoveryStrategy(
    errorType: MCPErrorType,
    strategy: () => Promise<void>
  ): void {
    this.recoveryStrategies.set(errorType, strategy);
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(error: MCPError): Promise<boolean> {
    const strategy = this.recoveryStrategies.get(error.type);
    if (!strategy) {
      return false;
    }

    try {
      await strategy();
      console.log(`[MCP Error Recovery] Successfully recovered from ${error.type}`);
      return true;
    } catch (recoveryError) {
      console.error(`[MCP Error Recovery] Failed to recover from ${error.type}:`, recoveryError);
      return false;
    }
  }

  /**
   * Get all registered recovery strategies
   */
  getRecoveryStrategies(): Map<MCPErrorType, () => Promise<void>> {
    return new Map(this.recoveryStrategies);
  }
}

/**
 * Error filter for suppressing known harmless errors
 */
export class MCPErrorFilter {
  private suppressedErrors = new Set<string>();
  private suppressedPatterns: RegExp[] = [];

  /**
   * Suppress an error by message
   */
  suppressError(message: string): void {
    this.suppressedErrors.add(message);
  }

  /**
   * Suppress errors matching a pattern
   */
  suppressErrorPattern(pattern: RegExp): void {
    this.suppressedPatterns.push(pattern);
  }

  /**
   * Check if an error should be suppressed
   */
  shouldSuppress(error: Error | MCPError): boolean {
    const message = error.message;

    // Check exact message match
    if (this.suppressedErrors.has(message)) {
      return true;
    }

    // Check pattern matches
    return this.suppressedPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Remove suppression for an error message
   */
  unsuppressError(message: string): void {
    this.suppressedErrors.delete(message);
  }

  /**
   * Remove suppression for an error pattern
   */
  unsuppressErrorPattern(pattern: RegExp): void {
    const index = this.suppressedPatterns.indexOf(pattern);
    if (index > -1) {
      this.suppressedPatterns.splice(index, 1);
    }
  }

  /**
   * Clear all suppressions
   */
  clearSuppressions(): void {
    this.suppressedErrors.clear();
    this.suppressedPatterns.length = 0;
  }
}

/**
 * Global error handler instance
 */
let globalErrorHandler: MCPErrorHandler | null = null;

/**
 * Get or create the global error handler
 */
export function getErrorHandler(): MCPErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new MCPErrorHandler();
  }
  return globalErrorHandler;
}

/**
 * Set the global error handler
 */
export function setErrorHandler(handler: MCPErrorHandler): void {
  globalErrorHandler = handler;
}

/**
 * Reset the global error handler (mainly for testing)
 */
export function resetErrorHandler(): void {
  globalErrorHandler = null;
}

/**
 * Convenience functions for creating common MCP errors
 */
export const Errors = {
  invalidRequest: (message: string, details?: any) =>
    new MCPError(MCPErrorType.INVALID_REQUEST, message, 'INVALID_REQUEST', details),

  methodNotFound: (method: string) =>
    new MCPError(MCPErrorType.METHOD_NOT_FOUND, `Method '${method}' not found`, 'METHOD_NOT_FOUND', { method }),

  invalidParams: (param: string, details?: any) =>
    new MCPError(MCPErrorType.INVALID_PARAMS, `Invalid parameter: ${param}`, 'INVALID_PARAMS', details),

  internalError: (message: string, details?: any) =>
    new MCPError(MCPErrorType.INTERNAL_ERROR, message, 'INTERNAL_ERROR', details),

  authenticationFailed: (details?: any) =>
    new MCPError(MCPErrorType.AUTHENTICATION_FAILED, 'Authentication failed', 'AUTH_FAILED', details),

  authorizationFailed: (resource?: string) =>
    new MCPError(MCPErrorType.AUTHORIZATION_FAILED, 'Authorization failed', 'AUTHZ_FAILED', { resource }),

  resourceNotFound: (resource: string) =>
    new MCPError(MCPErrorType.RESOURCE_NOT_FOUND, `Resource not found: ${resource}`, 'NOT_FOUND', { resource }),

  resourceExhausted: (resource: string) =>
    new MCPError(MCPErrorType.RESOURCE_EXHAUSTED, `Resource exhausted: ${resource}`, 'RESOURCE_EXHAUSTED', { resource }, true),

  timeout: (operation: string) =>
    new MCPError(MCPErrorType.TIMEOUT, `Operation timed out: ${operation}`, 'TIMEOUT', { operation }),

  cancelled: (operation: string) =>
    new MCPError(MCPErrorType.CANCELLED, `Operation cancelled: ${operation}`, 'CANCELLED', { operation }),

  connectionError: (target: string, details?: any) =>
    new MCPError(MCPErrorType.CONNECTION_ERROR, `Connection error: ${target}`, 'CONNECTION_ERROR', details, true),

  protocolError: (message: string, details?: any) =>
    new MCPError(MCPErrorType.PROTOCOL_ERROR, message, 'PROTOCOL_ERROR', details)
};