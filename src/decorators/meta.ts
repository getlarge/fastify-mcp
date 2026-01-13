import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import type {
  MCPTool,
  MCPResource,
  MCPPrompt,
  ResourcesListHandler,
  ResourcesReadHandler,
  ResourcesTemplatesListHandler
} from '../types.ts'
import type { SessionStore } from '../stores/session-store.ts'
import type { CustomResourceHandlers } from '../handlers.ts'
import { schemaToArguments, validateToolSchema } from '../validation/index.ts'

interface MCPDecoratorsOptions {
  tools: Map<string, MCPTool>
  resources: Map<string, MCPResource>
  prompts: Map<string, MCPPrompt>
  customResourceHandlers: CustomResourceHandlers
  sessionStore: SessionStore
}

const mcpDecoratorsPlugin: FastifyPluginAsync<MCPDecoratorsOptions> = async (app, options) => {
  const { tools, resources, prompts, customResourceHandlers, sessionStore } = options

  // Enhanced tool decorator with TypeBox schema support
  app.decorate('mcpAddTool', (
    definition: any,
    handler?: any
  ) => {
    const name = definition.name
    if (!name) {
      throw new Error('Tool definition must have a name')
    }

    // Validate schema if provided
    if (definition.inputSchema) {
      const schemaErrors = validateToolSchema(definition.inputSchema)
      if (schemaErrors.length > 0) {
        throw new Error(`Invalid tool schema for '${name}': ${schemaErrors.join(', ')}`)
      }
    }

    // TypeBox schemas are already JSON Schema compatible
    const toolDefinition = definition

    tools.set(name, {
      definition: {
        ...toolDefinition,
        // Store the original schema for validation (TypeBox or JSON Schema)
        inputSchema: definition.inputSchema || toolDefinition.inputSchema
      },
      handler
    })
  })

  // Enhanced resource decorator with URI schema support
  app.decorate('mcpAddResource', (
    definition: any,
    handler?: any
  ) => {
    const uriPattern = definition.uriPattern || definition.uri
    if (!uriPattern) {
      throw new Error('Resource definition must have a uri or uriPattern')
    }

    // Convert uriPattern to uri for the definition
    const resourceDefinition = {
      ...definition,
      uri: uriPattern
    }

    resources.set(uriPattern, { definition: resourceDefinition, handler })
  })

  // Enhanced prompt decorator with argument schema support
  app.decorate('mcpAddPrompt', (
    definition: any,
    handler?: any
  ) => {
    const name = definition.name
    if (!name) {
      throw new Error('Prompt definition must have a name')
    }

    // Generate arguments array from schema if provided
    const promptDefinition = definition.argumentSchema
      ? {
          ...definition,
          arguments: schemaToArguments(definition.argumentSchema)
        }
      : definition

    prompts.set(name, {
      definition: {
        ...promptDefinition,
        // Store the original TypeBox schema for validation
        argumentSchema: definition.argumentSchema
      },
      handler
    })
  })

  // Custom resource handler setters
  app.decorate('mcpSetResourcesListHandler', (handler: ResourcesListHandler) => {
    customResourceHandlers.resourcesListHandler = handler
    app.log.debug('Custom resources list handler registered')
  })

  app.decorate('mcpSetResourcesReadHandler', (handler: ResourcesReadHandler) => {
    customResourceHandlers.resourcesReadHandler = handler
    app.log.debug('Custom resources read handler registered')
  })

  app.decorate('mcpSetResourcesTemplatesListHandler', (handler: ResourcesTemplatesListHandler) => {
    customResourceHandlers.resourcesTemplatesListHandler = handler
    app.log.debug('Custom resources templates list handler registered')
  })

  // Export subscription store accessor for notification logic
  app.decorate('mcpGetResourceSubscriptions', async () => {
    return sessionStore.getAllResourceSubscriptions()
  })
}

export default fp(mcpDecoratorsPlugin, {
  name: 'mcp-decorators'
})
