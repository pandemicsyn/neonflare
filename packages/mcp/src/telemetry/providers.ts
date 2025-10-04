import { MetricsProvider, TraceProvider } from './interfaces.js';
import { TelemetryEvent, MCPMetrics, MCPMethodType } from '../types/index.js';

/**
 * Console-based telemetry provider for development and debugging
 */
export class ConsoleTelemetryProvider implements MetricsProvider, TraceProvider {
  private events: TelemetryEvent[] = [];
  private startTime = Date.now();

  recordEvent(event: TelemetryEvent): void {
    this.events.push(event);
    console.log(`[MCP Telemetry] ${event.type}:`, event.data);

    // Keep only recent events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-500);
    }
  }

  getMetrics(): MCPMetrics {
    const now = Date.now();

    const totalRequests = this.events.filter(e => e.type === 'request_end').length;
    const successfulRequests = this.events.filter(e =>
      e.type === 'request_end' && e.data.success
    ).length;
    const failedRequests = totalRequests - successfulRequests;

    const durations = this.events
      .filter(e => e.type === 'request_end' && e.data.duration)
      .map(e => e.data.duration);

    const averageDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    // Calculate requests per second (over last minute)
    const recentEvents = this.events.filter(e =>
      e.type === 'request_end' &&
      now - e.timestamp < 60000
    );
    const requestsPerSecond = recentEvents.length / 60;

    // Initialize method metrics for all MCP method types
    const methodMetrics: Record<MCPMethodType, { count: number; averageDuration: number; errorCount: number }> = {
      [MCPMethodType.TOOLS_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.TOOLS_CALL]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.RESOURCES_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.RESOURCES_READ]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.PROMPTS_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.PROMPTS_GET]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.PING]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.INITIALIZE]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.INITIALIZED]: { count: 0, averageDuration: 0, errorCount: 0 }
    };

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageDuration,
      requestsPerSecond,
      activeSessions: 0, // Not tracked in console provider
      methodMetrics
    };
  }

  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  exportTraces(): Promise<void> {
    // Console provider doesn't export traces externally
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    console.log(`[MCP Telemetry] Shutting down. Recorded ${this.events.length} events.`);
    this.events.length = 0;
    return Promise.resolve();
  }
}

/**
 * In-memory telemetry provider for testing and development
 */
export class MemoryTelemetryProvider implements MetricsProvider, TraceProvider {
  private events: TelemetryEvent[] = [];
  private maxEvents = 10000;

  recordEvent(event: TelemetryEvent): void {
    this.events.push(event);

    // Keep only recent events to prevent memory leaks
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  getMetrics(): MCPMetrics {
    const totalRequests = this.events.filter(e => e.type === 'request_end').length;
    const successfulRequests = this.events.filter(e =>
      e.type === 'request_end' && e.data.success
    ).length;
    const failedRequests = totalRequests - successfulRequests;

    const durations = this.events
      .filter(e => e.type === 'request_end' && e.data.duration)
      .map(e => e.data.duration);

    const averageDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    const requestsPerSecond = this.calculateRequestsPerSecond();

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageDuration,
      requestsPerSecond,
      activeSessions: 0,
      methodMetrics: {
        [MCPMethodType.TOOLS_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.TOOLS_CALL]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.RESOURCES_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.RESOURCES_READ]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.PROMPTS_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.PROMPTS_GET]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.PING]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.INITIALIZE]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.INITIALIZED]: { count: 0, averageDuration: 0, errorCount: 0 }
      }
    };
  }

  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  private calculateRequestsPerSecond(): number {
    const now = Date.now();
    const recentEvents = this.events.filter(e =>
      e.type === 'request_end' &&
      now - e.timestamp < 60000
    );
    return recentEvents.length / 60;
  }

  exportTraces(): Promise<void> {
    // Memory provider doesn't export traces externally
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    this.events.length = 0;
    return Promise.resolve();
  }

  /**
   * Get events by type
   */
  getEventsByType(type: string): TelemetryEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Get events within time range
   */
  getEventsInRange(startTime: number, endTime: number): TelemetryEvent[] {
    return this.events.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events.length = 0;
  }
}

/**
 * OTLP telemetry provider for production trace export
 */
export class OTLPTTelemetryProvider implements TraceProvider {
  private otlpEndpoint?: string;
  private headers?: Record<string, string>;

  constructor(config?: { endpoint?: string; headers?: Record<string, string> }) {
    this.otlpEndpoint = config?.endpoint;
    this.headers = config?.headers;
  }

  recordEvent(event: TelemetryEvent): void {
    // OTLP provider focuses on trace export, not event recording
    console.log(`[OTLP] Event recorded: ${event.type}`);
  }

