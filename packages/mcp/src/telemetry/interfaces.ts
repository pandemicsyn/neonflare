import { TelemetryEvent, MCPMetrics } from '../types/index.js';

/**
 * Interface for collecting and providing metrics
 */
export interface MetricsProvider {
  /**
   * Record a telemetry event
   */
  recordEvent(event: TelemetryEvent): void;

  /**
   * Get current metrics
   */
  getMetrics(): MCPMetrics;

  /**
   * Get all recorded events
   */
  getEvents(): TelemetryEvent[];

  /**
   * Shutdown the provider and cleanup resources
   */
  shutdown(): Promise<void>;
}

/**
 * Interface for trace export functionality
 */
export interface TraceProvider {
  /**
   * Record a telemetry event for tracing
   */
  recordEvent(event: TelemetryEvent): void;

  /**
   * Get current metrics (may not be applicable for all trace providers)
   */
  getMetrics(): MCPMetrics;

  /**
   * Get all recorded events
   */
  getEvents(): TelemetryEvent[];

  /**
   * Export traces to external systems
   */
  exportTraces(): Promise<void>;

  /**
   * Shutdown the provider and cleanup resources
   */
  shutdown(): Promise<void>;
}

/**
 * Configuration for telemetry providers
 */
export interface TelemetryProviderConfig {
  /** Provider type */
  type: 'console' | 'memory' | 'otlp' | 'composite';

  /** Provider-specific configuration */
  config?: {
    /** Console provider config */
    console?: {
      /** Whether to enable colored output */
      colored?: boolean;
      /** Log level */
      level?: 'debug' | 'info' | 'warn' | 'error';
    };

    /** Memory provider config */
    memory?: {
      /** Maximum number of events to keep in memory */
      maxEvents?: number;
      /** Whether to enable event filtering */
      enableFiltering?: boolean;
    };

    /** OTLP provider config */
    otlp?: {
      /** OTLP endpoint URL */
      endpoint?: string;
      /** Headers for OTLP requests */
      headers?: Record<string, string>;
      /** Export timeout in milliseconds */
      timeout?: number;
      /** Whether to use secure connection */
      secure?: boolean;
    };

    /** Composite provider config */
    composite?: {
      /** Child providers to combine */
      providers?: TelemetryProviderConfig[];
    };
  };
}

/**
 * Factory function type for creating telemetry providers
 */
export type ProviderFactory = (
  config?: TelemetryProviderConfig
) => MetricsProvider | TraceProvider;

/**
 * Telemetry manager that coordinates multiple providers
 */
export interface TelemetryManager {
  /**
   * Add a provider
   */
  addProvider(provider: MetricsProvider | TraceProvider): void;

  /**
   * Remove a provider
   */
  removeProvider(provider: MetricsProvider | TraceProvider): void;

  /**
   * Get all providers
   */
  getProviders(): (MetricsProvider | TraceProvider)[];

  /**
   * Record event across all providers
   */
  recordEvent(event: TelemetryEvent): void;

  /**
   * Get aggregated metrics from all providers
   */
  getMetrics(): MCPMetrics;

  /**
   * Export traces from all trace providers
   */
  exportTraces(): Promise<void>;

  /**
   * Shutdown all providers
   */
  shutdown(): Promise<void>;
}