/**
 * MockGen AI - Core Type Definitions
 * 
 * This file contains all TypeScript type definitions used throughout the application.
 * Types are organized by domain: Network Logs, Configuration, AI Integration, and Postman Collection.
 */

// ============================================================================
// Network Log Data Types
// ============================================================================

/**
 * Raw network request data captured from browser
 */
export interface NetworkRequest {
  /** HTTP method (GET, POST, PUT, DELETE, etc.) */
  method: string;
  /** Full URL of the request */
  url: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Request body (if any) */
  body?: string;
  /** Timestamp when request was made */
  timestamp: number;
}

/**
 * Raw network response data captured from browser
 */
export interface NetworkResponse {
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body content */
  body: string;
  /** Content type of the response */
  contentType: string;
  /** Timestamp when response was received */
  timestamp: number;
}

/**
 * Complete network log entry combining request and response
 */
export interface NetworkLogEntry {
  /** Unique identifier for this log entry */
  id: string;
  /** The network request data */
  request: NetworkRequest;
  /** The network response data */
  response: NetworkResponse;
  /** Resource type (fetch, xhr, document, etc.) */
  resourceType: string;
  /** Whether this entry matches BFF block API pattern */
  isBffBlockApi: boolean;
}

/**
 * Collection of network log entries
 */
export type NetworkLogCollection = NetworkLogEntry[];

// ============================================================================
// Configuration File Structure Types
// ============================================================================

/**
 * AI configuration section
 */
export interface AiConfig {
  /** Gemini API key (can be overridden by environment variable) */
  api_key: string;
  /** Gemini model name to use */
  model_name: string;
  /** Path to the AI prompt template file */
  prompt_template_path: string;
}

/**
 * Output configuration section
 */
export interface OutputConfig {
  /** Default filename for generated Postman collection */
  default_filename: string;
}

/**
 * Filter configuration section
 */
export interface FilterConfig {
  /** List of allowed host names for network request filtering */
  allowed_hosts: string[];
}

/**
 * Complete application configuration structure
 */
export interface AppConfig {
  /** AI-related configuration */
  ai: AiConfig;
  /** Output-related configuration */
  output: OutputConfig;
  /** Filtering-related configuration */
  filter: FilterConfig;
}

/**
 * Configuration loading options
 */
export interface ConfigLoadOptions {
  /** Path to the configuration file */
  configPath?: string;
  /** Whether to use environment variables */
  useEnvVars?: boolean;
  /** Whether to apply default values for missing config */
  applyDefaults?: boolean;
}

// ============================================================================
// AI Response Data Types
// ============================================================================

/**
 * Processed API data structure for AI consumption
 */
export interface ProcessedApiData {
  /** HTTP method */
  method: string;
  /** API endpoint URL */
  url: string;
  /** Example response body */
  responseBody: string;
  /** Query parameters extracted from URL */
  queryParams: Record<string, string>;
  /** Path parameters if any */
  pathParams: Record<string, string>;
}

/**
 * Collection of processed API data
 */
export type ProcessedApiCollection = ProcessedApiData[];

/**
 * AI prompt data structure
 */
export interface AiPromptData {
  /** The complete prompt text to send to AI */
  prompt: string;
  /** The processed API data embedded in the prompt */
  apiData: ProcessedApiCollection;
  /** Template variables used in prompt generation */
  templateVars: Record<string, string>;
}

/**
 * AI response validation result
 */
export interface AiResponseValidation {
  /** Whether the response is valid JSON */
  isValid: boolean;
  /** Parsed JSON data if valid */
  data?: any;
  /** Error message if invalid */
  error?: string;
}

/**
 * AI generation result
 */
export interface AiGenerationResult {
  /** Whether generation was successful */
  success: boolean;
  /** Generated Postman collection JSON string */
  collectionJson?: string;
  /** Error message if generation failed */
  error?: string;
  /** Number of retry attempts made */
  retryCount: number;
}

// ============================================================================
// Postman Collection Schema Types
// ============================================================================

/**
 * Postman Collection Info section
 */
export interface PostmanCollectionInfo {
  /** Collection name */
  name: string;
  /** Unique collection ID */
  _postman_id: string;
  /** Collection description */
  description: string;
  /** Postman schema version */
  schema: string;
}

/**
 * Postman request definition
 */
