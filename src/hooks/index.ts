/**
 * Binario Agents SDK - React Hooks and Utilities
 * Re-exports for easy importing
 */

// New unified hook (Agents SDK compatible)
export { useBinarioAgent } from './useBinarioAgent';
export type { 
  UseBinarioAgentOptions, 
  UseBinarioAgentReturn, 
  AgentMessage,
  AgentState,
  ConnectionStatus,
} from './useBinarioAgent';

// Legacy hooks (still available for backward compatibility)
export { useAgent } from './useAgent';
export type { 
  UseAgentOptions, 
  UseAgentReturn, 
} from './useAgent';
