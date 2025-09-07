/**
 * MockGen AI - Configuration Loading System
 * 
 * This module handles loading and parsing of the application configuration from YAML files,
 * environment variables, and provides default values with comprehensive type validation.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import * as dotenv from 'dotenv';
import { 
  AppConfig, 
  ConfigLoadOptions, 
  AiConfig, 
  OutputConfig, 
  FilterConfig,
  isAppConfig,
  ErrorCategory,
  AppError 
} from '../types/index';

// ============================================================================
// Default Configuration Values
// ============================================================================

/**
 * Default AI configuration
 */
const DEFAULT_AI_CONFIG: AiConfig = {
  api_key: '',
  model_name: 'gemini-1.5-pro-latest',
  prompt_template_path: './prompts/collection_generator.txt'
};

/**
 * Default output configuration
 */
const DEFAULT_OUTPUT_CONFIG: OutputConfig = {
  default_filename: 'postman_collection.json'
};

/**
 * Default filter configuration
 */
const DEFAULT_FILTER_CONFIG: FilterConfig = {
  allowed_hosts: []
};

/**
 * Complete default configuration
 */
const DEFAULT_CONFIG: AppConfig = {
  ai: DEFAULT_AI_CONFIG,
  output: DEFAULT_OUTPUT_CONFIG,
  filter: DEFAULT_FILTER_CONFIG
};

// ============================================================================
// Configuration Loading Functions
// ============================================================================

/**
 * Creates a structured application error
 */
function createConfigError(code: string, message: string, details?: string, originalError?: Error): AppError {
  const error: AppError = {
    category: ErrorCategory.CONFIG,
    code,
    message,
    timestamp: Date.now()
  };
  
  if (details !== undefined) {
    error.details = details;
  }
  
  if (originalError !== undefined) {
    error.originalError = originalError;
  }
  
  return error;
}

/**
 * Loads and parses a YAML configuration file
 * @param filePath Path to the YAML configuration file
 * @returns Parsed configuration object
 * @throws AppError if file cannot be read or parsed
 */
