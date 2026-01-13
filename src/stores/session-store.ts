import type { JSONRPCMessage } from '../schema.ts'
import type { AuthorizationContext, TokenRefreshInfo } from '../types/auth-types.ts'

export interface SessionMetadata {
  id: string
  eventId: number
  lastEventId?: string
  createdAt: Date
  lastActivity: Date
  authSession?: any // OAuth session data (legacy - for Phase 2 compatibility)

  // Enhanced authorization context
  authorization?: AuthorizationContext
  tokenRefresh?: TokenRefreshInfo
}

export interface SessionStore {
  create(metadata: SessionMetadata): Promise<void>
  get(sessionId: string): Promise<SessionMetadata | null>
  delete(sessionId: string): Promise<void>
  cleanup(): Promise<void>

  // Message history operations
  addMessage(sessionId: string, eventId: string, message: JSONRPCMessage): Promise<void>
  getMessagesFrom(sessionId: string, fromEventId: string): Promise<Array<{ eventId: string, message: JSONRPCMessage }>>

  // Token-to-session mapping operations
  getSessionByTokenHash(tokenHash: string): Promise<SessionMetadata | null>
  addTokenMapping(tokenHash: string, sessionId: string): Promise<void>
  removeTokenMapping(tokenHash: string): Promise<void>
  updateAuthorization(sessionId: string, authorization: AuthorizationContext, tokenRefresh?: TokenRefreshInfo): Promise<void>

  // Resource subscription operations
  addResourceSubscription(sessionId: string, uri: string): Promise<void>
  removeResourceSubscription(sessionId: string, uri: string): Promise<void>
  getResourceSubscriptions(sessionId: string): Promise<Set<string>>
  getSubscribersForResource(uri: string): Promise<string[]>
  getAllResourceSubscriptions(): Promise<Map<string, Set<string>>>
}
