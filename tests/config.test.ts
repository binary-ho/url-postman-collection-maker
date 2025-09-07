/**
 * Unit Tests for Configuration Module
 * 
 * This test suite validates the configuration loading functionality including:
 * - YAML file loading and parsing
 * - Environment variable processing
 * - Type validation and error handling
 * - Default value application
 * - Configuration utilities
 */

import { 
  loadConfig, 
  loadConfigSafe, 
  createSampleConfig, 
  formatConfigForDisplay,
  defaultConfig
} from '../src/config/index';
import { AppConfig, isAppConfig } from '../src/types/index';
import * as fs from 'fs';
import * as path from 'path';

describe('Configuration Module', () => {
  const testConfigDir = path.join(__dirname, 'test-configs');
  
  beforeAll(() => {
    // Create test config directory
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test config directory
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env['AI_API_KEY'];
    delete process.env['MOCKGEN_ALLOWED_HOSTS'];
  });

  afterEach(() => {
    // Clean up any test files created during tests
    const testFiles = [
      path.join(testConfigDir, 'valid-config.yaml'),
      path.join(testConfigDir, 'invalid-config.yaml'),
      path.join(testConfigDir, 'empty-config.yaml'),
      path.join(testConfigDir, 'partial-config.yaml'),
      path.join(testConfigDir, 'sample-config.yaml')
    ];
    
    testFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  describe('YAML File Loading', () => {
    test('should load valid YAML configuration successfully', () => {
      const validConfig = `
ai:
  api_key: "test-api-key-12345"
  model_name: "gemini-1.5-pro-latest"
  prompt_template_path: "./prompts/collection_generator.txt"

output:
  default_filename: "test_collection.json"

filter:
  allowed_hosts:
    - "api.example.com"
    - "test.api.com"
`;
      
      const configPath = path.join(testConfigDir, 'valid-config.yaml');
      fs.writeFileSync(configPath, validConfig);
      
      const config = loadConfig({ 
        configPath,
        useEnvVars: false,
        applyDefaults: false 
      });
      
      expect(config).toBeDefined();
      expect(config.ai.api_key).toBe('test-api-key-12345');
      expect(config.ai.model_name).toBe('gemini-1.5-pro-latest');
      expect(config.output.default_filename).toBe('test_collection.json');
      expect(config.filter.allowed_hosts).toEqual(['api.example.com', 'test.api.com']);
    });

    test('should handle missing configuration file with defaults', () => {
      const nonExistentPath = path.join(testConfigDir, 'non-existent.yaml');
      
      const config = loadConfig({ 
        configPath: nonExistentPath,
        useEnvVars: false,
        applyDefaults: true 
      });
      
      expect(config).toBeDefined();
      expect(config.ai.model_name).toBe('gemini-1.5-pro-latest'); // Default value
      expect(config.output.default_filename).toBe('postman_collection.json'); // Default value
      expect(config.filter.allowed_hosts).toEqual([]); // Default value
    });

    test('should throw error for missing file without defaults', () => {
      const nonExistentPath = path.join(testConfigDir, 'non-existent.yaml');
      
      expect(() => {
        loadConfig({ 
          configPath: nonExistentPath,
          useEnvVars: false,
          applyDefaults: false 
        });
      }).toThrow();
    });

    test('should handle empty YAML file', () => {
      const configPath = path.join(testConfigDir, 'empty-config.yaml');
      fs.writeFileSync(configPath, '');
      
      expect(() => {
        loadConfig({ 
          configPath,
          useEnvVars: false,
          applyDefaults: false 
        });
      }).toThrow();
    });

    test('should handle invalid YAML syntax', () => {
      const invalidYaml = `
ai:
  api_key: "test-key"
  model_name: invalid yaml syntax [
`;
      
      const configPath = path.join(testConfigDir, 'invalid-config.yaml');
      fs.writeFileSync(configPath, invalidYaml);
      
      expect(() => {
        loadConfig({ 
          configPath,
          useEnvVars: false,
          applyDefaults: false 
        });
      }).toThrow();
    });
  });

  describe('Environment Variable Processing', () => {
    test('should override API key from environment variable', () => {
      const baseConfig = `
ai:
  api_key: "config-file-key"
  model_name: "gemini-1.5-pro-latest"
  prompt_template_path: "./prompts/collection_generator.txt"

output:
  default_filename: "test_collection.json"

filter:
  allowed_hosts: []
`;
      
      const configPath = path.join(testConfigDir, 'valid-config.yaml');
      fs.writeFileSync(configPath, baseConfig);
      
      process.env['AI_API_KEY'] = 'env-override-key';
      
      const config = loadConfig({ 
        configPath,
        useEnvVars: true,
        applyDefaults: false 
      });
      
      expect(config.ai.api_key).toBe('env-override-key');
    });

    test('should override model name from environment variable', () => {
      const baseConfig = `
ai:
  api_key: "test-key"
  model_name: "gemini-1.5-pro-latest"
  prompt_template_path: "./prompts/collection_generator.txt"

output:
  default_filename: "test_collection.json"

filter:
  allowed_hosts: []
`;
      
      const configPath = path.join(testConfigDir, 'valid-config.yaml');
      fs.writeFileSync(configPath, baseConfig);
      
      process.env['GEMINI_MODEL_NAME'] = 'gemini-1.5-flash-latest';
      
      const config = loadConfig({ 
        configPath,
        useEnvVars: true,
        applyDefaults: false 
      });
      
      expect(config.ai.model_name).toBe('gemini-1.5-flash-latest');
    });

    test('should override output filename from environment variable', () => {
      const baseConfig = `
ai:
  api_key: "test-key"
  model_name: "gemini-1.5-pro-latest"
  prompt_template_path: "./prompts/collection_generator.txt"

output:
  default_filename: "test_collection.json"

filter:
  allowed_hosts: []
`;
      
      const configPath = path.join(testConfigDir, 'valid-config.yaml');
      fs.writeFileSync(configPath, baseConfig);
      
      process.env['MOCKGEN_OUTPUT_FILE'] = 'env-output.json';
      
      const config = loadConfig({ 
        configPath,
        useEnvVars: true,
        applyDefaults: false 
      });
      
      expect(config.output.default_filename).toBe('env-output.json');
    });

    test('should not override when environment variables are disabled', () => {
      const baseConfig = `
ai:
  api_key: "config-file-key"
  model_name: "gemini-1.5-pro-latest"
  prompt_template_path: "./prompts/collection_generator.txt"

output:
  default_filename: "test_collection.json"

filter:
  allowed_hosts: []
`;
      
      const configPath = path.join(testConfigDir, 'valid-config.yaml');
      fs.writeFileSync(configPath, baseConfig);
      
      process.env['AI_API_KEY'] = 'env-override-key';
      
      const config = loadConfig({ 
        configPath,
        useEnvVars: false,
        applyDefaults: false 
      });
      
      expect(config.ai.api_key).toBe('config-file-key');
    });
  });

  describe('Default Value Application', () => {
    test('should apply default values for missing sections', () => {
      const partialConfig = `
ai:
  api_key: "test-key"
`;
      
      const configPath = path.join(testConfigDir, 'partial-config.yaml');
      fs.writeFileSync(configPath, partialConfig);
      
      const config = loadConfig({ 
        configPath,
        useEnvVars: false,
        applyDefaults: true 
      });
      
      expect(config.ai.api_key).toBe('test-key');
      expect(config.ai.model_name).toBe('gemini-1.5-pro-latest'); // Default
      expect(config.ai.prompt_template_path).toBe('./prompts/collection_generator.txt'); // Default
      expect(config.output.default_filename).toBe('postman_collection.json'); // Default
      expect(config.filter.allowed_hosts).toEqual([]); // Default
    });

    test('should not apply defaults when disabled', () => {
      const partialConfig = `
ai:
  api_key: "test-key"
`;
      
      const configPath = path.join(testConfigDir, 'partial-config.yaml');
      fs.writeFileSync(configPath, partialConfig);
      
      expect(() => {
        loadConfig({ 
          configPath,
          useEnvVars: false,
          applyDefaults: false 
        });
      }).toThrow();
    });

    test('should merge partial sections with defaults', () => {
      const partialConfig = `
ai:
  api_key: "test-key"
  model_name: "custom-model"

output:
  default_filename: "custom.json"
`;
      
      const configPath = path.join(testConfigDir, 'partial-config.yaml');
      fs.writeFileSync(configPath, partialConfig);
      
      const config = loadConfig({ 
        configPath,
        useEnvVars: false,
        applyDefaults: true 
      });
      
      expect(config.ai.api_key).toBe('test-key');
      expect(config.ai.model_name).toBe('custom-model');
      expect(config.ai.prompt_template_path).toBe('./prompts/collection_generator.txt'); // Default
      expect(config.output.default_filename).toBe('custom.json');
      expect(config.filter.allowed_hosts).toEqual([]); // Default
    });
  });

  describe('Type Validation', () => {
    test('should validate configuration structure', () => {
      const validConfig = `
ai:
  api_key: "test-key"
  model_name: "gemini-1.5-pro-latest"
  prompt_template_path: "./prompts/collection_generator.txt"

output:
  default_filename: "test.json"

filter:
  allowed_hosts:
    - "api.example.com"
`;
      
      const configPath = path.join(testConfigDir, 'valid-config.yaml');
      fs.writeFileSync(configPath, validConfig);
      
      const config = loadConfig({ 
        configPath,
        useEnvVars: false,
        applyDefaults: false 
      });
      
      expect(isAppConfig(config)).toBe(true);
    });

    test('should reject invalid configuration structure', () => {
      const invalidConfig = `
invalid_section:
  some_key: "some_value"
`;
      
      const configPath = path.join(testConfigDir, 'invalid-config.yaml');
      fs.writeFileSync(configPath, invalidConfig);
      
      expect(() => {
        loadConfig({ 
          configPath,
          useEnvVars: false,
          applyDefaults: false 
        });
      }).toThrow();
    });

    test('should validate allowed_hosts as array', () => {
      const invalidConfig = `
ai:
  api_key: "test-key"
  model_name: "gemini-1.5-pro-latest"
  prompt_template_path: "./prompts/collection_generator.txt"

output:
  default_filename: "test.json"

filter:
  allowed_hosts: "not-an-array"
`;
      
      const configPath = path.join(testConfigDir, 'invalid-config.yaml');
      fs.writeFileSync(configPath, invalidConfig);
      
      expect(() => {
        loadConfig({ 
          configPath,
          useEnvVars: false,
          applyDefaults: false 
        });
      }).toThrow();
    });

    test('should validate allowed_hosts entries as strings', () => {
      const invalidConfig = `
ai:
  api_key: "test-key"
  model_name: "gemini-1.5-pro-latest"
  prompt_template_path: "./prompts/collection_generator.txt"

output:
  default_filename: "test.json"

filter:
  allowed_hosts:
    - "valid.host.com"
    - 123
    - ""
`;
      
      const configPath = path.join(testConfigDir, 'invalid-config.yaml');
      fs.writeFileSync(configPath, invalidConfig);
      
      expect(() => {
        loadConfig({ 
          configPath,
          useEnvVars: false,
          applyDefaults: false 
        });
      }).toThrow();
    });

    test('should handle development mode for missing API key', () => {
      const configWithoutApiKey = `
ai:
  api_key: ""
  model_name: "gemini-1.5-pro-latest"
  prompt_template_path: "./prompts/collection_generator.txt"

output:
  default_filename: "test.json"

filter:
  allowed_hosts: []
`;
      
      const configPath = path.join(testConfigDir, 'no-api-key-config.yaml');
      fs.writeFileSync(configPath, configWithoutApiKey);
      
      process.env['NODE_ENV'] = 'development';
      
      const config = loadConfig({ 
        configPath,
        useEnvVars: false,
        applyDefaults: false 
      });
      
      expect(config.ai.api_key).toBe('');
    });
  });

  describe('Safe Configuration Loading', () => {
    test('should return null for invalid configuration', () => {
      const nonExistentPath = path.join(testConfigDir, 'non-existent.yaml');
      
      const config = loadConfigSafe({ 
        configPath: nonExistentPath,
        useEnvVars: false,
        applyDefaults: false 
      });
      
      expect(config).toBeNull();
    });

    test('should return valid configuration for valid file', () => {
      const validConfig = `
ai:
  api_key: "test-key"
  model_name: "gemini-1.5-pro-latest"
  prompt_template_path: "./prompts/collection_generator.txt"

output:
  default_filename: "test.json"

filter:
  allowed_hosts: []
`;
      
      const configPath = path.join(testConfigDir, 'valid-config.yaml');
      fs.writeFileSync(configPath, validConfig);
      
      const config = loadConfigSafe({ 
        configPath,
        useEnvVars: false,
        applyDefaults: false 
      });
      
      expect(config).not.toBeNull();
      expect(config!.ai.api_key).toBe('test-key');
    });
  });

  describe('Configuration Utilities', () => {
    test('should create sample configuration file', () => {
      const samplePath = path.join(testConfigDir, 'sample-config.yaml');
      
      createSampleConfig(samplePath);
      
      expect(fs.existsSync(samplePath)).toBe(true);
      
      const content = fs.readFileSync(samplePath, 'utf8');
      expect(content).toContain('MockGen AI Configuration File');
      expect(content).toContain('ai:');
      expect(content).toContain('output:');
      expect(content).toContain('filter:');
      expect(content).toContain('YOUR_GEMINI_API_KEY');
    });

    test('should format configuration for display', () => {
      const config: AppConfig = {
        ai: {
          api_key: 'secret-api-key-12345',
          model_name: 'gemini-1.5-pro-latest',
          prompt_template_path: './prompts/collection_generator.txt'
        },
        output: {
          default_filename: 'test.json'
        },
        filter: {
          allowed_hosts: ['api.example.com']
        }
      };
      
      const formatted = formatConfigForDisplay(config, true);
      
      expect(formatted).toContain('secret-a...');
      expect(formatted).not.toContain('secret-api-key-12345');
      expect(formatted).toContain('gemini-1.5-pro-latest');
    });

    test('should format configuration without hiding secrets', () => {
      const config: AppConfig = {
        ai: {
          api_key: 'secret-api-key-12345',
          model_name: 'gemini-1.5-pro-latest',
          prompt_template_path: './prompts/collection_generator.txt'
        },
        output: {
          default_filename: 'test.json'
        },
        filter: {
          allowed_hosts: ['api.example.com']
        }
      };
      
      const formatted = formatConfigForDisplay(config, false);
      
      expect(formatted).toContain('secret-api-key-12345');
      expect(formatted).toContain('gemini-1.5-pro-latest');
    });
  });

  describe('Default Configuration', () => {
    test('should provide default configuration object', () => {
      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.ai.model_name).toBe('gemini-1.5-pro-latest');
      expect(defaultConfig.output.default_filename).toBe('postman_collection.json');
      expect(defaultConfig.filter.allowed_hosts).toEqual([]);
    });

    test('should be immutable', () => {
      expect(() => {
        (defaultConfig as any).ai.api_key = 'modified';
      }).toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should provide structured error information', () => {
      const nonExistentPath = path.join(testConfigDir, 'non-existent.yaml');
      
      try {
        loadConfig({ 
          configPath: nonExistentPath,
          useEnvVars: false,
          applyDefaults: false 
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toHaveProperty('category');
        expect(error).toHaveProperty('code');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('timestamp');
        expect(error.category).toBe('CONFIG');
      }
    });

    test('should handle file system errors gracefully', () => {
      expect(() => {
        createSampleConfig('/invalid/path/that/does/not/exist/config.yaml');
      }).toThrow();
    });
  });

  describe('Integration with Types', () => {
    test('should work with type guards', () => {
      const validConfig = `
ai:
  api_key: "test-key"
  model_name: "gemini-1.5-pro-latest"
  prompt_template_path: "./prompts/collection_generator.txt"

output:
  default_filename: "test.json"

filter:
  allowed_hosts:
    - "api.example.com"
`;
      
      const configPath = path.join(testConfigDir, 'valid-config.yaml');
      fs.writeFileSync(configPath, validConfig);
      
      const config = loadConfig({ 
        configPath,
        useEnvVars: false,
        applyDefaults: false 
      });
      
      expect(isAppConfig(config)).toBe(true);
    });

    test('should reject invalid objects with type guards', () => {
      const invalidObject = {
        invalid: 'structure'
      };
      
      expect(isAppConfig(invalidObject)).toBe(false);
    });
  });
});