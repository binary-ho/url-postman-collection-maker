/**
 * Integration Tests for CLI Workflow
 * 
 * This test suite validates the complete CLI workflow integration including:
 * - End-to-end module orchestration
 * - Configuration loading and validation
 * - Data flow between modules
 * - Error handling across the entire pipeline
 * - File operations and output generation
 */

import { MockGenCLI } from '../../src/cli';
import { loadConfig } from '../../src/config/index';
import { createBrowserController } from '../../src/modules/browserController';
import { createDataProcessor } from '../../src/modules/dataProcessor';
import { createAiGenerator } from '../../src/modules/aiGenerator';
import { NetworkLogCollection, ProcessedApiCollection } from '../../src/types/index';
import * as fs from 'fs';
import * as path from 'path';

// Mock external dependencies
jest.mock('child_process');
jest.mock('@google/generative-ai');
jest.mock('playwright');

describe('CLI Integration Tests', () => {
  const testConfigDir = path.join(__dirname, '../test-configs');
  const testOutputDir = path.join(__dirname, '../test-outputs');
  const testPromptsDir = path.join(__dirname, '../test-prompts');
  
  beforeAll(() => {
    // Create test directories
    [testConfigDir, testOutputDir, testPromptsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  });

  afterAll(() => {
    // Clean up test directories
    [testConfigDir, testOutputDir, testPromptsDir].forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  beforeEach(() => {
    // Clear environment variables
    delete process.env['AI_API_KEY'];
    delete process.env['NODE_ENV'];
    
    // Reset console methods
    jest.clearAllMocks();
  });

  const createTestConfig = () => {
    const configPath = path.join(testConfigDir, 'test-config.yaml');
    const promptPath = path.join(testPromptsDir, 'test-template.txt');
    
    const configContent = `
ai:
  api_key: "test-api-key-12345"
  model_name: "gemini-1.5-pro-latest"
  prompt_template_path: "${promptPath}"

output:
  default_filename: "${path.join(testOutputDir, 'test_collection.json')}"

filter:
  allowed_hosts:
    - "api.example.com"
    - "test.api.com"
`;

    const promptContent = `
You are an expert API designer.
Generate a Postman Collection from the provided data.

Input Data:
{{DATA}}

Return valid JSON only.
`;

    fs.writeFileSync(configPath, configContent);
    fs.writeFileSync(promptPath, promptContent);
    
    return configPath;
  };

  const createMockNetworkLogs = (): NetworkLogCollection => [
    {
      id: 'log_1',
      request: {
        method: 'GET',
        url: 'https://api.example.com/v1/blocks?keys=home.banner',
        headers: { 'content-type': 'application/json' },
        timestamp: Date.now()
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"home.banner": {"title": "Welcome", "image": "banner.jpg"}}',
        contentType: 'application/json',
        timestamp: Date.now()
      },
      resourceType: 'fetch',
      isBffBlockApi: true
    },
    {
      id: 'log_2',
      request: {
        method: 'GET',
        url: 'https://api.example.com/v1/users?page=1',
        headers: { 'content-type': 'application/json' },
        timestamp: Date.now()
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"users": [{"id": 1, "name": "John"}]}',
        contentType: 'application/json',
        timestamp: Date.now()
      },
      resourceType: 'fetch',
      isBffBlockApi: false
    }
  ];

  describe('Configuration Integration', () => {
    test('should load configuration successfully', () => {
      const configPath = createTestConfig();
      
      const config = loadConfig({
        configPath,
        useEnvVars: false,
        applyDefaults: true
      });
      
      expect(config).toBeDefined();
      expect(config.ai.model_name).toBe('gemini-1.5-pro-latest');
      expect(config.output.default_filename).toContain('test_collection.json');
      expect(config.filter.allowed_hosts).toHaveLength(2);
    });

    test('should handle missing configuration file gracefully', () => {
      const config = loadConfig({
        configPath: '/non/existent/config.yaml',
        useEnvVars: false,
        applyDefaults: true
      });
      
      expect(config).toBeDefined();
      expect(config.ai.model_name).toBe('gemini-1.5-pro-latest'); // Default value
    });

    test('should process environment variables correctly', () => {
      process.env['AI_API_KEY'] = 'env-api-key-12345';
      process.env['GEMINI_MODEL_NAME'] = 'gemini-1.5-flash-latest';
      
      const configPath = createTestConfig();
      const config = loadConfig({
        configPath,
        useEnvVars: true,
        applyDefaults: true
      });
      
      expect(config.ai.api_key).toBe('env-api-key-12345');
      expect(config.ai.model_name).toBe('gemini-1.5-flash-latest');
    });
  });

  describe('Module Orchestration', () => {
    test('should create all modules successfully', () => {
      const configPath = createTestConfig();
      const config = loadConfig({ configPath, useEnvVars: false, applyDefaults: true });
      
      // Test browser controller creation
      const browserController = createBrowserController(config);
      expect(browserController).toBeDefined();
      
      // Test data processor creation
      const dataProcessor = createDataProcessor({
        mergeDuplicates: true,
        prioritizeBffApis: true,
        maxApis: 50
      });
      expect(dataProcessor).toBeDefined();
      
      // Test AI generator creation
      const aiGenerator = createAiGenerator(config);
      expect(aiGenerator).toBeDefined();
      
      const status = aiGenerator.getStatus();
      expect(status.hasApiKey).toBe(true);
      expect(status.modelName).toBe('gemini-1.5-pro-latest');
    });

    test('should handle module creation with invalid configuration', () => {
      const invalidConfig = {
        ai: {
          api_key: '',
          model_name: 'invalid-model',
          prompt_template_path: '/invalid/path.txt'
        },
        output: {
          default_filename: ''
        },
        filter: {
          allowed_hosts: []
        }
      };
      
      // Browser controller should still work
      const browserController = createBrowserController(invalidConfig);
      expect(browserController).toBeDefined();
      
      // Data processor should work
      const dataProcessor = createDataProcessor();
      expect(dataProcessor).toBeDefined();
      
      // AI generator should work but not be initialized
      const aiGenerator = createAiGenerator(invalidConfig);
      expect(aiGenerator).toBeDefined();
      
      const status = aiGenerator.getStatus();
      expect(status.hasApiKey).toBe(false);
      expect(status.isInitialized).toBe(false);
    });
  });

  describe('Data Flow Integration', () => {
    test('should process data through the complete pipeline', () => {
      const configPath = createTestConfig();
      const config = loadConfig({ configPath, useEnvVars: false, applyDefaults: true });
      
      // Step 1: Mock network logs (simulating browser controller output)
      const mockLogs = createMockNetworkLogs();
      
      // Step 2: Process data (data processor)
      const dataProcessor = createDataProcessor({
        mergeDuplicates: true,
        prioritizeBffApis: true,
        maxApis: 50
      });
      
      const processResult = dataProcessor.processNetworkLogs(mockLogs);
      
      expect(processResult.success).toBe(true);
      expect(processResult.uniqueEndpoints).toBeGreaterThan(0);
      expect(processResult.bffApiCount).toBeGreaterThan(0);
      
      // Step 3: Serialize for AI
      const serializedData = dataProcessor.serializeForAI(processResult.processedData);
      
      expect(typeof serializedData).toBe('string');
      expect(serializedData.length).toBeGreaterThan(0);
      
      // Verify it's valid JSON
      const parsedData = JSON.parse(serializedData);
      expect(Array.isArray(parsedData)).toBe(true);
      expect(parsedData.length).toBeGreaterThan(0);
      
      // Step 4: AI generator integration (without actual API call)
      const aiGenerator = createAiGenerator(config);
      const promptData = aiGenerator.createPromptData(processResult.processedData);
      
      expect(promptData.prompt).toContain('api.example.com');
      expect(promptData.apiData).toEqual(processResult.processedData);
    });

    test('should handle empty data flow gracefully', () => {
      const configPath = createTestConfig();
      const config = loadConfig({ configPath, useEnvVars: false, applyDefaults: true });
      
      // Empty network logs
      const emptyLogs: NetworkLogCollection = [];
      
      const dataProcessor = createDataProcessor();
      const processResult = dataProcessor.processNetworkLogs(emptyLogs);
      
      expect(processResult.success).toBe(true);
      expect(processResult.uniqueEndpoints).toBe(0);
      expect(processResult.processedData).toEqual([]);
      
      const serializedData = dataProcessor.serializeForAI(processResult.processedData);
      expect(serializedData).toBe('[]');
    });

    test('should maintain data integrity through pipeline', () => {
      const mockLogs = createMockNetworkLogs();
      
      const dataProcessor = createDataProcessor({ mergeDuplicates: false });
      const processResult = dataProcessor.processNetworkLogs(mockLogs);
      
      // Verify original data is preserved
      expect(processResult.processedData).toHaveLength(2);
      
      const firstApi = processResult.processedData[0];
      expect(firstApi?.method).toBe('GET');
      expect(firstApi?.url).toContain('blocks?keys=home.banner');
      expect(firstApi?.responseBody).toContain('home.banner');
      
      const secondApi = processResult.processedData[1];
      expect(secondApi?.method).toBe('GET');
      expect(secondApi?.url).toContain('users?page=1');
      expect(secondApi?.responseBody).toContain('John');
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle configuration errors gracefully', () => {
      // Test with completely invalid config path
      expect(() => {
        loadConfig({
          configPath: '/completely/invalid/path.yaml',
          useEnvVars: false,
          applyDefaults: false
        });
      }).toThrow();
      
      // Test with safe loading
      const config = loadConfig({
        configPath: '/completely/invalid/path.yaml',
        useEnvVars: false,
        applyDefaults: true
      });
      
      expect(config).toBeDefined();
    });

    test('should handle data processing errors', () => {
      const invalidLog = {
        id: 'invalid',
        request: {
          method: 'INVALID',
          url: 'not-a-url',
          headers: {},
          timestamp: Date.now()
        },
        response: {
          status: 500,
          statusText: 'Error',
          headers: {},
          body: 'invalid json {',
          contentType: 'text/plain',
          timestamp: Date.now()
        },
        resourceType: 'unknown',
        isBffBlockApi: false
      };
      
      const dataProcessor = createDataProcessor();
      const result = dataProcessor.processNetworkLogs([invalidLog]);
      
      expect(result.success).toBe(true); // Should handle gracefully
      expect(result.processedData).toHaveLength(1);
    });

    test('should handle AI generator errors', () => {
      const configPath = createTestConfig();
      const config = loadConfig({ configPath, useEnvVars: false, applyDefaults: true });
      
      // Test with invalid prompt template path
      config.ai.prompt_template_path = '/invalid/template.txt';
      
      const aiGenerator = createAiGenerator(config);
      const promptData = aiGenerator.createPromptData([]);
      
      expect(promptData.prompt).toContain('Error loading template');
      expect(promptData.apiData).toEqual([]);
    });
  });

  describe('File Operations Integration', () => {
    test('should handle file creation and validation', () => {
      const testFilePath = path.join(testOutputDir, 'integration_test.json');
      
      const testCollection = {
        info: {
          name: 'Integration Test Collection',
          _postman_id: '12345',
          description: 'Test collection for integration',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        item: [],
        variable: []
      };
      
      // Write file
      const formattedJson = JSON.stringify(testCollection, null, 2);
      fs.writeFileSync(testFilePath, formattedJson, 'utf8');
      
      // Verify file exists and content is correct
      expect(fs.existsSync(testFilePath)).toBe(true);
      
      const fileContent = fs.readFileSync(testFilePath, 'utf8');
      const parsedContent = JSON.parse(fileContent);
      
      expect(parsedContent.info.name).toBe('Integration Test Collection');
      expect(parsedContent).toHaveProperty('item');
      expect(parsedContent).toHaveProperty('variable');
      
      // Clean up
      fs.unlinkSync(testFilePath);
    });

    test('should handle file operation errors', () => {
      const invalidPath = '/invalid/directory/file.json';
      
      expect(() => {
        fs.writeFileSync(invalidPath, '{}', 'utf8');
      }).toThrow();
    });
  });

  describe('CLI Class Integration', () => {
    test('should instantiate CLI class successfully', () => {
      const cli = new MockGenCLI();
      expect(cli).toBeDefined();
      expect(typeof cli.run).toBe('function');
    });

    test('should have all required methods', () => {
      const cli = new MockGenCLI();
      const methods = Object.getOwnPropertyNames(MockGenCLI.prototype);
      
      expect(methods).toContain('run');
      expect(methods.length).toBeGreaterThan(1); // Should have private methods too
    });
  });

  describe('Performance and Memory', () => {
    test('should handle reasonable data volumes', () => {
      // Create larger dataset
      const largeLogs: NetworkLogCollection = [];
      for (let i = 0; i < 100; i++) {
        largeLogs.push({
          id: `log_${i}`,
          request: {
            method: 'GET',
            url: `https://api.example.com/v1/endpoint${i}?param=${i}`,
            headers: { 'content-type': 'application/json' },
            timestamp: Date.now()
          },
          response: {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' },
            body: `{"data": "response_${i}", "id": ${i}}`,
            contentType: 'application/json',
            timestamp: Date.now()
          },
          resourceType: 'fetch',
          isBffBlockApi: i % 3 === 0 // Every 3rd is BFF
        });
      }
      
      const startTime = Date.now();
      const dataProcessor = createDataProcessor();
      const result = dataProcessor.processNetworkLogs(largeLogs);
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(result.totalLogs).toBe(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle memory efficiently with large datasets', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process data
      const largeLogs = createMockNetworkLogs();
      const dataProcessor = createDataProcessor();
      const result = dataProcessor.processNetworkLogs(largeLogs);
      const serialized = dataProcessor.serializeForAI(result.processedData);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB for small dataset)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('End-to-End Workflow Simulation', () => {
    test('should simulate complete workflow without external dependencies', () => {
      const configPath = createTestConfig();
      
      // Step 1: Load configuration
      const config = loadConfig({ configPath, useEnvVars: false, applyDefaults: true });
      expect(config).toBeDefined();
      
      // Step 2: Create modules
      const browserController = createBrowserController(config);
      const dataProcessor = createDataProcessor({
        mergeDuplicates: true,
        prioritizeBffApis: true,
        maxApis: 50
      });
      const aiGenerator = createAiGenerator(config);
      
      expect(browserController).toBeDefined();
      expect(dataProcessor).toBeDefined();
      expect(aiGenerator).toBeDefined();
      
      // Step 3: Simulate network capture (mock data)
      const mockLogs = createMockNetworkLogs();
      
      // Step 4: Process data
      const processResult = dataProcessor.processNetworkLogs(mockLogs);
      expect(processResult.success).toBe(true);
      
      // Step 5: Serialize for AI
      const serializedData = dataProcessor.serializeForAI(processResult.processedData);
      expect(serializedData).toBeDefined();
      
      // Step 6: Generate prompt (without API call)
      const promptData = aiGenerator.createPromptData(processResult.processedData);
      expect(promptData.prompt).toContain('api.example.com');
      
      // Step 7: Simulate file save
      const outputPath = path.join(testOutputDir, 'workflow_test.json');
      const mockCollection = {
        info: { name: 'Test', _postman_id: '123', description: 'Test', schema: 'v2.1.0' },
        item: [],
        variable: []
      };
      
      fs.writeFileSync(outputPath, JSON.stringify(mockCollection, null, 2));
      expect(fs.existsSync(outputPath)).toBe(true);
      
      // Clean up
      fs.unlinkSync(outputPath);
    });
  });
});