import { describe, it, expect } from 'vitest';
import { trackmcp, getContextInjector, getTracker } from '../../src/index.js';
import { injectContextIntoSchema, extractContextFromArgs, stripContextFromArgs } from '../../src/enrichment/context-injector.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

describe('Context Injection', () => {
  describe('Schema Injection', () => {
    it('should inject context parameter into schema', () => {
      const originalSchema = {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' }
        },
        required: ['query']
      };

      const injectedSchema = injectContextIntoSchema(originalSchema);

      expect(injectedSchema.properties.context).toBeDefined();
      expect(injectedSchema.properties.context.type).toBe('string');
      expect(injectedSchema.properties.context.description).toBeDefined();
    });

    it('should support custom parameter names', () => {
      const originalSchema = {
        type: 'object',
        properties: {
          query: { type: 'string' }
        }
      };

      const customSchema = injectContextIntoSchema(originalSchema, {
        enabled: true,
        description: 'Custom context description',
        required: true,
        parameterName: 'intent'
      });

      expect(customSchema.properties.intent).toBeDefined();
      expect(customSchema.required).toContain('intent');
    });

    it('should allow disabling context injection', () => {
      const originalSchema = {
        type: 'object',
        properties: {
          query: { type: 'string' }
        }
      };

      const unchangedSchema = injectContextIntoSchema(originalSchema, {
        enabled: false
      });

      expect(unchangedSchema.properties.context).toBeUndefined();
    });
  });

  describe('Context Extraction', () => {
    it('should extract context from arguments', () => {
      const argsWithContext = {
        query: 'search term',
        limit: 10,
        context: 'I am searching for information about MCP servers'
      };

      const extractedContext = extractContextFromArgs(argsWithContext);

      expect(extractedContext).toBe(argsWithContext.context);
    });

    it('should return undefined when context is missing', () => {
      const argsWithoutContext = {
        query: 'search term',
        limit: 10
      };

      const extractedContext = extractContextFromArgs(argsWithoutContext);

      expect(extractedContext).toBeUndefined();
    });
  });

  describe('Context Stripping', () => {
    it('should remove context from arguments', () => {
      const argsWithContext = {
        query: 'search term',
        limit: 10,
        context: 'Some AI reasoning here'
      };

      const strippedArgs = stripContextFromArgs(argsWithContext);

      expect(strippedArgs.context).toBeUndefined();
      expect(strippedArgs.query).toBe('search term');
      expect(strippedArgs.limit).toBe(10);
    });
  });

  describe('Server Integration', () => {
    it('should attach context injector to server', () => {
      const server = new Server(
        {
          name: 'context-test-server',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );

      trackmcp(server, {
        projectId: 'proj_test_context',
        serviceName: 'context-test',
        contextInjection: {
          enabled: true,
          description: 'Tell me why you are calling this tool',
          required: false
        }
      });

      const contextInjector = getContextInjector(server);

      expect(contextInjector).toBeDefined();
      expect(contextInjector!.getConfig().enabled).toBe(true);
    });

    it('should capture context in spans', async () => {
      const server = new Server(
        {
          name: 'span-context-server',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );

      trackmcp(server, {
        projectId: 'proj_span_test',
        serviceName: 'span-test',
        consoleExport: false,
        contextInjection: {
          enabled: true
        }
      });

      const tracker = getTracker(server)!;
      const contextInjector = getContextInjector(server)!;

      // Simulate a tool call with AI context
      const toolName = 'search';
      const toolArgs = {
        query: 'MCP servers',
        limit: 10,
        context: 'The user asked about MCP server implementations'
      };

      const { context: aiContext, cleanedArgs } = contextInjector.processToolArguments(toolName, toolArgs);

      expect(aiContext).toBe(toolArgs.context);
      expect(cleanedArgs.context).toBeUndefined();
      expect(cleanedArgs.query).toBe('MCP servers');

      const opContext = tracker.createOperationContext('tools/call', 'req-context-test', {
        ...cleanedArgs,
        aiContext
      });

      const span = tracker.startMCPSpan('tools/call', opContext);

      span.setAttributes({
        'mcp.tool.name': toolName,
        'mcp.tool.ai_context': aiContext,
        'neonflare.project_id': 'proj_span_test'
      } as any);

      tracker.endMCPSpan(opContext.operationId, {
        success: true,
        data: { results: [] },
        duration: 100,
        timestamp: Date.now()
      });

      const events = tracker.getTelemetryEvents();
      const requestStart = events.find(e => e.type === 'request_start');

      expect(requestStart).toBeDefined();
      expect(requestStart!.data.projectId).toBe('proj_span_test');

      await tracker.shutdown();
    });
  });
});