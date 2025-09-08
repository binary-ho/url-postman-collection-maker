/**
 * MockGen AI - AI Generator Module
 * 
 * This module handles AI prompt generation and Postman Collection creation using Gemini API.
 * It loads prompt templates, processes data replacement, and generates valid JSON collections.
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  ProcessedApiCollection,
  AiPromptData,
  AiResponseValidation,
  AiGenerationResult,
  AppConfig,
  ErrorCategory,
  AppError,
  PostmanCollection,
  isPostmanCollection
} from '../types/index';
import * as console from "node:console";

// ============================================================================
// AI Generator Configuration
// ============================================================================

/**
 * AI generation options
 */
export interface AiGenerationOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to validate JSON response strictly */
  strictValidation?: boolean;
}

/**
 * Prompt processing result
 */
export interface PromptProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  /** Processed prompt text */
  prompt?: string;
  /** Template variables used */
  templateVars?: Record<string, string>;
  /** Error message if processing failed */
  error?: string;
}

// ============================================================================
// AI Generator Class
// ============================================================================

/**
 * AI Generator for Postman Collection creation
 */
export class AiGenerator {
  private genAI: GoogleGenerativeAI | null = null;
  private options: Required<AiGenerationOptions>;

  constructor(
    private config: AppConfig,
    options: AiGenerationOptions = {}
  ) {
    // Set default options
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      strictValidation: true,
      ...options
    };

