import { EnrichmentData, TelemetryEvent, MCPSpanAttributes } from '../types/index.js';

/**
 * Enrichment provider interface for adding contextual data
 */
export interface EnrichmentProvider {
  /**
   * Get enrichment data for the current context
   */
  getEnrichmentData(): Promise<EnrichmentData> | EnrichmentData;

  /**
   * Enrich telemetry event with additional context
   */
  enrichEvent(event: TelemetryEvent): Promise<TelemetryEvent> | TelemetryEvent;

  /**
   * Enrich span attributes with additional context
   */
  enrichAttributes(attributes: MCPSpanAttributes): Promise<MCPSpanAttributes> | MCPSpanAttributes;
}

/**
 * Environment enrichment provider that adds system and environment information
 */
export class EnvironmentEnrichmentProvider implements EnrichmentProvider {
  private environment: Record<string, string>;

  constructor() {
    this.environment = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      hostname: this.getHostname(),
      pid: process.pid.toString(),
      uptime: process.uptime().toString(),
      memoryUsage: JSON.stringify(process.memoryUsage()),
      ...process.env
    };
  }

  private getHostname(): string {
    try {
      return require('os').hostname();
    } catch {
      return 'unknown';
    }
  }

  getEnrichmentData(): EnrichmentData {
    return {
      performance: {
        memoryUsage: process.memoryUsage().heapUsed
      },
      businessContext: {
        environment: this.getEnvironment(),
        service: 'mcp-server',
        uptime: process.uptime()
      }
    };
  }

  enrichEvent(event: TelemetryEvent): TelemetryEvent {
    return {
      ...event,
      data: {
        ...event.data,
        environment: this.getEnvironment(),
        timestamp: Date.now()
      }
    };
  }

  enrichAttributes(attributes: MCPSpanAttributes): MCPSpanAttributes {
    return {
      ...attributes,
      'env.node_version': this.environment.nodeVersion,
      'env.platform': this.environment.platform,
      'env.hostname': this.environment.hostname,
      'env.pid': this.environment.pid,
      'env.uptime': this.environment.uptime
    };
  }

  private getEnvironment(): string {
    return process.env.NODE_ENV || 'development';
  }
}

/**
 * User context enrichment provider for tracking user-specific information
 */
export class UserContextEnrichmentProvider implements EnrichmentProvider {
  private userContext: {
    userId?: string;
    sessionId?: string;
    clientIp?: string;
    userAgent?: string;
    customTags?: string[];
  } = {};

  setUserContext(context: {
    userId?: string;
    sessionId?: string;
    clientIp?: string;
    userAgent?: string;
    customTags?: string[];
  }): void {
    this.userContext = { ...this.userContext, ...context };
  }

  clearUserContext(): void {
    this.userContext = {};
  }

  getEnrichmentData(): EnrichmentData {
    return {
      userAgent: this.userContext.userAgent,
      clientIp: this.userContext.clientIp,
      tags: this.userContext.customTags,
      businessContext: {
        userId: this.userContext.userId,
        sessionId: this.userContext.sessionId
      }
    };
  }

  enrichEvent(event: TelemetryEvent): TelemetryEvent {
    return {
      ...event,
      data: {
        ...event.data,
        userId: this.userContext.userId,
        sessionId: this.userContext.sessionId,
        clientIp: this.userContext.clientIp,
        userAgent: this.userContext.userAgent,
        tags: this.userContext.customTags
      }
    };
  }

  enrichAttributes(attributes: MCPSpanAttributes): MCPSpanAttributes {
    return {
      ...attributes,
      'user.id': this.userContext.userId || '',
      'user.session_id': this.userContext.sessionId || '',
      'user.client_ip': this.userContext.clientIp || '',
      'user.agent': this.userContext.userAgent || '',
      ...(this.userContext.customTags?.length ? { 'user.tags': this.userContext.customTags.join(',') } : {})
    };
  }
}

/**
 * Geographic enrichment provider for location-based context
 */
export class GeographicEnrichmentProvider implements EnrichmentProvider {
  private location: {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
  } = {};

  setLocation(location: {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
  }): void {
    this.location = location;
  }

  getEnrichmentData(): EnrichmentData {
    return {
      location: this.location
    };
  }

  enrichEvent(event: TelemetryEvent): TelemetryEvent {
    return {
      ...event,
      data: {
        ...event.data,
        location: this.location
      }
    };
  }

  enrichAttributes(attributes: MCPSpanAttributes): MCPSpanAttributes {
    return {
      ...attributes,
      'geo.country': this.location.country || '',
      'geo.region': this.location.region || '',
      'geo.city': this.location.city || '',
      'geo.timezone': this.location.timezone || ''
    };
  }
}

/**
 * Custom enrichment provider for application-specific context
 */
export class CustomEnrichmentProvider implements EnrichmentProvider {
  private customData: Record<string, any> = {};

  setCustomData(data: Record<string, any>): void {
    this.customData = { ...this.customData, ...data };
  }

  addCustomField(key: string, value: any): void {
    this.customData[key] = value;
  }

  removeCustomField(key: string): void {
    delete this.customData[key];
  }

  getEnrichmentData(): EnrichmentData {
    return {
      businessContext: this.customData
    };
  }

  enrichEvent(event: TelemetryEvent): TelemetryEvent {
    return {
      ...event,
      data: {
        ...event.data,
        custom: this.customData
      }
    };
  }

