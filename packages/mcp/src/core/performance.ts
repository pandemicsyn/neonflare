import { Span } from '@opentelemetry/api';
import { MCPOperationContext, MCPSpanAttributes } from '../types/index.js';
import { createTimingAttributes, createResourceAttributes } from '../utils/index.js';

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  /** Whether to enable performance monitoring */
  enabled?: boolean;
  /** Performance thresholds for warnings */
  thresholds?: {
    /** Maximum operation duration in milliseconds */
    maxDuration?: number;
    /** Maximum memory usage in MB */
    maxMemoryUsage?: number;
    /** Maximum CPU usage percentage */
    maxCpuUsage?: number;
  };
  /** Whether to collect system metrics */
  collectSystemMetrics?: boolean;
  /** Performance sampling rate (0.0 to 1.0) */
  samplingRate?: number;
}

/**
 * Performance metrics data
 */
export interface PerformanceMetrics {
  /** Operation duration in milliseconds */
  duration: number;
  /** Memory usage in bytes */
  memoryUsage?: number;
  /** CPU usage percentage */
  cpuUsage?: number;
  /** Network latency in milliseconds */
  networkLatency?: number;
  /** Database query time in milliseconds */
  dbQueryTime?: number;
  /** Cache hit rate percentage */
  cacheHitRate?: number;
  /** Error rate percentage */
  errorRate?: number;
  /** Throughput (operations per second) */
  throughput?: number;
}

/**
 * Performance monitor for tracking operation performance
 */
export class PerformanceMonitor {
  private config: PerformanceConfig;
  private metricsHistory: Array<{ timestamp: number; metrics: PerformanceMetrics }> = [];
  private maxHistorySize = 1000;

  constructor(config: PerformanceConfig = {}) {
    this.config = {
      enabled: true,
      collectSystemMetrics: false,
      samplingRate: 1.0,
      thresholds: {
        maxDuration: 5000, // 5 seconds
        maxMemoryUsage: 100, // 100 MB
        maxCpuUsage: 80 // 80%
      },
      ...config
    };
  }