  getMetrics(): MCPMetrics {
    // OTLP provider doesn't collect metrics
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageDuration: 0,
      requestsPerSecond: 0,
      activeSessions: 0,
      methodMetrics: {
        [MCPMethodType.TOOLS_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.TOOLS_CALL]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.RESOURCES_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.RESOURCES_READ]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.PROMPTS_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.PROMPTS_GET]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.PING]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.INITIALIZE]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.INITIALIZED]: { count: 0, averageDuration: 0, errorCount: 0 }
      }
    };
  }

  getEvents(): TelemetryEvent[] {
    return [];
  }

  async exportTraces(): Promise<void> {
    if (!this.otlpEndpoint) {
      console.warn('[OTLP] No endpoint configured for trace export');
      return;
    }

    try {
      // In a real implementation, this would export traces to OTLP
      console.log(`[OTLP] Exporting traces to ${this.otlpEndpoint}`);

      // Simulate OTLP export
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error('[OTLP] Failed to export traces:', error);
      throw error;
    }
  }

  shutdown(): Promise<void> {
    console.log('[OTLP] Provider shutdown');
    return Promise.resolve();
  }
}

/**
 * Composite telemetry provider that combines multiple providers
 */
export class CompositeTelemetryProvider implements MetricsProvider, TraceProvider {
  private providers: (MetricsProvider | TraceProvider)[] = [];

  constructor(providers: (MetricsProvider | TraceProvider)[] = []) {
    this.providers = providers;
  }

  addProvider(provider: MetricsProvider | TraceProvider): void {
    this.providers.push(provider);
  }

  removeProvider(provider: MetricsProvider | TraceProvider): void {
    const index = this.providers.indexOf(provider);
    if (index > -1) {
      this.providers.splice(index, 1);
    }
  }

  recordEvent(event: TelemetryEvent): void {
    this.providers.forEach(provider => {
      try {
        provider.recordEvent(event);
      } catch (error) {
        console.warn('[Composite] Error in provider:', error);
      }
    });
  }

  getMetrics(): MCPMetrics {
    const metrics = this.providers
      .filter((p): p is MetricsProvider => 'getMetrics' in p)
      .map(p => p.getMetrics());

    if (metrics.length === 0) {
      const methodMetrics: Record<MCPMethodType, { count: number; averageDuration: number; errorCount: number }> = {
        [MCPMethodType.TOOLS_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.TOOLS_CALL]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.RESOURCES_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.RESOURCES_READ]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.PROMPTS_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.PROMPTS_GET]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.PING]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.INITIALIZE]: { count: 0, averageDuration: 0, errorCount: 0 },
        [MCPMethodType.INITIALIZED]: { count: 0, averageDuration: 0, errorCount: 0 }
      };

      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageDuration: 0,
        requestsPerSecond: 0,
        activeSessions: 0,
        methodMetrics
      };
    }

    // Aggregate metrics from all providers
    const methodMetrics: Record<MCPMethodType, { count: number; averageDuration: number; errorCount: number }> = {
      [MCPMethodType.TOOLS_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.TOOLS_CALL]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.RESOURCES_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.RESOURCES_READ]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.PROMPTS_LIST]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.PROMPTS_GET]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.PING]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.INITIALIZE]: { count: 0, averageDuration: 0, errorCount: 0 },
      [MCPMethodType.INITIALIZED]: { count: 0, averageDuration: 0, errorCount: 0 }
    };

    return {
      totalRequests: metrics.reduce((sum, m) => sum + m.totalRequests, 0),
      successfulRequests: metrics.reduce((sum, m) => sum + m.successfulRequests, 0),
      failedRequests: metrics.reduce((sum, m) => sum + m.failedRequests, 0),
      averageDuration: metrics.reduce((sum, m) => sum + m.averageDuration, 0) / metrics.length,
      requestsPerSecond: metrics.reduce((sum, m) => sum + m.requestsPerSecond, 0) / metrics.length,
      activeSessions: metrics.reduce((sum, m) => sum + m.activeSessions, 0),
      methodMetrics
    };
  }

  getEvents(): TelemetryEvent[] {
    const allEvents = this.providers
      .filter((p): p is MetricsProvider => 'getEvents' in p)
      .flatMap(p => p.getEvents());

    // Remove duplicates and sort by timestamp
    const uniqueEvents = allEvents
      .filter((event, index, self) =>
        index === self.findIndex(e =>
          e.timestamp === event.timestamp && e.type === event.type
        )
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    return uniqueEvents;
  }

  async exportTraces(): Promise<void> {
    const traceProviders = this.providers.filter((p): p is TraceProvider =>
      'exportTraces' in p
    );

    await Promise.all(
      traceProviders.map(provider => provider.exportTraces())
    );
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      this.providers.map(provider => provider.shutdown?.())
    );
  }
}