  enrichAttributes(attributes: MCPSpanAttributes): MCPSpanAttributes {
    // Add custom fields as span attributes
    const customAttributes: Record<string, string> = {};
    Object.entries(this.customData).forEach(([key, value]) => {
      customAttributes[`custom.${key}`] = String(value);
    });

    return {
      ...attributes,
      ...customAttributes
    };
  }
}

/**
 * Composite enrichment provider that combines multiple providers
 */
export class CompositeEnrichmentProvider implements EnrichmentProvider {
  private providers: EnrichmentProvider[] = [];

  constructor(providers: EnrichmentProvider[] = []) {
    this.providers = providers;
  }

  addProvider(provider: EnrichmentProvider): void {
    this.providers.push(provider);
  }

  removeProvider(provider: EnrichmentProvider): void {
    const index = this.providers.indexOf(provider);
    if (index > -1) {
      this.providers.splice(index, 1);
    }
  }

  async getEnrichmentData(): Promise<EnrichmentData> {
    const enrichmentData: EnrichmentData = {};

    for (const provider of this.providers) {
      try {
        const data = await provider.getEnrichmentData();
        enrichmentData.userAgent = data.userAgent || enrichmentData.userAgent;
        enrichmentData.clientIp = data.clientIp || enrichmentData.clientIp;
        enrichmentData.tags = [...(enrichmentData.tags || []), ...(data.tags || [])];
        enrichmentData.location = { ...enrichmentData.location, ...data.location };
        enrichmentData.businessContext = { ...enrichmentData.businessContext, ...data.businessContext };
        enrichmentData.performance = { ...enrichmentData.performance, ...data.performance };
      } catch (error) {
        console.warn('[CompositeEnrichment] Error getting enrichment data:', error);
      }
    }

    return enrichmentData;
  }

  async enrichEvent(event: TelemetryEvent): Promise<TelemetryEvent> {
    let enrichedEvent = event;

    for (const provider of this.providers) {
      try {
        enrichedEvent = await provider.enrichEvent(enrichedEvent);
      } catch (error) {
        console.warn('[CompositeEnrichment] Error enriching event:', error);
      }
    }

    return enrichedEvent;
  }

  async enrichAttributes(attributes: MCPSpanAttributes): Promise<MCPSpanAttributes> {
    let enrichedAttributes = attributes;

    for (const provider of this.providers) {
      try {
        enrichedAttributes = await provider.enrichAttributes(enrichedAttributes);
      } catch (error) {
        console.warn('[CompositeEnrichment] Error enriching attributes:', error);
      }
    }

    return enrichedAttributes;
  }
}

/**
 * Enrichment manager for coordinating enrichment providers
 */
export class EnrichmentManager {
  private compositeProvider: CompositeEnrichmentProvider;

  constructor() {
    this.compositeProvider = new CompositeEnrichmentProvider([
      new EnvironmentEnrichmentProvider()
    ]);
  }

  /**
   * Add an enrichment provider
   */
  addProvider(provider: EnrichmentProvider): void {
    this.compositeProvider.addProvider(provider);
  }

  /**
   * Remove an enrichment provider
   */
  removeProvider(provider: EnrichmentProvider): void {
    this.compositeProvider.removeProvider(provider);
  }

  /**
   * Get enrichment data from all providers
   */
  async getEnrichmentData(): Promise<EnrichmentData> {
    return await this.compositeProvider.getEnrichmentData();
  }

  /**
   * Enrich a telemetry event
   */
  async enrichEvent(event: TelemetryEvent): Promise<TelemetryEvent> {
    return await this.compositeProvider.enrichEvent(event);
  }

  /**
   * Enrich span attributes
   */
  async enrichAttributes(attributes: MCPSpanAttributes): Promise<MCPSpanAttributes> {
    return await this.compositeProvider.enrichAttributes(attributes);
  }

  /**
   * Set user context across all providers
   */
  setUserContext(context: {
    userId?: string;
    sessionId?: string;
    clientIp?: string;
    userAgent?: string;
    customTags?: string[];
  }): void {
    const userProvider = this.compositeProvider['providers'].find(
      p => p instanceof UserContextEnrichmentProvider
    ) as UserContextEnrichmentProvider;

    if (userProvider) {
      userProvider.setUserContext(context);
    }
  }

  /**
   * Set geographic location
   */
  setLocation(location: {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
  }): void {
    const geoProvider = this.compositeProvider['providers'].find(
      p => p instanceof GeographicEnrichmentProvider
    ) as GeographicEnrichmentProvider;

    if (geoProvider) {
      geoProvider.setLocation(location);
    }
  }

  /**
   * Set custom data
   */
  setCustomData(data: Record<string, any>): void {
    const customProvider = this.compositeProvider['providers'].find(
      p => p instanceof CustomEnrichmentProvider
    ) as CustomEnrichmentProvider;

    if (customProvider) {
      customProvider.setCustomData(data);
    }
  }
}

/**
 * Global enrichment manager instance
 */
let globalEnrichmentManager: EnrichmentManager | null = null;

/**
 * Get or create the global enrichment manager
 */
export function getEnrichmentManager(): EnrichmentManager {
  if (!globalEnrichmentManager) {
    globalEnrichmentManager = new EnrichmentManager();
  }
  return globalEnrichmentManager;
}

/**
 * Set the global enrichment manager
 */
export function setEnrichmentManager(manager: EnrichmentManager): void {
  globalEnrichmentManager = manager;
}

/**
 * Reset the global enrichment manager (mainly for testing)
 */
export function resetEnrichmentManager(): void {
  globalEnrichmentManager = null;
}