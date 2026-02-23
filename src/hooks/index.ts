/**
 * Binario Agents SDK - React Hooks and Utilities
 * Re-exports for easy importing
 */

// Unified hook (Agents SDK compatible) - replaces useWebSocketChat, useHttpChat, useAgent
export { useBinarioAgent } from './useBinarioAgent';
export type { 
  UseBinarioAgentOptions, 
  UseBinarioAgentReturn, 
  AgentMessage,
  AgentState,
  ConnectionStatus,
} from './useBinarioAgent';
