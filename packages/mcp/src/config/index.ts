import { MCPInstrumentationConfig } from '../types/index.js';

/**
 * Configuration manager for MCP instrumentation settings
 */
export class ConfigurationManager {
  private config: MCPInstrumentationConfig;
  private configFile?: string;
  private environmentOverrides: Record<string, string> = {};

  constructor(config: MCPInstrumentationConfig = {}) {
    this.config = this.loadDefaultConfig();
    this.mergeConfig(config);
    this.loadEnvironmentOverrides();
  }

  /**
   * Load default configuration
   */
  private loadDefaultConfig(): MCPInstrumentationConfig {
    return {
      serviceName: 'mcp-server',
      serviceVersion: '1.0.0',
      tracingEnabled: true,
      metricsEnabled: false,
      samplingRate: 1.0,
      requestTimeout: 30000,
      maxAttributes: 128,
      maxEvents: 128,
      consoleExport: false,
      rotel: {
        enabled: false,
        autoInstrument: true,
        instrumentations: []
      }
    };
  }

  /**
   * Merge provided configuration with defaults
   */
  private mergeConfig(config: MCPInstrumentationConfig): void {
    this.config = {
      ...this.config,
      ...config,
      rotel: {
        ...this.config.rotel,
        ...config.rotel
      }
    };
  }

  /**
   * Load configuration overrides from environment variables
   */
  private loadEnvironmentOverrides(): void {
    // OpenTelemetry settings
    if (process.env.OTEL_SERVICE_NAME) {
      this.config.serviceName = process.env.OTEL_SERVICE_NAME;
    }
    if (process.env.OTEL_SERVICE_VERSION) {
      this.config.serviceVersion = process.env.OTEL_SERVICE_VERSION;
    }
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      this.config.otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    }
    if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
      try {
        this.config.otlpHeaders = JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS);
      } catch {
        console.warn('Invalid OTEL_EXPORTER_OTLP_HEADERS format');
      }
    }

    // Neonflare-specific settings
    if (process.env.NEONFLARE_TRACING_ENABLED) {
      this.config.tracingEnabled = process.env.NEONFLARE_TRACING_ENABLED === 'true';
    }
    if (process.env.NEONFLARE_METRICS_ENABLED) {
      this.config.metricsEnabled = process.env.NEONFLARE_METRICS_ENABLED === 'true';
    }
    if (process.env.NEONFLARE_SAMPLING_RATE) {
      this.config.samplingRate = parseFloat(process.env.NEONFLARE_SAMPLING_RATE);
    }
    if (process.env.NEONFLARE_REQUEST_TIMEOUT) {
      this.config.requestTimeout = parseInt(process.env.NEONFLARE_REQUEST_TIMEOUT);
    }
    if (process.env.NEONFLARE_CONSOLE_EXPORT) {
      this.config.consoleExport = process.env.NEONFLARE_CONSOLE_EXPORT === 'true';
    }

    // Rotel settings
    if (process.env.NEONFLARE_ROTEL_ENABLED) {
      this.config.rotel = this.config.rotel || {};
      this.config.rotel.enabled = process.env.NEONFLARE_ROTEL_ENABLED === 'true';
    }
    if (process.env.NEONFLARE_ROTEL_AUTO_INSTRUMENT) {
      this.config.rotel = this.config.rotel || {};
      this.config.rotel.autoInstrument = process.env.NEONFLARE_ROTEL_AUTO_INSTRUMENT === 'true';
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): MCPInstrumentationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MCPInstrumentationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get specific configuration value
   */
  get<K extends keyof MCPInstrumentationConfig>(key: K): MCPInstrumentationConfig[K] {
    return this.config[key];
  }

  /**
   * Set specific configuration value
   */
  set<K extends keyof MCPInstrumentationConfig>(key: K, value: MCPInstrumentationConfig[K]): void {
    this.config[key] = value;
  }

  /**
   * Load configuration from file
   */
  async loadFromFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const fileConfig = JSON.parse(fileContent) as MCPInstrumentationConfig;

      this.configFile = filePath;
      this.mergeConfig(fileConfig);
    } catch (error) {
      console.warn(`Failed to load config from ${filePath}:`, error);
    }
  }

  /**
   * Save current configuration to file
   */
  async saveToFile(filePath?: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = filePath || this.configFile || './neonflare-config.json';
      await fs.writeFile(path, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.config = this.loadDefaultConfig();
    this.configFile = undefined;
    this.loadEnvironmentOverrides();
  }

  /**
   * Validate current configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.serviceName) {
      errors.push('Service name is required');
    }

    if (this.config.samplingRate !== undefined) {
      if (this.config.samplingRate < 0 || this.config.samplingRate > 1) {
        errors.push('Sampling rate must be between 0 and 1');
      }
    }

    if (this.config.requestTimeout !== undefined) {
      if (this.config.requestTimeout < 0) {
        errors.push('Request timeout must be positive');
      }
    }

    if (this.config.maxAttributes !== undefined) {
      if (this.config.maxAttributes < 0) {
        errors.push('Max attributes must be positive');
      }
    }

    if (this.config.otlpEndpoint) {
      try {
        new URL(this.config.otlpEndpoint);
      } catch {
        errors.push('OTLP endpoint must be a valid URL');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create configuration for different environments
   */
  static forEnvironment(environment: 'development' | 'staging' | 'production'): MCPInstrumentationConfig {
    const baseConfig: MCPInstrumentationConfig = {
      serviceName: 'mcp-server',
      serviceVersion: '1.0.0',
      tracingEnabled: true,
      metricsEnabled: false,
      samplingRate: 1.0,
      requestTimeout: 30000,
      maxAttributes: 128,
      maxEvents: 128,
      consoleExport: false
    };

    switch (environment) {
      case 'development':
        return {
          ...baseConfig,
          consoleExport: true,
          samplingRate: 1.0,
          rotel: {
            enabled: true,
            autoInstrument: true,
            instrumentations: ['http', 'fs', 'dns']
          }
        };

      case 'staging':
        return {
          ...baseConfig,
          samplingRate: 0.5,
          otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://staging-collector:4317',
          rotel: {
            enabled: true,
            autoInstrument: true,
            instrumentations: ['http', 'fs', 'dns']
          }
        };

      case 'production':
        return {
          ...baseConfig,
          samplingRate: 0.1,
          otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://production-collector:4317',
          rotel: {
            enabled: true,
            autoInstrument: true,
            instrumentations: ['http', 'fs', 'dns', 'net', 'os']
          }
        };

      default:
        return baseConfig;
    }
  }
}