export interface PostmanRequest {
  /** HTTP method */
  method: string;
  /** Request headers */
  header: Array<{
    key: string;
    value: string;
    type: string;
  }>;
  /** Request URL */
  url: {
    raw: string;
    protocol: string;
    host: string[];
    path: string[];
    query?: Array<{
      key: string;
      value: string;
    }>;
  };
  /** Request body */
  body?: {
    mode: string;
    raw?: string;
    options?: {
      raw: {
        language: string;
      };
    };
  };
}

/**
 * Postman response example
 */
export interface PostmanResponse {
  /** Response name/description */
  name: string;
  /** Original request that generated this response */
  originalRequest: PostmanRequest;
  /** HTTP status code */
  code: number;
  /** HTTP status text */
  status: string;
  /** Response headers */
  header: Array<{
    key: string;
    value: string;
  }>;
  /** Response body */
  body: string;
}

/**
 * Postman collection item (API endpoint)
 */
export interface PostmanCollectionItem {
  /** Item name */
  name: string;
  /** Request definition */
  request: PostmanRequest;
  /** Example responses */
  response: PostmanResponse[];
}

/**
 * Postman collection variable
 */
export interface PostmanVariable {
  /** Variable key */
  key: string;
  /** Variable value */
  value: string;
  /** Variable type */
  type?: string;
}

/**
 * Complete Postman Collection structure (v2.1.0)
 */
export interface PostmanCollection {
  /** Collection metadata */
  info: PostmanCollectionInfo;
  /** Collection items (API endpoints) */
  item: PostmanCollectionItem[];
  /** Collection variables */
  variable: PostmanVariable[];
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  /** Whether the operation was successful */
  success: boolean;
  /** Response data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * File operation result
 */
export interface FileOperationResult {
  /** Whether the operation was successful */
  success: boolean;
  /** File path that was operated on */
  filePath: string;
  /** Error message if operation failed */
  error?: string;
  /** File content if read operation */
  content?: string;
}

/**
 * URL parsing result
 */
export interface ParsedUrl {
  /** Protocol (http, https) */
  protocol: string;
  /** Hostname */
  hostname: string;
  /** Port number */
  port?: string;
  /** Path portion */
  pathname: string;
  /** Query string parameters */
  searchParams: Record<string, string>;
  /** Hash fragment */
  hash?: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Application error categories
 */
export enum ErrorCategory {
  CONFIG = 'CONFIG',
  NETWORK = 'NETWORK',
  AI_API = 'AI_API',
  FILE_SYSTEM = 'FILE_SYSTEM',
  VALIDATION = 'VALIDATION',
  BROWSER = 'BROWSER',
  USER_INPUT = 'USER_INPUT'
}

/**
 * Structured application error
 */
export interface AppError {
  /** Error category */
  category: ErrorCategory;
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Technical details for debugging */
  details?: string;
  /** Original error object if any */
  originalError?: Error;
  /** Timestamp when error occurred */
  timestamp: number;
}

// ============================================================================
// Type Guards and Validators
// ============================================================================

/**
 * Type guard to check if an object is a valid NetworkLogEntry
 */
export function isNetworkLogEntry(obj: any): obj is NetworkLogEntry {
  return (
    obj &&
    typeof obj.id === 'string' &&
    obj.request &&
    typeof obj.request.method === 'string' &&
    typeof obj.request.url === 'string' &&
    obj.response &&
    typeof obj.response.status === 'number' &&
    typeof obj.response.body === 'string'
  );
}

/**
 * Type guard to check if an object is a valid AppConfig
 */
export function isAppConfig(obj: any): obj is AppConfig {
  return (
    obj &&
    obj.ai &&
    typeof obj.ai.api_key === 'string' &&
    typeof obj.ai.model_name === 'string' &&
    typeof obj.ai.prompt_template_path === 'string' &&
    obj.output &&
    typeof obj.output.default_filename === 'string' &&
    obj.filter &&
    Array.isArray(obj.filter.allowed_hosts)
  );
}

/**
 * Type guard to check if an object is a valid PostmanCollection
 */
export function isPostmanCollection(obj: any): obj is PostmanCollection {
  return (
    obj &&
    obj.info &&
    typeof obj.info.name === 'string' &&
    typeof obj.info.schema === 'string' &&
    Array.isArray(obj.item) &&
    Array.isArray(obj.variable)
  );
}