    // Initialize Gemini AI if API key is available
    if (this.config.ai.api_key) {
      this.genAI = new GoogleGenerativeAI(this.config.ai.api_key);
    }
  }

  /**
   * Creates a structured application error
   */
  private createAiError(code: string, message: string, details?: string, originalError?: Error): AppError {
    const error: AppError = {
      category: ErrorCategory.AI_API,
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
   * Loads prompt template from file
   */
  private loadPromptTemplate(): string {
    try {
      const templatePath = path.resolve(this.config.ai.prompt_template_path);
      
      if (!fs.existsSync(templatePath)) {
        throw this.createAiError(
          'PROMPT_TEMPLATE_NOT_FOUND',
          `Prompt template file not found: ${this.config.ai.prompt_template_path}`,
          `Please ensure the prompt template file exists at: ${templatePath}`
        );
      }

      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      if (!templateContent.trim()) {
        throw this.createAiError(
          'EMPTY_PROMPT_TEMPLATE',
          `Prompt template file is empty: ${this.config.ai.prompt_template_path}`,
          'The prompt template file exists but contains no content.'
        );
      }

      return templateContent;
    } catch (error) {
      if (error instanceof Error && 'category' in error) {
        // Re-throw AppError as-is
        throw error;
      }
      
      throw this.createAiError(
        'PROMPT_TEMPLATE_READ_ERROR',
        `Failed to read prompt template file: ${this.config.ai.prompt_template_path}`,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Processes prompt template with data replacement
   */
  private processPromptTemplate(template: string, apiData: ProcessedApiCollection): PromptProcessingResult {
    try {
      // Serialize API data for template replacement
      const serializedData = JSON.stringify(apiData, null, 2);
      
      // Create template variables
      const templateVars: Record<string, string> = {
        DATA: serializedData,
        TIMESTAMP: new Date().toISOString(),
        API_COUNT: apiData.length.toString(),
        MODEL_NAME: this.config.ai.model_name
      };

      // Replace template variables
      let processedPrompt = template;
      Object.entries(templateVars).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        processedPrompt = processedPrompt.replace(new RegExp(placeholder, 'g'), value);
      });

      // Validate that all placeholders were replaced
      const remainingPlaceholders = processedPrompt.match(/\{\{[^}]+\}\}/g);
      if (remainingPlaceholders && remainingPlaceholders.length > 0) {
        console.warn(`⚠️ Unresolved placeholders found: ${remainingPlaceholders.join(', ')}`);
      }

      return {
        success: true,
        prompt: processedPrompt,
        templateVars
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validates AI response as valid JSON
   */
  private validateAiResponse(response: string): AiResponseValidation {
    try {
      // Clean the response - remove any markdown formatting
      let cleanedResponse = response.trim();
      
      // Remove markdown code blocks if present
      cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '');
      cleanedResponse = cleanedResponse.replace(/\s*```$/i, '');
      cleanedResponse = cleanedResponse.trim();

      // Try to parse as JSON
      const parsedData = JSON.parse(cleanedResponse);
      
      // Additional validation for Postman Collection structure if strict validation is enabled
      if (this.options.strictValidation) {
        if (!isPostmanCollection(parsedData)) {
          return {
            isValid: false,
            error: 'Response is valid JSON but does not match Postman Collection v2.1.0 schema'
          };
        }
      }

      return {
        isValid: true,
        data: parsedData
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Invalid JSON response: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Makes API call to Gemini with retry logic
   */
  private async callGeminiApi(prompt: string, retryCount: number = 0): Promise<string> {
    if (!this.genAI) {
      throw this.createAiError(
        'GEMINI_NOT_INITIALIZED',
        'Gemini AI is not initialized',
        'Please check that a valid API key is provided in the configuration'
      );
    }

    try {
      console.log(`🤖 Calling Gemini API (attempt ${retryCount + 1}/${this.options.maxRetries + 1})...`);
      
      const model = this.genAI.getGenerativeModel({ model: this.config.ai.model_name });
      
      // Create generation config
      const generationConfig = {
        temperature: 0.1, // Low temperature for consistent JSON output
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 8192,
      };

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      });

      const response = result.response;
      const text = response.text();

      if (!text || text.trim().length === 0) {
        throw this.createAiError(
          'EMPTY_AI_RESPONSE',
          'Gemini API returned empty response',
          'The AI model did not generate any content'
        );
      }

      console.log(`✅ Gemini API call successful (${text.length} characters)`);
      return text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Gemini API call failed (attempt ${retryCount + 1}): ${errorMessage}`);
      
      // Retry logic
      if (retryCount < this.options.maxRetries) {
        console.log(`⏳ Retrying in ${this.options.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
        return this.callGeminiApi(prompt, retryCount + 1);
      }
      
      // Max retries exceeded
      throw this.createAiError(
        'GEMINI_API_ERROR',
        `Gemini API call failed after ${this.options.maxRetries + 1} attempts`,
        errorMessage,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generates Postman Collection from processed API data
   */
  public async generatePostmanCollection(apiData: ProcessedApiCollection): Promise<AiGenerationResult> {
    const startTime = Date.now();
    let retryCount = 0;

    try {
      console.log(`🚀 Starting Postman Collection generation for ${apiData.length} APIs...`);
      
      if (apiData.length === 0) {
        return {
          success: false,
          error: 'No API data provided for collection generation',
          retryCount: 0
        };
      }

      // Step 1: Load prompt template
      console.log('📋 Loading prompt template...');
      const template = this.loadPromptTemplate();
      console.log(`✅ Prompt template loaded (${template.length} characters)`);

      // Step 2: Process template with data
      console.log('🔄 Processing prompt template with API data...');
      const promptResult = this.processPromptTemplate(template, apiData);
      
      if (!promptResult.success || !promptResult.prompt) {
        return {
          success: false,
          error: `Prompt processing failed: ${promptResult.error}`,
          retryCount: 0
        };
      }
      
      console.log(`✅ Prompt processed (${promptResult.prompt.length} characters)`);

      // Step 3: Call Gemini API
      const aiResponse = await this.callGeminiApi(promptResult.prompt);

      // Step 4: Validate response
      console.log(`🔍 Validating AI response... ${aiResponse}`);
      const validation = this.validateAiResponse(aiResponse);

      if (!validation.isValid) {
        console.error('❌ AI response validation failed:', validation.error);
        return {
          success: false,
          error: `AI response validation failed: ${validation.error}`,
          retryCount: retryCount
        };
      }

      console.log('✅ AI response validation passed');
      
      // Step 5: Return successful result
      const duration = Date.now() - startTime;
      console.log(`🎉 Postman Collection generation completed in ${duration}ms`);
      
      return {
        success: true,
        collectionJson: JSON.stringify(validation.data, null, 2),
        retryCount: retryCount
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Postman Collection generation failed:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        retryCount: retryCount
      };
    }
  }

  /**
   * Creates prompt data structure for debugging/inspection
   */
  public createPromptData(apiData: ProcessedApiCollection): AiPromptData {
    try {
      const template = this.loadPromptTemplate();
      const promptResult = this.processPromptTemplate(template, apiData);
      
      return {
        prompt: promptResult.prompt || template,
        apiData: apiData,
        templateVars: promptResult.templateVars || {}
      };
    } catch (error) {
      // Return basic structure even if template loading fails
      return {
        prompt: `Error loading template: ${error instanceof Error ? error.message : String(error)}`,
        apiData: apiData,
        templateVars: {}
      };
    }
  }

  /**
   * Tests the AI generator with sample data
   */
  public async testGeneration(sampleApiData: ProcessedApiCollection): Promise<{
    templateLoading: boolean;
    dataReplacement: boolean;
    apiConnection: boolean;
    jsonValidation: boolean;
    overallSuccess: boolean;
  }> {
    const results = {
      templateLoading: false,
      dataReplacement: false,
      apiConnection: false,
      jsonValidation: false,
      overallSuccess: false
    };

    try {
      // Test 1: Template loading
      try {
        this.loadPromptTemplate();
        results.templateLoading = true;
        console.log('✅ Template loading test passed');
      } catch (error) {
        console.log('❌ Template loading test failed:', error);
      }

      // Test 2: Data replacement
      try {
        const template = this.loadPromptTemplate();
        const promptResult = this.processPromptTemplate(template, sampleApiData);
        results.dataReplacement = promptResult.success;
        console.log(`${results.dataReplacement ? '✅' : '❌'} Data replacement test ${results.dataReplacement ? 'passed' : 'failed'}`);
      } catch (error) {
        console.log('❌ Data replacement test failed:', error);
      }

      // Test 3: API connection (with minimal data to avoid costs)
      if (this.genAI && sampleApiData.length > 0) {
        try {
          const minimalData = sampleApiData.slice(0, 1); // Use only first API for testing
          const result = await this.generatePostmanCollection(minimalData);
          results.apiConnection = result.success;
          results.jsonValidation = result.success; // If generation succeeded, JSON validation also passed
          console.log(`${results.apiConnection ? '✅' : '❌'} API connection test ${results.apiConnection ? 'passed' : 'failed'}`);
          console.log(`${results.jsonValidation ? '✅' : '❌'} JSON validation test ${results.jsonValidation ? 'passed' : 'failed'}`);
        } catch (error) {
          console.log('❌ API connection test failed:', error);
        }
      } else {
        console.log('⚠️ Skipping API connection test (no API key or sample data)');
      }

      results.overallSuccess = results.templateLoading && results.dataReplacement;
      return results;
    } catch (error) {
      console.error('❌ Test generation failed:', error);
      return results;
    }
  }

  /**
   * Gets the current generator status
   */
  public getStatus(): {
    isInitialized: boolean;
    hasApiKey: boolean;
    modelName: string;
    promptTemplatePath: string;
    maxRetries: number;
  } {
    return {
      isInitialized: this.genAI !== null,
      hasApiKey: !!this.config.ai.api_key,
      modelName: this.config.ai.model_name,
      promptTemplatePath: this.config.ai.prompt_template_path,
      maxRetries: this.options.maxRetries
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates an AI generator instance with the given configuration
 */
export function createAiGenerator(config: AppConfig, options?: AiGenerationOptions): AiGenerator {
  return new AiGenerator(config, options);
}

/**
 * Quick generation function for simple use cases
 */
export async function generatePostmanCollection(
  apiData: ProcessedApiCollection,
  config: AppConfig,
  options?: AiGenerationOptions
): Promise<AiGenerationResult> {
  const generator = createAiGenerator(config, options);
  return generator.generatePostmanCollection(apiData);
}

/**
 * Validates if a string is a valid Postman Collection JSON
 */
export function validatePostmanCollectionJson(jsonString: string): AiResponseValidation {
  try {
    const parsed = JSON.parse(jsonString);
    
    if (!isPostmanCollection(parsed)) {
      return {
        isValid: false,
        error: 'JSON is valid but does not match Postman Collection v2.1.0 schema'
      };
    }
    
    return {
      isValid: true,
      data: parsed
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Extracts collection statistics from generated JSON
 */
export function getCollectionStats(collectionJson: string): {
  totalItems: number;
  totalResponses: number;
  totalVariables: number;
  collectionName: string;
} {
  try {
    const collection: PostmanCollection = JSON.parse(collectionJson);
    
    const totalResponses = collection.item.reduce((sum, item) => {
      return sum + (item.response ? item.response.length : 0);
    }, 0);
    
    return {
      totalItems: collection.item.length,
      totalResponses,
      totalVariables: collection.variable.length,
      collectionName: collection.info.name
    };
  } catch (error) {
    return {
      totalItems: 0,
      totalResponses: 0,
      totalVariables: 0,
      collectionName: 'Unknown'
    };
  }
}