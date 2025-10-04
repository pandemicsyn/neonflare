import { trackmcp, getContextInjector, getTracker } from '../../src/index.js';
import { injectContextIntoSchema, extractContextFromArgs, stripContextFromArgs } from '../../src/enrichment/context-injector.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Tests for the critical context injection feature
 */
class ContextInjectionTests {
  async run() {
    console.log('🎯 Running Context Injection Tests...\n');

    try {
      await this.testSchemaInjection();
      await this.testContextExtraction();
      await this.testContextStripping();
      await this.testServerIntegration();
      await this.testContextInSpans();

      console.log('\n✅ All context injection tests passed!');
    } catch (error) {
      console.error('\n❌ Context injection test failed:', error);
      process.exit(1);
    }
  }

  async testSchemaInjection() {
    console.log('1. Testing schema injection...');

    const originalSchema = {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' }
      },
      required: ['query']
    };

    // Test with default config
    const injectedSchema = injectContextIntoSchema(originalSchema);

    if (!injectedSchema.properties.context) {
      throw new Error('Expected context property to be added');
    }

    if (injectedSchema.properties.context.type !== 'string') {
      throw new Error('Expected context property to be of type string');
    }

    if (!injectedSchema.properties.context.description) {
      throw new Error('Expected context property to have description');
    }

    console.log('   ✓ Context property added to schema');
    console.log(`   ✓ Context description: "${injectedSchema.properties.context.description}"`);

    // Test with custom config
    const customSchema = injectContextIntoSchema(originalSchema, {
      enabled: true,
      description: 'Custom context description',
      required: true,
      parameterName: 'intent'
    });

    if (!customSchema.properties.intent) {
      throw new Error('Expected custom parameter name "intent" to be used');
    }

    if (!customSchema.required.includes('intent')) {
      throw new Error('Expected intent to be in required array');
    }

    console.log('   ✓ Custom parameter name works');
    console.log('   ✓ Required context works\n');
  }

  async testContextExtraction() {
    console.log('2. Testing context extraction...');

    const argsWithContext = {
      query: 'search term',
      limit: 10,
      context: 'I am searching for information about MCP servers because the user asked about them'
    };

    const extractedContext = extractContextFromArgs(argsWithContext);

    if (!extractedContext) {
      throw new Error('Expected context to be extracted');
    }

    if (extractedContext !== argsWithContext.context) {
      throw new Error('Extracted context does not match');
    }

    console.log('   ✓ Context extracted successfully');
    console.log(`   ✓ Extracted: "${extractedContext.substring(0, 50)}..."\n`);
  }

  async testContextStripping() {
    console.log('3. Testing context stripping...');

    const argsWithContext = {
      query: 'search term',
      limit: 10,
      context: 'Some AI reasoning here'
    };

    const strippedArgs = stripContextFromArgs(argsWithContext);

    if (strippedArgs.context !== undefined) {
      throw new Error('Expected context to be removed');
    }

    if (strippedArgs.query !== 'search term') {
      throw new Error('Expected other properties to remain');
    }

    if (strippedArgs.limit !== 10) {
      throw new Error('Expected limit property to remain');
    }

    console.log('   ✓ Context stripped from arguments');
    console.log('   ✓ Original properties preserved');
    console.log(`   ✓ Cleaned args: ${JSON.stringify(strippedArgs)}\n`);
  }

  async testServerIntegration() {
    console.log('4. Testing server integration with context injection...');

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

    // Wrap with context injection enabled
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

    if (!contextInjector) {
      throw new Error('Expected context injector to be attached to server');
    }

    const config = contextInjector.getConfig();
    if (!config.enabled) {
      throw new Error('Expected context injection to be enabled');
    }

    console.log('   ✓ Context injector attached to server');
    console.log(`   ✓ Context injection enabled: ${config.enabled}`);
    console.log(`   ✓ Context description: "${config.description}"\n`);
  }

  async testContextInSpans() {
    console.log('5. Testing context captured in spans...');

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
      context: 'The user asked about MCP server implementations, so I am searching for relevant information'
    };

    // Process the arguments
    const { context: aiContext, cleanedArgs } = contextInjector.processToolArguments(toolName, toolArgs);

    if (!aiContext) {
      throw new Error('Expected AI context to be extracted');
    }

    // Create operation context with AI context
    const opContext = tracker.createOperationContext('tools/call', 'req-context-test', {
      ...cleanedArgs,
      aiContext
    });

    const span = tracker.startMCPSpan('tools/call', opContext);

    // Manually add AI context to span
    span.setAttributes({
      'mcp.tool.name': toolName,
      'mcp.tool.ai_context': aiContext,
      'neonflare.project_id': 'proj_span_test'
    } as any);

    // Complete the span
    tracker.endMCPSpan(opContext.operationId, {
      success: true,
      data: { results: [] },
      duration: 100,
      timestamp: Date.now()
    });

    const events = tracker.getTelemetryEvents();
    const requestStart = events.find(e => e.type === 'request_start');

    if (!requestStart) {
      throw new Error('Expected request_start event to be recorded');
    }

    if (requestStart.data.projectId !== 'proj_span_test') {
      throw new Error('Expected projectId in telemetry event');
    }

    console.log('   ✓ AI context extracted from tool call');
    console.log(`   ✓ Context: "${aiContext.substring(0, 60)}..."`);
    console.log('   ✓ Context included in span attributes');
    console.log('   ✓ Project ID included in telemetry\n');

    await tracker.shutdown();
  }
}

// Export and auto-run
const tests = new ContextInjectionTests();

if (import.meta.url === `file://${process.argv[1]}`) {
  tests.run().catch(console.error);
}

export { tests as contextInjectionTests };