function loadYamlFile(filePath: string): any {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw createConfigError(
        'FILE_NOT_FOUND',
        `Configuration file not found: ${filePath}`,
        `Please ensure the config.yaml file exists at the specified path.`
      );
    }

    // Read file content
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    if (!fileContent.trim()) {
      throw createConfigError(
        'EMPTY_FILE',
        `Configuration file is empty: ${filePath}`,
        `The configuration file exists but contains no content.`
      );
    }

    // Parse YAML content
    const parsedConfig = yaml.parse(fileContent);
    
    if (!parsedConfig || typeof parsedConfig !== 'object') {
      throw createConfigError(
        'INVALID_YAML',
        `Invalid YAML content in configuration file: ${filePath}`,
        `The YAML file could not be parsed into a valid object structure.`
      );
    }

    return parsedConfig;
  } catch (error) {
    if (error instanceof Error && 'category' in error) {
      // Re-throw AppError as-is
      throw error;
    }
    
    // Wrap other errors
    throw createConfigError(
      'YAML_PARSE_ERROR',
      `Failed to parse YAML configuration file: ${filePath}`,
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Processes environment variables and overrides configuration values
 * Only processes sensitive information: API key and allowed hosts
 * @param config Configuration object to process
 * @returns Configuration with environment variable overrides applied
 */
function processEnvironmentVariables(config: AppConfig): AppConfig {
  const processedConfig = { ...config };

  // Override API key from environment variable if present
  const envApiKey = process.env['AI_API_KEY'];
  if (envApiKey && envApiKey.trim()) {
    processedConfig.ai = {
      ...processedConfig.ai,
      api_key: envApiKey.trim()
    };
  }

  // Override allowed hosts from environment variable if present
  const envAllowedHosts = process.env['MOCKGEN_ALLOWED_HOSTS'];
  if (envAllowedHosts && envAllowedHosts.trim()) {
    // Parse comma-separated list of hosts
    const hosts = envAllowedHosts.split(',').map(host => host.trim()).filter(host => host.length > 0);
    if (hosts.length > 0) {
      processedConfig.filter = {
        ...processedConfig.filter,
        allowed_hosts: hosts
      };
    }
  }

  return processedConfig;
}

/**
 * Applies default values to missing configuration sections
 * @param config Partial configuration object
 * @returns Complete configuration with defaults applied
 */
function applyDefaultValues(config: Partial<AppConfig>): AppConfig {
  return {
    ai: {
      ...DEFAULT_AI_CONFIG,
      ...config.ai
    },
    output: {
      ...DEFAULT_OUTPUT_CONFIG,
      ...config.output
    },
    filter: {
      ...DEFAULT_FILTER_CONFIG,
      ...config.filter
    }
  };
}

/**
 * Validates the configuration object structure and required fields
 * @param config Configuration object to validate
 * @throws AppError if configuration is invalid
 */
function validateConfiguration(config: any): asserts config is AppConfig {
  if (!isAppConfig(config)) {
    const missingFields: string[] = [];
    
    if (!config.ai) {
      missingFields.push('ai section');
    } else {
      if (!config.ai.api_key) missingFields.push('ai.api_key');
      if (!config.ai.model_name) missingFields.push('ai.model_name');
      if (!config.ai.prompt_template_path) missingFields.push('ai.prompt_template_path');
    }
    
    if (!config.output) {
      missingFields.push('output section');
    } else {
      if (!config.output.default_filename) missingFields.push('output.default_filename');
    }
    
    if (!config.filter) {
      missingFields.push('filter section');
    } else {
      if (!Array.isArray(config.filter.allowed_hosts)) missingFields.push('filter.allowed_hosts (must be array)');
    }

    throw createConfigError(
      'INVALID_CONFIG_STRUCTURE',
      'Configuration object has invalid structure',
      `Missing or invalid fields: ${missingFields.join(', ')}`
    );
  }

  // Validate API key is not empty (unless we're in development mode)
  if (!config.ai.api_key && process.env['NODE_ENV'] !== 'development') {
    throw createConfigError(
      'MISSING_API_KEY',
      'Gemini API key is required',
      'Please set the api_key in config.yaml or set the AI_API_KEY environment variable'
    );
  }

  // Validate prompt template path exists
  if (config.ai.prompt_template_path) {
    const promptPath = path.resolve(config.ai.prompt_template_path);
    if (!fs.existsSync(promptPath)) {
      throw createConfigError(
        'PROMPT_TEMPLATE_NOT_FOUND',
        `Prompt template file not found: ${config.ai.prompt_template_path}`,
        `Please ensure the prompt template file exists at the specified path: ${promptPath}`
      );
    }
  }

  // Validate allowed_hosts format
  if (config.filter.allowed_hosts.length > 0) {
    for (const host of config.filter.allowed_hosts) {
      if (typeof host !== 'string' || !host.trim()) {
        throw createConfigError(
          'INVALID_ALLOWED_HOST',
          'Invalid allowed host configuration',
          `All allowed_hosts entries must be non-empty strings. Found: ${JSON.stringify(host)}`
        );
      }
    }
  }
}

/**
 * Main configuration loading function
 * @param options Configuration loading options
 * @returns Loaded and validated configuration
 * @throws AppError if configuration cannot be loaded or is invalid
 */
export function loadConfig(options: ConfigLoadOptions = {}): AppConfig {
  const {
    configPath = './config.yaml',
    useEnvVars = true,
    applyDefaults = true
  } = options;

  try {
    // Step 0: Load .env file if it exists
    const envPath = path.resolve('.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }

    // Step 1: Load YAML file
    let config: Partial<AppConfig>;
    
    try {
      config = loadYamlFile(configPath);
    } catch (error) {
      if (applyDefaults) {
        // If file doesn't exist but we're applying defaults, start with empty config
        console.warn(`Configuration file not found at ${configPath}, using defaults`);
        config = {};
      } else {
        throw error;
      }
    }

    // Step 2: Apply default values if requested
    if (applyDefaults) {
      config = applyDefaultValues(config);
    }

    // Step 3: Process environment variables if requested
    if (useEnvVars) {
      config = processEnvironmentVariables(config as AppConfig);
    }

    // Step 4: Validate final configuration
    validateConfiguration(config);

    return config;
  } catch (error) {
    if (error instanceof Error && 'category' in error) {
      // Re-throw AppError as-is
      throw error;
    }
    
    // Wrap unexpected errors
    const errorDetails = error instanceof Error ? 
      `${error.name}: ${error.message}${error.stack ? '\n' + error.stack : ''}` : 
      JSON.stringify(error);
    
    throw createConfigError(
      'CONFIG_LOAD_ERROR',
      'Unexpected error while loading configuration',
      errorDetails,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Loads configuration with error handling and user-friendly messages
 * @param options Configuration loading options
 * @returns Configuration object or null if loading failed
 */
export function loadConfigSafe(options: ConfigLoadOptions = {}): AppConfig | null {
  try {
    return loadConfig(options);
  } catch (error) {
    if (error instanceof Error && 'category' in error && 'code' in error && 'timestamp' in error) {
      const appError = error as unknown as AppError;
      console.error(`❌ Configuration Error [${appError.code}]: ${appError.message}`);
      if (appError.details) {
        console.error(`   Details: ${appError.details}`);
      }
    } else {
      console.error('❌ Unexpected configuration error:', error);
    }
    return null;
  }
}

/**
 * Creates a sample configuration file with comments
 * @param filePath Path where to create the sample config file
 */
export function createSampleConfig(filePath: string = './config.yaml'): void {
  const sampleConfig = `# MockGen AI Configuration File
# This file contains all configuration options for the MockGen AI application

ai:
  # Google AI Studio API key for Gemini
  # You can also set this via the AI_API_KEY environment variable
  # Get your API key from: https://makersuite.google.com/app/apikey
  api_key: "YOUR_GEMINI_API_KEY"

  # Gemini model to use for collection generation
  # Available models: gemini-1.5-pro-latest, gemini-1.5-flash-latest
  model_name: "gemini-1.5-pro-latest"

  # Path to the AI prompt template file
  prompt_template_path: "./prompts/collection_generator.txt"

output:
  # Default filename for generated Postman collections
  default_filename: "postman_collection.json"

filter:
  # List of allowed host names for network request filtering
  # If empty, all hosts will be captured
  # Example hosts for different environments:
  allowed_hosts:
    - "api.global.oliveyoung.com"
    - "stg-api.global.oliveyoung.com"
    # - "localhost:3000"
    # - "api.example.com"
`;

  try {
    fs.writeFileSync(filePath, sampleConfig, 'utf8');
    console.log(`✅ Sample configuration file created at: ${filePath}`);
  } catch (error) {
    throw createConfigError(
      'SAMPLE_CONFIG_CREATE_ERROR',
      `Failed to create sample configuration file at: ${filePath}`,
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Gets the current configuration as a formatted string for debugging
 * @param config Configuration object
 * @param hideSecrets Whether to hide sensitive information like API keys
 * @returns Formatted configuration string
 */
export function formatConfigForDisplay(config: AppConfig, hideSecrets: boolean = true): string {
  const displayConfig = { ...config };
  
  if (hideSecrets && displayConfig.ai.api_key) {
    displayConfig.ai.api_key = displayConfig.ai.api_key.substring(0, 8) + '...';
  }
  
  return JSON.stringify(displayConfig, null, 2);
}

// ============================================================================
// Exported Default Configuration
// ============================================================================

/**
 * Default configuration object (read-only)
 */
export const defaultConfig: Readonly<AppConfig> = Object.freeze({ ...DEFAULT_CONFIG });