/**
 * Global configuration manager instance
 */
let globalConfigManager: ConfigurationManager | null = null;

/**
 * Get or create the global configuration manager
 */
export function getConfigurationManager(): ConfigurationManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigurationManager();
  }
  return globalConfigManager;
}

/**
 * Set the global configuration manager
 */
export function setConfigurationManager(manager: ConfigurationManager): void {
  globalConfigManager = manager;
}

/**
 * Reset the global configuration manager (mainly for testing)
 */
export function resetConfigurationManager(): void {
  globalConfigManager = null;
}

/**
 * Quick configuration helpers
 */
export const Config = {
  /**
   * Create development configuration
   */
  development: () => ConfigurationManager.forEnvironment('development'),

  /**
   * Create staging configuration
   */
  staging: () => ConfigurationManager.forEnvironment('staging'),

  /**
   * Create production configuration
   */
  production: () => ConfigurationManager.forEnvironment('production'),

  /**
   * Create minimal configuration
   */
  minimal: (): MCPInstrumentationConfig => ({
    serviceName: 'mcp-server',
    serviceVersion: '1.0.0',
    tracingEnabled: false,
    metricsEnabled: false
  }),

  /**
   * Create full-featured configuration
   */
  full: (): MCPInstrumentationConfig => ({
    serviceName: 'mcp-server',
    serviceVersion: '1.0.0',
    tracingEnabled: true,
    metricsEnabled: true,
    samplingRate: 1.0,
    requestTimeout: 30000,
    maxAttributes: 128,
    maxEvents: 128,
    consoleExport: true,
    otlpEndpoint: 'http://localhost:4317',
    rotel: {
      enabled: true,
      autoInstrument: true,
      instrumentations: ['http', 'fs', 'dns', 'net', 'os']
    }
  })
};