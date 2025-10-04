import { Attributes, Span, Link, SpanContext } from '@opentelemetry/api';
import { MCPSpanAttributes } from '../types/index.js';

/**
 * Utility functions for working with OpenTelemetry spans and attributes
 */

/**
 * Create standardized span attributes for MCP operations
 */
export function createMCPAttributes(
  method: string,
  operationId: string,
  additionalAttributes?: Record<string, string | number | boolean>
): MCPSpanAttributes {
  return {
    'mcp.method': method,
    'mcp.operation_id': operationId,
    'mcp.timestamp': Date.now(),
    'mcp.success': true, // Default value, should be overridden
    'mcp.duration_ms': 0, // Default value, should be overridden
    ...additionalAttributes
  };
}

/**
 * Create error attributes for failed operations
 */
export function createErrorAttributes(
  error: Error | { code: string | number; message: string; details?: any }
): Partial<MCPSpanAttributes> {
  if (error instanceof Error) {
    return {
      'mcp.error_code': 'UNKNOWN_ERROR',
      'mcp.error_message': error.message,
      'mcp.error_stack': error.stack || ''
    };
  }

  return {
    'mcp.error_code': error.code,
    'mcp.error_message': error.message,
    'mcp.error_details': JSON.stringify(error.details || {})
  };
}

/**
 * Create performance-related attributes
 */
export function createPerformanceAttributes(
  duration: number,
  memoryUsage?: number,
  cpuUsage?: number
): Partial<MCPSpanAttributes> {
  return {
    'mcp.duration_ms': duration,
    ...(memoryUsage !== undefined ? { 'perf.memory_mb': Math.round(memoryUsage / 1024 / 1024) } : {}),
    ...(cpuUsage !== undefined ? { 'perf.cpu_percent': cpuUsage } : {})
  };
}

/**
 * Create correlation attributes for distributed tracing
 */
export function createCorrelationAttributes(
  traceId?: string,
  spanId?: string,
  parentSpanId?: string
): Partial<MCPSpanAttributes> {
  return {
    ...(traceId ? { 'correlation.trace_id': traceId } : {}),
    ...(spanId ? { 'correlation.span_id': spanId } : {}),
    ...(parentSpanId ? { 'correlation.parent_span_id': parentSpanId } : {})
  };
}

/**
 * Sanitize attribute values to ensure they're valid for OpenTelemetry
 */
export function sanitizeAttributeValue(value: any): string | number | boolean {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    // Truncate long strings
    return value.length > 256 ? value.substring(0, 256) + '...' : value;
  }

  if (typeof value === 'number') {
    // Handle NaN and infinite values
    if (!isFinite(value)) {
      return 0;
    }
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  // Convert objects and arrays to strings
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).substring(0, 256);
    } catch {
      return '[object]';
    }
  }

  return String(value);
}

/**
 * Sanitize all attributes in an object
 */
export function sanitizeAttributes(attributes: Record<string, any>): Attributes {
  const sanitized: Attributes = {};

  for (const [key, value] of Object.entries(attributes)) {
    sanitized[key] = sanitizeAttributeValue(value);
  }

  return sanitized;
}

/**
 * Generate a correlation ID for tracing across service boundaries
 */
export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract correlation information from span context
 */
export function extractCorrelationInfo(spanContext: SpanContext): {
  traceId: string;
  spanId: string;
  traceFlags: number;
} {
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags
  };
}

/**
 * Create a span link for correlation
 */
export function createSpanLink(spanContext: SpanContext, attributes?: Attributes): Link {
  return {
    context: spanContext,
    attributes: attributes || {}
  };
}

/**
 * Format span attributes for logging
 */
export function formatAttributesForLogging(attributes: Attributes): string {
  const pairs = Object.entries(attributes)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');

  return pairs;
}

/**
 * Create database operation attributes
 */
export function createDatabaseAttributes(
  operation: string,
  table?: string,
  rowsAffected?: number,
  connectionString?: string
): Partial<MCPSpanAttributes> {
  return {
    'db.operation': operation,
    ...(table ? { 'db.table': table } : {}),
    ...(rowsAffected !== undefined ? { 'db.rows_affected': rowsAffected } : {}),
    ...(connectionString ? { 'db.connection_string': sanitizeConnectionString(connectionString) } : {})
  };
}

/**
 * Create HTTP request attributes
 */
export function createHTTPRequestAttributes(
  method: string,
  url: string,
  statusCode?: number,
  duration?: number
): Partial<MCPSpanAttributes> {
  return {
    'http.method': method,
    'http.url': url,
    ...(statusCode ? { 'http.status_code': statusCode } : {}),
    ...(duration ? { 'http.duration_ms': duration } : {})
  };
}

/**
 * Create user interaction attributes
 */
export function createUserAttributes(
  userId?: string,
  sessionId?: string,
  action?: string
): Partial<MCPSpanAttributes> {
  return {
    ...(userId ? { 'user.id': userId } : {}),
    ...(sessionId ? { 'user.session_id': sessionId } : {}),
    ...(action ? { 'user.action': action } : {})
  };
}

/**
 * Sanitize connection string for logging (remove sensitive data)
 */
export function sanitizeConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    // Remove password from URL
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    // If it's not a valid URL, replace common password patterns
    return connectionString
      .replace(/password=[^&\s]*/gi, 'password=***')
      .replace(/pwd=[^&\s]*/gi, 'pwd=***');
  }
}

/**
 * Create business logic attributes
 */
