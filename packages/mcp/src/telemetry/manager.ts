import { TelemetryManager, TelemetryProviderConfig } from './interfaces.js';
import { MetricsProvider, TraceProvider } from './interfaces.js';
import { TelemetryEvent, MCPMetrics, MCPMethodType } from '../types/index.js';
import {
  ConsoleTelemetryProvider,
  MemoryTelemetryProvider,
  OTLPTTelemetryProvider,
  CompositeTelemetryProvider
} from './providers.js';

/**
 * Factory for creating telemetry providers based on configuration
 */
export class TelemetryProviderFactory {
  static createProvider(config: TelemetryProviderConfig): MetricsProvider | TraceProvider {
    switch (config.type) {
      case 'console':
        return new ConsoleTelemetryProvider();

      case 'memory':
        return new MemoryTelemetryProvider();

      case 'otlp':
        return new OTLPTTelemetryProvider({
          endpoint: config.config?.otlp?.endpoint,
          headers: config.config?.otlp?.headers
        });

      case 'composite': {
        const providers = (config.config?.composite?.providers || []).map(p =>
          TelemetryProviderFactory.createProvider(p)
        );
        return new CompositeTelemetryProvider(providers);
      }

      default:
        throw new Error(`Unknown telemetry provider type: ${config.type}`);
    }
  }
}

/**
 * Default telemetry manager implementation
 */
export class DefaultTelemetryManager implements TelemetryManager {
  private providers: (MetricsProvider | TraceProvider)[] = [];

  constructor(providers?: (MetricsProvider | TraceProvider)[]) {
    if (providers) {
      this.providers = providers;
    } else {
      // Add default console provider
      this.providers = [new ConsoleTelemetryProvider()];
    }
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

  getProviders(): (MetricsProvider | TraceProvider)[] {
    return [...this.providers];
  }

  recordEvent(event: TelemetryEvent): void {
    this.providers.forEach(provider => {
      try {
        provider.recordEvent(event);
      } catch (error) {
        console.warn('[TelemetryManager] Error recording event:', error);
      }
    });
  }

  getMetrics(): MCPMetrics {
    const metrics = this.providers
      .filter((p): p is MetricsProvider => 'getMetrics' in p)
      .map(p => p.getMetrics());

    if (metrics.length === 0) {
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

    // Aggregate metrics from all providers
    return {
      totalRequests: metrics.reduce((sum, m) => sum + m.totalRequests, 0),
      successfulRequests: metrics.reduce((sum, m) => sum + m.successfulRequests, 0),
      failedRequests: metrics.reduce((sum, m) => sum + m.failedRequests, 0),
      averageDuration: metrics.reduce((sum, m) => sum + m.averageDuration, 0) / metrics.length,
      requestsPerSecond: metrics.reduce((sum, m) => sum + m.requestsPerSecond, 0) / metrics.length,
      activeSessions: metrics.reduce((sum, m) => sum + m.activeSessions, 0),
      methodMetrics: metrics[0].methodMetrics // Use first provider's method metrics for now
    };
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

  /**
   * Create a telemetry manager from configuration
   */
  static fromConfig(config: TelemetryProviderConfig[]): DefaultTelemetryManager {
    const providers = config.map(c => TelemetryProviderFactory.createProvider(c));
    return new DefaultTelemetryManager(providers);
  }
}

/**
 * Global telemetry manager instance
 */
let globalTelemetryManager: DefaultTelemetryManager | null = null;

/**
 * Get or create the global telemetry manager
 */
export function getTelemetryManager(): DefaultTelemetryManager {
  if (!globalTelemetryManager) {
    globalTelemetryManager = new DefaultTelemetryManager();
  }
  return globalTelemetryManager;
}

/**
 * Set the global telemetry manager
 */
export function setTelemetryManager(manager: DefaultTelemetryManager): void {
  globalTelemetryManager = manager;
}

/**
 * Reset the global telemetry manager (mainly for testing)
 */
export function resetTelemetryManager(): void {
  if (globalTelemetryManager) {
    globalTelemetryManager.shutdown();
    globalTelemetryManager = null;
  }
}