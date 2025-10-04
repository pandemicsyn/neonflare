import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPTracker } from '../../src/core/tracker.js';
import { MCPInstrumentationConfig } from '../../src/types/index.js';

describe('MCPTracker', () => {
  let tracker: MCPTracker;
  let config: MCPInstrumentationConfig;

  beforeEach(() => {
    config = {
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      tracingEnabled: true,
      consoleExport: true
    };
    tracker = new MCPTracker(config);
  });

  afterEach(async () => {
    await tracker.shutdown();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultTracker = new MCPTracker();
      const defaultConfig = defaultTracker.getConfig();

      expect(defaultConfig.serviceName).toBe('mcp-server');
      expect(defaultConfig.tracingEnabled).toBe(true);
    });

    it('should merge provided configuration with defaults', () => {
      const testConfig: MCPInstrumentationConfig = {
        serviceName: 'custom-service',
        samplingRate: 0.5
      };

      const customTracker = new MCPTracker(testConfig);
      const mergedConfig = customTracker.getConfig();

      expect(mergedConfig.serviceName).toBe('custom-service');
      expect(mergedConfig.samplingRate).toBe(0.5);
      expect(mergedConfig.serviceVersion).toBe('1.0.0');
    });
  });

  describe('operation context', () => {
    it('should create operation context with required fields', () => {
      const context = tracker.createOperationContext('tools/list', 'test-request-123');

      expect(context.operationId).toBeDefined();
      expect(context.startTime).toBeDefined();
      expect(context.metadata?.method).toBe('tools/list');
      expect(context.metadata?.requestId).toBe('test-request-123');
    });
  });

  describe('span management', () => {
    it('should start and end spans correctly', () => {
      const context = tracker.createOperationContext('tools/list');
      const span = tracker.startMCPSpan('tools/list', context);

      expect(span).toBeDefined();
      expect(tracker.getActiveSpanCount()).toBe(1);

      tracker.endMCPSpan(context.operationId, {
        success: true,
        data: { tools: [] },
        duration: 100,
        timestamp: Date.now()
      });

      expect(tracker.getActiveSpanCount()).toBe(0);
    });
  });

  describe('telemetry', () => {
    it('should record telemetry events', () => {
      const context = tracker.createOperationContext('test');
      tracker.startMCPSpan('test', context);

      const events = tracker.getTelemetryEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[events.length - 1].type).toBe('request_start');
    });
  });
});