export function createBusinessAttributes(
  domain: string,
  operation: string,
  entityType?: string,
  entityId?: string
): Partial<MCPSpanAttributes> {
  return {
    'business.domain': domain,
    'business.operation': operation,
    ...(entityType ? { 'business.entity_type': entityType } : {}),
    ...(entityId ? { 'business.entity_id': entityId } : {})
  };
}

/**
 * Merge multiple attribute objects
 */
export function mergeAttributes(...attributeObjects: (Attributes | undefined)[]): Attributes {
  const merged: Attributes = {};

  for (const attrs of attributeObjects) {
    if (attrs) {
      Object.assign(merged, attrs);
    }
  }

  return merged;
}

/**
 * Filter attributes based on patterns
 */
export function filterAttributes(
  attributes: Attributes,
  includePatterns?: string[],
  excludePatterns?: string[]
): Attributes {
  const filtered: Attributes = {};

  for (const [key, value] of Object.entries(attributes)) {
    const shouldInclude = !includePatterns || includePatterns.some(pattern =>
      key.includes(pattern) || new RegExp(pattern).test(key)
    );

    const shouldExclude = excludePatterns?.some(pattern =>
      key.includes(pattern) || new RegExp(pattern).test(key)
    );

    if (shouldInclude && !shouldExclude) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Create a span event with formatted message
 */
export function createSpanEvent(
  name: string,
  attributes?: Attributes,
  timestamp?: number
): { name: string; attributes?: Attributes; timestamp?: number } {
  return {
    name,
    attributes: attributes ? sanitizeAttributes(attributes) : undefined,
    timestamp: timestamp || Date.now()
  };
}

/**
 * Validate span attribute key (OpenTelemetry specification)
 */
export function isValidAttributeKey(key: string): boolean {
  // Attribute keys must be non-empty strings
  if (typeof key !== 'string' || key.length === 0) {
    return false;
  }

  // Must not start with underscore (reserved for OpenTelemetry)
  if (key.startsWith('_')) {
    return false;
  }

  // Must match pattern: [a-z][a-z0-9._-]* (case insensitive)
  const validPattern = /^[a-zA-Z][a-zA-Z0-9._-]*$/;
  return validPattern.test(key);
}

/**
 * Validate and sanitize attribute keys
 */
export function sanitizeAttributeKeys(attributes: Record<string, any>): Attributes {
  const sanitized: Attributes = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (isValidAttributeKey(key)) {
      sanitized[key] = sanitizeAttributeValue(value);
    } else {
      // Create a sanitized version of the key
      const sanitizedKey = key
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/^_+/, '')
        .toLowerCase();

      if (sanitizedKey.length > 0 && isValidAttributeKey(sanitizedKey)) {
        sanitized[sanitizedKey] = sanitizeAttributeValue(value);
      }
    }
  }

  return sanitized;
}

/**
 * Create a timing attribute for measuring operation duration
 */
export function createTimingAttributes(
  operationName: string,
  startTime: number,
  endTime?: number
): Partial<MCPSpanAttributes> {
  const now = endTime || Date.now();
  const duration = now - startTime;

  return {
    [`timing.${operationName}_start`]: startTime,
    [`timing.${operationName}_duration`]: duration,
    ...(endTime ? { [`timing.${operationName}_end`]: endTime } : {})
  };
}

/**
 * Create resource usage attributes
 */
export function createResourceAttributes(
  resourceType: 'memory' | 'cpu' | 'disk' | 'network',
  usage: number,
  unit?: string
): Partial<MCPSpanAttributes> {
  return {
    [`resource.${resourceType}_usage`]: usage,
    ...(unit ? { [`resource.${resourceType}_unit`]: unit } : {})
  };
}

/**
 * Create security-related attributes
 */
export function createSecurityAttributes(
  action: string,
  resource?: string,
  userId?: string,
  success?: boolean
): Partial<MCPSpanAttributes> {
  return {
    'security.action': action,
    ...(resource ? { 'security.resource': resource } : {}),
    ...(userId ? { 'security.user_id': userId } : {}),
    ...(success !== undefined ? { 'security.success': success } : {})
  };
}

/**
 * Create custom metric attributes
 */
export function createMetricAttributes(
  metricName: string,
  value: number,
  unit?: string,
  tags?: Record<string, string>
): Partial<MCPSpanAttributes> {
  return {
    [`metric.${metricName}_value`]: value,
    ...(unit ? { [`metric.${metricName}_unit`]: unit } : {}),
    ...Object.entries(tags || {}).reduce((acc, [key, tagValue]) => {
      acc[`metric.${metricName}_tag_${key}`] = tagValue;
      return acc;
    }, {} as Record<string, string>)
  };
}

/**
 * Utility class for managing span attributes
 */
export class AttributeManager {
  private attributes: Map<string, string | number | boolean> = new Map();

  set(key: string, value: string | number | boolean): void {
    this.attributes.set(key, value);
  }

  get(key: string): string | number | boolean | undefined {
    return this.attributes.get(key);
  }

  has(key: string): boolean {
    return this.attributes.has(key);
  }

  delete(key: string): boolean {
    return this.attributes.delete(key);
  }

  clear(): void {
    this.attributes.clear();
  }

  size(): number {
    return this.attributes.size;
  }

  toAttributes(): Attributes {
    return sanitizeAttributes(Object.fromEntries(this.attributes));
  }

  merge(other: AttributeManager): AttributeManager {
    const merged = new AttributeManager();
    merged.attributes = new Map([...this.attributes, ...other.attributes]);
    return merged;
  }

  filter(predicate: (key: string, value: any) => boolean): AttributeManager {
    const filtered = new AttributeManager();
    for (const [key, value] of this.attributes) {
      if (predicate(key, value)) {
        filtered.set(key, value);
      }
    }
    return filtered;
  }
}