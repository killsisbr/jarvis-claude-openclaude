// Skill system type definitions and hook interfaces

export interface MessageContext {
  userId: string;
  text: string;
  intent?: string;
  sessionId?: string;
}

export interface ActionContext {
  type: 'create' | 'modify' | 'delete' | 'execute';
  target?: string;
  description?: string;
}

export interface Skill {
  // Metadata
  name: string;
  description: string;
  version?: string;
  author?: string;
  commands?: string[];

  // Lifecycle hooks
  onStartup?(): Promise<void>;
  onShutdown?(): Promise<void>;

  // Message hooks
  onMessage?(context: MessageContext): Promise<void>;

  // Action hooks
  beforeExecute?(action: ActionContext): Promise<void>;
  afterExecute?(action: ActionContext, result: unknown): Promise<void>;
}

export type HookName =
  | 'onStartup'
  | 'onShutdown'
  | 'onMessage'
  | 'beforeExecute'
  | 'afterExecute';

export interface SkillLoadOptions {
  skillsDir: string;
  context?: unknown;
}

export interface SkillLoadResult {
  name: string;
  path: string;
  loaded: boolean;
  error?: string;
}
