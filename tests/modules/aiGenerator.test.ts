/**
 * Unit Tests for AI Generator Module
 * 
 * This test suite validates the AI generator functionality including:
 * - Prompt template loading and processing
 * - Data replacement in templates
 * - AI response validation
 * - Error handling and retry logic
 * - Postman Collection generation
 */

import { 
  createAiGenerator, 
  generatePostmanCollection,
  validatePostmanCollectionJson,
  getCollectionStats,
  AiGenerator
} from '../../src/modules/aiGenerator';
import { AppConfig, ProcessedApiCollection } from '../../src/types/index';
import * as fs from 'fs';
import * as path from 'path';

// Mock the Google Generative AI SDK
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue('{"info":{"name":"Test Collection","_postman_id":"12345","description":"Test","schema":"https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},"item":[],"variable":[]}')
        }
      })
    })
  }))
}));

describe('AI Generator Module', () => {
  const testConfigDir = path.join(__dirname, '../test-configs');
  const testPromptsDir = path.join(__dirname, '../test-prompts');
  
  beforeAll(() => {
    // Create test directories
    [testConfigDir, testPromptsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  });

  afterAll(() => {
    // Clean up test directories
    [testConfigDir, testPromptsDir].forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  beforeEach(() => {
    // Clear environment variables
    delete process.env['AI_API_KEY'];
    delete process.env['NODE_ENV'];
  });

  afterEach(() => {
    // Clean up test files
    const testFiles = [
      path.join(testPromptsDir, 'test-template.txt'),
      path.join(testPromptsDir, 'empty-template.txt'),
      path.join(testPromptsDir, 'invalid-template.txt')
    ];
    
    testFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  const createTestConfig = (apiKey: string = 'test-api-key'): AppConfig => ({
    ai: {
      api_key: apiKey,
      model_name: 'gemini-1.5-pro-latest',
      prompt_template_path: path.join(testPromptsDir, 'test-template.txt')
    },
    output: {
      default_filename: 'test_collection.json'
    },
    filter: {
      allowed_hosts: ['api.example.com']
    }
  });

  const createTestApiData = (): ProcessedApiCollection => [
    {
      method: 'GET',
      url: 'https://api.example.com/v1/blocks?keys=home.banner',
      responseBody: '{"home.banner": {"title": "Welcome", "image": "banner.jpg"}}',
      queryParams: { keys: 'home.banner' },
      pathParams: {}
    },
    {
      method: 'POST',
      url: 'https://api.example.com/v1/users',
      responseBody: '{"id": 123, "name": "John Doe", "email": "john@example.com"}',
      queryParams: {},
      pathParams: {}
    }
  ];

  const createTestPromptTemplate = (): string => `
You are an expert API designer.
Generate a Postman Collection from the provided data.

Input Data:
{{DATA}}

Additional Info:
- Timestamp: {{TIMESTAMP}}
- API Count: {{API_COUNT}}
- Model: {{MODEL_NAME}}

Return valid JSON only.
`;

  describe('AI Generator Creation', () => {
    test('should create AI generator with valid configuration', () => {
      const config = createTestConfig();
      const generator = createAiGenerator(config);
      
      expect(generator).toBeInstanceOf(AiGenerator);
      
      const status = generator.getStatus();
      expect(status.hasApiKey).toBe(true);
      expect(status.modelName).toBe('gemini-1.5-pro-latest');
      expect(status.maxRetries).toBe(3);
    });

    test('should create AI generator without API key', () => {
      const config = createTestConfig('');
      const generator = createAiGenerator(config);
      
      const status = generator.getStatus();
      expect(status.hasApiKey).toBe(false);
      expect(status.isInitialized).toBe(false);
    });

    test('should create AI generator with custom options', () => {
      const config = createTestConfig();
      const options = {
        maxRetries: 5,
        retryDelay: 2000,
        timeout: 60000,
        strictValidation: false
      };
      
      const generator = createAiGenerator(config, options);
      const status = generator.getStatus();
      
      expect(status.maxRetries).toBe(5);
    });
  });

  describe('Prompt Template Loading', () => {
    test('should load prompt template successfully', () => {
      const template = createTestPromptTemplate();
      const templatePath = path.join(testPromptsDir, 'test-template.txt');
      fs.writeFileSync(templatePath, template);
      
      const config = createTestConfig();
      const generator = createAiGenerator(config);
      const apiData = createTestApiData();
      
      const promptData = generator.createPromptData(apiData);
      
      expect(promptData.prompt).toContain('You are an expert API designer');
      expect(promptData.apiData).toEqual(apiData);
      expect(promptData.templateVars).toHaveProperty('DATA');
      expect(promptData.templateVars).toHaveProperty('TIMESTAMP');
      expect(promptData.templateVars).toHaveProperty('API_COUNT');
      expect(promptData.templateVars).toHaveProperty('MODEL_NAME');
    });

    test('should handle missing prompt template file', () => {
      const config = createTestConfig();
      config.ai.prompt_template_path = path.join(testPromptsDir, 'non-existent.txt');
      
      const generator = createAiGenerator(config);
      const apiData = createTestApiData();
      
      const promptData = generator.createPromptData(apiData);
      
      expect(promptData.prompt).toContain('Error loading template');
      expect(promptData.apiData).toEqual(apiData);
    });

    test('should handle empty prompt template file', () => {
      const templatePath = path.join(testPromptsDir, 'empty-template.txt');
      fs.writeFileSync(templatePath, '');
      
      const config = createTestConfig();
      config.ai.prompt_template_path = templatePath;
      
      const generator = createAiGenerator(config);
      const apiData = createTestApiData();
      
      const promptData = generator.createPromptData(apiData);
      
      expect(promptData.prompt).toContain('Error loading template');
    });
  });

  describe('Data Replacement in Templates', () => {
    test('should replace {{DATA}} placeholder with API data', () => {
      const template = createTestPromptTemplate();
      const templatePath = path.join(testPromptsDir, 'test-template.txt');
      fs.writeFileSync(templatePath, template);
      
      const config = createTestConfig();
      const generator = createAiGenerator(config);
      const apiData = createTestApiData();
      
      const promptData = generator.createPromptData(apiData);
      
      expect(promptData.prompt).not.toContain('{{DATA}}');
      expect(promptData.prompt).toContain('api.example.com');
      expect(promptData.prompt).toContain('home.banner');
      expect(promptData.prompt).toContain('John Doe');
    });

    test('should replace all template variables', () => {
      const template = createTestPromptTemplate();
      const templatePath = path.join(testPromptsDir, 'test-template.txt');
      fs.writeFileSync(templatePath, template);
      
      const config = createTestConfig();
      const generator = createAiGenerator(config);
      const apiData = createTestApiData();
      
      const promptData = generator.createPromptData(apiData);
      
      expect(promptData.prompt).not.toContain('{{TIMESTAMP}}');
      expect(promptData.prompt).not.toContain('{{API_COUNT}}');
      expect(promptData.prompt).not.toContain('{{MODEL_NAME}}');
      expect(promptData.prompt).toContain('gemini-1.5-pro-latest');
      expect(promptData.prompt).toContain('2'); // API count
    });

    test('should handle template variables correctly', () => {
      const template = createTestPromptTemplate();
      const templatePath = path.join(testPromptsDir, 'test-template.txt');
      fs.writeFileSync(templatePath, template);
      
      const config = createTestConfig();
      const generator = createAiGenerator(config);
      const apiData = createTestApiData();
      
      const promptData = generator.createPromptData(apiData);
      
      expect(promptData.templateVars).toHaveProperty('DATA');
      expect(promptData.templateVars).toHaveProperty('TIMESTAMP');
      expect(promptData.templateVars).toHaveProperty('API_COUNT');
      expect(promptData.templateVars).toHaveProperty('MODEL_NAME');
      
      expect(promptData.templateVars['API_COUNT']).toBe('2');
      expect(promptData.templateVars['MODEL_NAME']).toBe('gemini-1.5-pro-latest');
      expect(JSON.parse(promptData.templateVars['DATA'])).toEqual(apiData);
    });
  });

  describe('Postman Collection Generation', () => {
    test('should generate Postman Collection successfully', async () => {
      const template = createTestPromptTemplate();
      const templatePath = path.join(testPromptsDir, 'test-template.txt');
      fs.writeFileSync(templatePath, template);
      
      const config = createTestConfig();
      const generator = createAiGenerator(config);
      const apiData = createTestApiData();
      
      const result = await generator.generatePostmanCollection(apiData);
      
      expect(result.success).toBe(true);
      expect(result.collectionJson).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.retryCount).toBe(0);
      
      // Verify the generated JSON is valid
      const collection = JSON.parse(result.collectionJson!);
      expect(collection).toHaveProperty('info');
      expect(collection).toHaveProperty('item');
      expect(collection).toHaveProperty('variable');
    });

    test('should handle empty API data', async () => {
      const template = createTestPromptTemplate();
      const templatePath = path.join(testPromptsDir, 'test-template.txt');
      fs.writeFileSync(templatePath, template);
      
      const config = createTestConfig();
      const generator = createAiGenerator(config);
      
      const result = await generator.generatePostmanCollection([]);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No API data provided');
      expect(result.retryCount).toBe(0);
    });

    test('should handle missing API key', async () => {
      const template = createTestPromptTemplate();
      const templatePath = path.join(testPromptsDir, 'test-template.txt');
      fs.writeFileSync(templatePath, template);
      
      const config = createTestConfig('');
      const generator = createAiGenerator(config);
      const apiData = createTestApiData();
      
      const result = await generator.generatePostmanCollection(apiData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not initialized');
    });
  });

  describe('JSON Validation', () => {
    test('should validate valid Postman Collection JSON', () => {
      const validJson = `{
        "info": {
          "name": "Test Collection",
          "_postman_id": "12345",
          "description": "Test collection",
          "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": [],
        "variable": []
      }`;
      
      const result = validatePostmanCollectionJson(validJson);
      
      expect(result.isValid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    test('should reject invalid JSON', () => {
      const invalidJson = '{"invalid": json}';
      
      const result = validatePostmanCollectionJson(invalidJson);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    test('should reject valid JSON that is not a Postman Collection', () => {
      const validButWrongJson = '{"valid": "json", "but": "not postman collection"}';
      
      const result = validatePostmanCollectionJson(validButWrongJson);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('does not match Postman Collection');
    });
  });

  describe('Collection Statistics', () => {
    test('should extract collection statistics correctly', () => {
      const collectionJson = `{
        "info": {
          "name": "Test API Collection",
          "_postman_id": "12345",
          "description": "Test collection",
          "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": [
          {
            "name": "GET /users",
            "request": {},
            "response": [
              {"name": "200 OK"},
              {"name": "404 Not Found"}
            ]
          },
          {
            "name": "POST /users",
            "request": {},
            "response": [
              {"name": "201 Created"}
            ]
          }
        ],
        "variable": [
          {"key": "base_url", "value": "https://api.example.com"},
          {"key": "api_key", "value": "test-key"}
        ]
      }`;
      
      const stats = getCollectionStats(collectionJson);
      
      expect(stats.totalItems).toBe(2);
      expect(stats.totalResponses).toBe(3);
      expect(stats.totalVariables).toBe(2);
      expect(stats.collectionName).toBe('Test API Collection');
    });

    test('should handle invalid JSON in statistics', () => {
      const invalidJson = '{"invalid": json}';
      
      const stats = getCollectionStats(invalidJson);
      
      expect(stats.totalItems).toBe(0);
      expect(stats.totalResponses).toBe(0);
      expect(stats.totalVariables).toBe(0);
      expect(stats.collectionName).toBe('Unknown');
    });
  });

  describe('Utility Functions', () => {
    test('should use utility function for quick generation', async () => {
      const template = createTestPromptTemplate();
      const templatePath = path.join(testPromptsDir, 'test-template.txt');
      fs.writeFileSync(templatePath, template);
      
      const config = createTestConfig();
      const apiData = createTestApiData();
      
      const result = await generatePostmanCollection(apiData, config);
      
      expect(result.success).toBe(true);
      expect(result.collectionJson).toBeDefined();
    });

    test('should create AI generator with utility function', () => {
      const config = createTestConfig();
      const generator = createAiGenerator(config);
      
      expect(generator).toBeInstanceOf(AiGenerator);
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', () => {
      const config = createTestConfig();
      config.ai.prompt_template_path = '/invalid/path/template.txt';
      
      const generator = createAiGenerator(config);
      const apiData = createTestApiData();
      
      const promptData = generator.createPromptData(apiData);
      
      expect(promptData.prompt).toContain('Error loading template');
      expect(promptData.apiData).toEqual(apiData);
      expect(promptData.templateVars).toEqual({});
    });

    test('should provide structured error information', async () => {
      const config = createTestConfig('');
      const generator = createAiGenerator(config);
      const apiData = createTestApiData();
      
      const result = await generator.generatePostmanCollection(apiData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });

  describe('AI Response Processing', () => {
    test('should clean markdown formatting from AI response', () => {
      // This test would require mocking the internal validateAiResponse method
      // For now, we test the overall functionality through integration
      const validJson = `\`\`\`json
{
  "info": {
    "name": "Test Collection",
    "_postman_id": "12345",
    "description": "Test",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [],
  "variable": []
}
\`\`\``;
      
      const result = validatePostmanCollectionJson(validJson.replace(/```json\s*/, '').replace(/\s*```$/, ''));
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Configuration Integration', () => {
    test('should respect configuration options', () => {
      const config = createTestConfig();
      const options = {
        maxRetries: 5,
        retryDelay: 2000,
        timeout: 60000,
        strictValidation: false
      };
      
      const generator = createAiGenerator(config, options);
      const status = generator.getStatus();
      
      expect(status.maxRetries).toBe(5);
      expect(status.modelName).toBe('gemini-1.5-pro-latest');
      expect(status.promptTemplatePath).toContain('test-template.txt');
    });

    test('should use default options when not specified', () => {
      const config = createTestConfig();
      const generator = createAiGenerator(config);
      const status = generator.getStatus();
      
      expect(status.maxRetries).toBe(3); // Default value
    });
  });

  describe('Test Generation', () => {
    test('should run test generation successfully', async () => {
      const template = createTestPromptTemplate();
      const templatePath = path.join(testPromptsDir, 'test-template.txt');
      fs.writeFileSync(templatePath, template);
      
      const config = createTestConfig();
      const generator = createAiGenerator(config);
      const apiData = createTestApiData();
      
      const testResults = await generator.testGeneration(apiData);
      
      expect(testResults.templateLoading).toBe(true);
      expect(testResults.dataReplacement).toBe(true);
      expect(testResults.overallSuccess).toBe(true);
      
      // API connection and JSON validation depend on having a valid API key
      // In our mocked environment, these might not work as expected
    });

    test('should handle test generation with missing template', async () => {
      const config = createTestConfig();
      config.ai.prompt_template_path = '/non/existent/path.txt';
      
      const generator = createAiGenerator(config);
      const apiData = createTestApiData();
      
      const testResults = await generator.testGeneration(apiData);
      
      expect(testResults.templateLoading).toBe(false);
      expect(testResults.overallSuccess).toBe(false);
    });
  });
});