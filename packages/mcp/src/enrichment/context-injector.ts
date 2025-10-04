/**
 * Context injection for MCP tool schemas
 * 
 * This module provides the critical feature of injecting a "context" parameter
 * into tool schemas, allowing AI assistants to naturally provide their reasoning
 * and intent when calling tools.
 */

export interface ContextInjectionConfig {
  /** Whether to enable context injection */
  enabled?: boolean;
  /** Description for the context parameter */
  description?: string;
  /** Whether context is required */
  required?: boolean;
  /** Custom parameter name (default: 'context') */
  parameterName?: string;
}

/**
 * Inject a context parameter into a tool's input schema
 */
export function injectContextIntoSchema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any,
  config: ContextInjectionConfig = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const {
    enabled = true,
    description = 'Explain why you are calling this tool and what you hope to accomplish',
    required = false,
    parameterName = 'context'
  } = config;

  if (!enabled) {
    return schema;
  }

  // Handle different schema formats
  if (!schema) {
    return {
      type: 'object',
      properties: {
        [parameterName]: {
          type: 'string',
          description
        }
      },
      required: required ? [parameterName] : []
    };
  }

  // Clone the schema to avoid mutation
  const modifiedSchema = JSON.parse(JSON.stringify(schema));

  // Ensure properties object exists
  if (!modifiedSchema.properties) {
    modifiedSchema.properties = {};
  }

  // Add context parameter
  modifiedSchema.properties[parameterName] = {
    type: 'string',
    description
  };

  // Add to required array if needed
  if (required) {
    modifiedSchema.required = modifiedSchema.required || [];
    if (!modifiedSchema.required.includes(parameterName)) {
      modifiedSchema.required.push(parameterName);
    }
  }

  return modifiedSchema;
}

/**
 * Extract context from tool call arguments
 */
export function extractContextFromArgs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any,
  parameterName: string = 'context'
): string | undefined {
  if (!args || typeof args !== 'object') {
    return undefined;
  }

  const context = args[parameterName];
  
  if (typeof context === 'string') {
    return context;
  }

  return undefined;
}

/**
 * Remove context parameter from arguments before passing to tool implementation
 */
export function stripContextFromArgs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any,
  parameterName: string = 'context'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (!args || typeof args !== 'object') {
    return args;
  }

  const { [parameterName]: _, ...cleanedArgs } = args;
  return cleanedArgs;
}

/**
 * Validate that a schema has context injection
 */
export function hasContextInjection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any,
  parameterName: string = 'context'
): boolean {
  return schema?.properties?.[parameterName]?.type === 'string';
}

/**
 * Context injection middleware for tool registration
 */
export class ContextInjectionMiddleware {
  private config: ContextInjectionConfig;

  constructor(config: ContextInjectionConfig = {}) {
    this.config = {
      enabled: true,
      description: 'Explain why you are calling this tool and what you hope to accomplish',
      required: false,
      parameterName: 'context',
      ...config
    };
  }

  /**
   * Process a tool schema during registration
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  processToolSchema(toolName: string, schema: any): any {
    if (!this.config.enabled) {
      return schema;
    }

    console.log(`[Context Injection] Injecting context into tool: ${toolName}`);
    return injectContextIntoSchema(schema, this.config);
  }

  /**
   * Process tool arguments during execution
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  processToolArguments(toolName: string, args: any): {
    context?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cleanedArgs: any;
  } {
    const context = extractContextFromArgs(args, this.config.parameterName);
    const cleanedArgs = stripContextFromArgs(args, this.config.parameterName);

    if (context) {
      console.log(`[Context Injection] Extracted context for ${toolName}: ${context.substring(0, 100)}...`);
    }

    return { context, cleanedArgs };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextInjectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ContextInjectionConfig {
    return { ...this.config };
  }
}