  /**
   * Monitor the performance of an async operation
   */
  async monitorAsync<T>(
    operation: () => Promise<T>,
    operationName?: string,
    context?: MCPOperationContext,
    span?: Span
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    if (!this.config.enabled || Math.random() > (this.config.samplingRate || 1.0)) {
      const result = await operation();
      return { result, metrics: { duration: 0 } };
    }

    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;

      const metrics: PerformanceMetrics = {
        duration,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: await this.getCpuUsage()
      };

      // Check thresholds
      this.checkThresholds(metrics, operationName);

      // Record metrics
      this.recordMetrics(metrics);

      // Add performance attributes to span
      if (span) {
        const perfAttributes = this.createPerformanceAttributes(metrics);
        span.setAttributes(perfAttributes);
      }

      return { result, metrics };

    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const metrics: PerformanceMetrics = {
        duration,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: await this.getCpuUsage()
      };

      this.recordMetrics(metrics);
      throw error;
    }
  }

  /**
   * Monitor the performance of a synchronous operation
   */
  monitorSync<T>(
    operation: () => T,
    operationName?: string,
    context?: MCPOperationContext,
    span?: Span
  ): { result: T; metrics: PerformanceMetrics } {
    if (!this.config.enabled || Math.random() > (this.config.samplingRate || 1.0)) {
      const result = operation();
      return { result, metrics: { duration: 0 } };
    }

    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    try {
      const result = operation();
      const endTime = performance.now();
      const duration = endTime - startTime;

      const metrics: PerformanceMetrics = {
        duration,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCpuUsageSync()
      };

      // Check thresholds
      this.checkThresholds(metrics, operationName);

      // Record metrics
      this.recordMetrics(metrics);

      // Add performance attributes to span
      if (span) {
        const perfAttributes = this.createPerformanceAttributes(metrics);
        span.setAttributes(perfAttributes);
      }

      return { result, metrics };

    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const metrics: PerformanceMetrics = {
        duration,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCpuUsageSync()
      };

      this.recordMetrics(metrics);
      throw error;
    }
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Get current CPU usage (async)
   */
  private async getCpuUsage(): Promise<number> {
    if (!this.config.collectSystemMetrics) {
      return 0;
    }

    try {
      if (typeof process !== 'undefined' && process.cpuUsage) {
        const usage = process.cpuUsage();
        // Convert microseconds to percentage (rough estimate)
        return Math.min(100, (usage.user + usage.system) / 1000);
      }
    } catch {
      // Ignore errors in CPU usage collection
    }

    return 0;
  }

  /**
   * Get current CPU usage (sync)
   */
  private getCpuUsageSync(): number {
    if (!this.config.collectSystemMetrics) {
      return 0;
    }

    try {
      if (typeof process !== 'undefined' && process.cpuUsage) {
        const usage = process.cpuUsage();
        return Math.min(100, (usage.user + usage.system) / 1000);
      }
    } catch {
      // Ignore errors in CPU usage collection
    }

    return 0;
  }

  /**
   * Check performance thresholds and log warnings
   */
  private checkThresholds(metrics: PerformanceMetrics, operationName?: string): void {
    const thresholds = this.config.thresholds;
    if (!thresholds) return;

    const warnings: string[] = [];

    if (thresholds.maxDuration && metrics.duration > thresholds.maxDuration) {
      warnings.push(`Duration ${metrics.duration}ms exceeds threshold ${thresholds.maxDuration}ms`);
    }

    if (thresholds.maxMemoryUsage && metrics.memoryUsage) {
      const memoryMB = metrics.memoryUsage / 1024 / 1024;
      if (memoryMB > thresholds.maxMemoryUsage) {
        warnings.push(`Memory usage ${memoryMB.toFixed(2)}MB exceeds threshold ${thresholds.maxMemoryUsage}MB`);
      }
    }

    if (thresholds.maxCpuUsage && metrics.cpuUsage && metrics.cpuUsage > thresholds.maxCpuUsage) {
      warnings.push(`CPU usage ${metrics.cpuUsage.toFixed(2)}% exceeds threshold ${thresholds.maxCpuUsage}%`);
    }

    if (warnings.length > 0) {
      const message = `Performance warning${warnings.length > 1 ? 's' : ''} for ${operationName || 'operation'}: ${warnings.join(', ')}`;
      console.warn(`[Performance Monitor] ${message}`);
    }
  }

  /**
   * Record performance metrics
   */
  private recordMetrics(metrics: PerformanceMetrics): void {
    this.metricsHistory.push({
      timestamp: Date.now(),
      metrics
    });

    // Maintain history size
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Create performance attributes for span
   */
  private createPerformanceAttributes(metrics: PerformanceMetrics): Partial<MCPSpanAttributes> {
    return {
      'perf.duration_ms': metrics.duration,
      ...(metrics.memoryUsage ? { 'perf.memory_bytes': metrics.memoryUsage } : {}),
      ...(metrics.cpuUsage ? { 'perf.cpu_percent': metrics.cpuUsage } : {}),
      ...(metrics.networkLatency ? { 'perf.network_latency_ms': metrics.networkLatency } : {}),
      ...(metrics.dbQueryTime ? { 'perf.db_query_ms': metrics.dbQueryTime } : {}),
      ...(metrics.cacheHitRate ? { 'perf.cache_hit_rate': metrics.cacheHitRate } : {}),
      ...(metrics.errorRate ? { 'perf.error_rate': metrics.errorRate } : {}),
      ...(metrics.throughput ? { 'perf.throughput_ops': metrics.throughput } : {})
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(timeRange?: number): {
    averageDuration: number;
    maxDuration: number;
    minDuration: number;
    totalOperations: number;
    slowOperations: number;
  } {
    const range = timeRange || 60000; // Default to last minute
    const cutoffTime = Date.now() - range;

    const recentMetrics = this.metricsHistory
      .filter(entry => entry.timestamp >= cutoffTime)
      .map(entry => entry.metrics);

    if (recentMetrics.length === 0) {
      return {
        averageDuration: 0,
        maxDuration: 0,
        minDuration: 0,
        totalOperations: 0,
        slowOperations: 0
      };
    }

    const durations = recentMetrics.map(m => m.duration);
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    const threshold = this.config.thresholds?.maxDuration || 5000;
    const slowOperations = recentMetrics.filter(m => m.duration > threshold).length;

    return {
      averageDuration,
      maxDuration,
      minDuration,
      totalOperations: recentMetrics.length,
      slowOperations
    };
  }

  /**
   * Get memory usage trend
   */
  getMemoryTrend(timeRange?: number): Array<{ timestamp: number; usage: number }> {
    const range = timeRange || 60000;
    const cutoffTime = Date.now() - range;

    return this.metricsHistory
      .filter(entry => entry.timestamp >= cutoffTime && entry.metrics.memoryUsage)
      .map(entry => ({
        timestamp: entry.timestamp,
        usage: entry.metrics.memoryUsage!
      }));
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.metricsHistory.length = 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }
}

/**
 * Performance timing decorator for methods
 */
export function withPerformanceMonitoring(
  operationName?: string,
  config?: PerformanceConfig
) {
  const monitor = new PerformanceMonitor(config);

  return function <T extends (...args: any[]) => any>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (this: any, ...args: any[]) {
      return monitor.monitorAsync(
        () => originalMethod.apply(this, args),
        operationName || `${target.constructor.name}.${propertyKey}`
      );
    } as T;

    return descriptor;
  };
}

/**
 * Synchronous performance timing decorator
 */
export function withSyncPerformanceMonitoring(
  operationName?: string,
  config?: PerformanceConfig
) {
  const monitor = new PerformanceMonitor(config);

  return function <T extends (...args: any[]) => any>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value!;

    descriptor.value = function (this: any, ...args: any[]) {
      return monitor.monitorSync(
        () => originalMethod.apply(this, args),
        operationName || `${target.constructor.name}.${propertyKey}`
      );
    } as T;

    return descriptor;
  };
}

/**
 * Performance measurement utility
 */
export class PerformanceTimer {
  private startTime: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Mark a point in time
   */
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  /**
   * Measure duration between two marks
   */
  measure(fromMark: string, toMark?: string): number {
    const fromTime = this.marks.get(fromMark);
    const toTime = toMark ? this.marks.get(toMark) : performance.now();

    if (fromTime === undefined) {
      throw new Error(`Mark '${fromMark}' not found`);
    }

    return (toTime || performance.now()) - fromTime;
  }

  /**
   * Measure duration from start
   */
  measureFromStart(toMark?: string): number {
    return this.measure('start', toMark);
  }

  /**
   * Get all marks
   */
  getMarks(): Record<string, number> {
    return Object.fromEntries(this.marks);
  }

  /**
   * Get elapsed time since start
   */
  getElapsed(): number {
    return performance.now() - this.startTime;
  }

  /**
   * Reset timer
   */
  reset(): void {
    this.startTime = performance.now();
    this.marks.clear();
  }
}

/**
 * Global performance monitor instance
 */
let globalPerformanceMonitor: PerformanceMonitor | null = null;

/**
 * Get or create the global performance monitor
 */
export function getPerformanceMonitor(): PerformanceMonitor {
  if (!globalPerformanceMonitor) {
    globalPerformanceMonitor = new PerformanceMonitor();
  }
  return globalPerformanceMonitor;
}

/**
 * Set the global performance monitor
 */
export function setPerformanceMonitor(monitor: PerformanceMonitor): void {
  globalPerformanceMonitor = monitor;
}

/**
 * Reset the global performance monitor (mainly for testing)
 */
export function resetPerformanceMonitor(): void {
  globalPerformanceMonitor = null;
}

/**
 * Convenience function for quick performance measurement
 */
export async function measurePerformance<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<{ result: T; duration: number }> {
  const monitor = getPerformanceMonitor();
  const { result, metrics } = await monitor.monitorAsync(operation, operationName);
  return { result, duration: metrics.duration };
}

/**
 * Synchronous performance measurement
 */
export function measureSyncPerformance<T>(
  operation: () => T,
  operationName?: string
): { result: T; duration: number } {
  const monitor = getPerformanceMonitor();
  const { result, metrics } = monitor.monitorSync(operation, operationName);
  return { result, duration: metrics.duration };
}