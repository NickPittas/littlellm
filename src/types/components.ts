// Type definitions for React components to replace 'any' types

import { ReactNode, ReactElement } from 'react';

// Base component props
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
  id?: string;
  'data-testid'?: string;
}

// Agent-related types
export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  provider: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentSelectProps extends BaseComponentProps {
  selectedAgent?: Agent;
  onAgentChange?: (agent: Agent) => void;
  availableAgents?: Agent[];
  placeholder?: string;
  disabled?: boolean;
}

// Markdown component props with proper typing
export interface MarkdownComponentProps extends BaseComponentProps {
  node?: unknown; // AST node from react-markdown
  inline?: boolean;
  href?: string;
  children?: ReactNode;
}

export interface CodeBlockProps extends MarkdownComponentProps {
  className?: string;
  inline?: boolean;
  children?: ReactNode;
}

export interface LinkProps extends MarkdownComponentProps {
  href?: string;
  children?: ReactNode;
}

export interface HeadingProps extends MarkdownComponentProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children?: ReactNode;
}

export interface ListProps extends MarkdownComponentProps {
  ordered?: boolean;
  children?: ReactNode;
}

export interface TableProps extends MarkdownComponentProps {
  children?: ReactNode;
}

export interface TableCellProps extends MarkdownComponentProps {
  isHeader?: boolean;
  align?: 'left' | 'center' | 'right';
  children?: ReactNode;
}

// Dock component props (replacing any types)
export interface DockIconProps extends BaseComponentProps {
  size?: number;
  mouseX?: number;
  children?: ReactNode;
}

export interface DockProps extends BaseComponentProps {
  direction?: 'top' | 'middle' | 'bottom';
  children?: ReactNode;
}

// Event handler types
export interface MouseEventHandler<T = Element> {
  (event: React.MouseEvent<T>): void;
}

export interface ChangeEventHandler<T = Element> {
  (event: React.ChangeEvent<T>): void;
}

export interface KeyboardEventHandler<T = Element> {
  (event: React.KeyboardEvent<T>): void;
}

// Form-related types
export interface FormFieldProps extends BaseComponentProps {
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export interface InputProps extends FormFieldProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
}

export interface SelectProps extends FormFieldProps {
  value?: string;
  defaultValue?: string;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
}

// Modal and overlay props
export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export interface OverlayProps extends BaseComponentProps {
  isVisible: boolean;
  onClose?: () => void;
  backdrop?: boolean;
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

// Tool-related component props
export interface ToolExecutionProps extends BaseComponentProps {
  toolName: string;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: unknown;
  error?: string;
  onRetry?: () => void;
}

// Message component props
export interface MessageProps extends BaseComponentProps {
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp?: Date;
  isStreaming?: boolean;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: string;
  }>;
}

// Settings component props
export interface SettingsGroupProps extends BaseComponentProps {
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export interface SettingsFieldProps extends FormFieldProps {
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
  value: unknown;
  onChange: (value: unknown) => void;
  options?: Array<{ value: unknown; label: string }>;
  min?: number;
  max?: number;
  step?: number;
}

// Provider-specific component props
export interface ProviderConfigProps extends BaseComponentProps {
  providerId: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  onValidate?: (config: Record<string, unknown>) => boolean;
}

// Chat-related component props
export interface ChatInputProps extends BaseComponentProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  multiline?: boolean;
  autoFocus?: boolean;
}

export interface ChatMessageProps extends BaseComponentProps {
  message: MessageProps;
  showTimestamp?: boolean;
  showAvatar?: boolean;
  onEdit?: (content: string) => void;
  onDelete?: () => void;
  onCopy?: () => void;
}

// File upload component props
export interface FileUploadProps extends BaseComponentProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  onFileSelect: (files: File[]) => void;
  onError?: (error: string) => void;
  dragAndDrop?: boolean;
}

// Progress component props
export interface ProgressProps extends BaseComponentProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

// Notification component props
export interface NotificationProps extends BaseComponentProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
  onClose?: () => void;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
}

// Theme-related props
export interface ThemeProviderProps extends BaseComponentProps {
  theme: 'light' | 'dark' | 'auto';
  children: ReactNode;
}

// Utility types for component composition
export type ComponentWithChildren<T = {}> = T & {
  children?: ReactNode;
};

export type ComponentWithClassName<T = {}> = T & {
  className?: string;
};

export type ComponentWithTestId<T = {}> = T & {
  'data-testid'?: string;
};

// Higher-order component types
export type WithLoadingState<T> = T & {
  loading?: boolean;
  loadingText?: string;
};

export type WithErrorState<T> = T & {
  error?: string | Error;
  onErrorRetry?: () => void;
};

export type WithValidationState<T> = T & {
  isValid?: boolean;
  validationErrors?: string[];
};
