#!/usr/bin/env ts-node

/**
 * MockGen AI - CLI Main Handler
 * 
 * This is the main entry point for the MockGen AI application.
 * It orchestrates all modules to provide a complete user experience:
 * 1. Get URL input from user via gum
 * 2. Load configuration
 * 3. Capture network logs using browser controller
 * 4. Let user select specific URLs to process
 * 5. Process data using data processor
 * 6. Generate Postman Collection using AI generator
 * 7. Save the result to file
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfigSafe } from './config/index';
import { createBrowserController, extractUniqueUrls } from './modules/browserController';
import { createDataProcessor } from './modules/dataProcessor';
import { createAiGenerator } from './modules/aiGenerator';
import { 
  AppConfig, 
  NetworkLogCollection, 
  ErrorCategory, 
  AppError 
} from './types/index';

// ============================================================================
// CLI Application Class
// ============================================================================

/**
 * Main CLI application class
 */
export class MockGenCLI {
  private config: AppConfig | null = null;

  constructor() {
    console.log('🚀 MockGen AI - Postman Collection Generator');
    console.log('   AI-powered tool to generate collections from browser network logs\n');
  }

  /**
   * Creates a structured application error
   */
  private createCliError(code: string, message: string, details?: string, originalError?: Error): AppError {
    const error: AppError = {
      category: ErrorCategory.USER_INPUT,
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
   * Displays error message with proper formatting
   */
  private displayError(error: AppError | Error | string): void {
    console.error('\n❌ Error occurred:');
    
    if (typeof error === 'string') {
      console.error(`   ${error}`);
    } else if (error instanceof Error && 'category' in error && 'code' in error) {
      const appError = error as unknown as AppError;
      console.error(`   [${appError.code}] ${appError.message}`);
      if (appError.details) {
        console.error(`   Details: ${appError.details}`);
      }
    } else if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
    
    console.error('');
  }

  /**
   * Gets URL input from user using gum
   */
  private async getUserUrl(): Promise<string> {
    try {
      console.log('📝 Please enter the URL you want to analyze:');
      
      const result = execSync('gum input --placeholder "Enter website URL (e.g., https://example.com)..."', {
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'inherit']
      });
      
      const url = result.trim();
      
      if (!url) {
        throw this.createCliError('EMPTY_URL', 'No URL provided');
      }
      
      // Basic URL validation
      try {
        new URL(url);
      } catch {
        throw this.createCliError('INVALID_URL', `Invalid URL format: ${url}`, 'Please provide a valid HTTP or HTTPS URL');
      }
      
      console.log(`✅ URL received: ${url}\n`);
      return url;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Command failed')) {
        throw this.createCliError('GUM_ERROR', 'Failed to get user input', 'Please ensure gum is installed: brew install gum');
      }
      throw error;
    }
  }

  /**
   * Loads application configuration
   */
  private async loadConfiguration(): Promise<void> {
    try {
      console.log('⚙️ Loading configuration...');
      
      this.config = loadConfigSafe({
        configPath: './config.yaml',
        useEnvVars: true,
        applyDefaults: true
      });
      
      if (!this.config) {
        throw this.createCliError('CONFIG_LOAD_FAILED', 'Failed to load configuration', 'Please check your config.yaml file or create one using the sample');
      }
      
      console.log('✅ Configuration loaded successfully');
      console.log(`   AI Model: ${this.config.ai.model_name}`);
      console.log(`   Output File: ${this.config.output.default_filename}`);
      console.log(`   Allowed Hosts: ${this.config.filter.allowed_hosts.length > 0 ? this.config.filter.allowed_hosts.join(', ') : 'All hosts'}\n`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Captures network logs using browser controller
   */
  private async captureNetworkLogs(url: string): Promise<NetworkLogCollection> {
    try {
      console.log('🌐 Starting browser and network capture...');
      
      if (!this.config) {
        throw this.createCliError('NO_CONFIG', 'Configuration not loaded');
      }
      
      const browserController = createBrowserController(this.config);
      const result = await browserController.captureNetworkLogs(url);
      
      if (!result.success) {
        throw this.createCliError('CAPTURE_FAILED', 'Network capture failed', result.error);
      }
      
      console.log(`✅ Network capture completed: ${result.totalRequests} requests captured, ${result.filteredRequests} BFF APIs identified\n`);
      return result.logs;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lets user select specific URLs to process
   */
  private async selectUrlsToProcess(logs: NetworkLogCollection): Promise<NetworkLogCollection> {
    try {
      if (logs.length === 0) {
        console.log('⚠️ No network logs captured. Proceeding with empty data...\n');
        return [];
      }
      
      console.log('🔍 Extracting unique URLs from captured logs...');
      const uniqueUrls = extractUniqueUrls(logs);
      
      if (uniqueUrls.length === 0) {
        console.log('⚠️ No unique URLs found. Proceeding with all logs...\n');
        return logs;
      }
      
      console.log(`📋 Found ${uniqueUrls.length} unique URLs. Please select which ones to process:`);
      
      // Create a temporary file with URLs for gum choose
      const tempFile = path.join(process.cwd(), '.temp_urls.txt');
      const urlOptions = uniqueUrls.map((url, index) => {
        try {
          const urlObj = new URL(url);
          return `${index + 1}. ${urlObj.pathname}${urlObj.search} (${urlObj.hostname})`;
        } catch {
          return `${index + 1}. ${url}`;
        }
      });
      
      fs.writeFileSync(tempFile, urlOptions.join('\n'));
      
      try {
        const result = execSync(`gum choose --no-limit < "${tempFile}"`, {
          encoding: 'utf8',
          stdio: ['inherit', 'pipe', 'inherit']
        });
        
        const selectedOptions = result.trim().split('\n').filter(line => line.trim());
        
        if (selectedOptions.length === 0) {
          console.log('⚠️ No URLs selected. Processing all captured logs...\n');
          return logs;
        }
        
        // Extract selected URLs based on user choice
        const selectedUrls = selectedOptions.map(option => {
          const match = option.match(/^(\d+)\./);
          if (match && match[1]) {
            const index = parseInt(match[1]) - 1;
            return uniqueUrls[index];
          }
          return null;
        }).filter(url => url !== null) as string[];
        
        // Filter logs to only include selected URLs
        const selectedLogs = logs.filter(log => selectedUrls.includes(log.request.url));
        
        console.log(`✅ Selected ${selectedUrls.length} URLs for processing (${selectedLogs.length} total requests)\n`);
        return selectedLogs;
      } finally {
        // Clean up temporary file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Command failed')) {
        console.log('⚠️ URL selection cancelled or failed. Processing all captured logs...\n');
        return logs;
      }
      throw error;
    }
  }

  /**
   * Processes selected logs using data processor
   */
  private async processNetworkData(logs: NetworkLogCollection): Promise<string> {
    try {
      console.log('🔄 Processing network data...');
      
      const dataProcessor = createDataProcessor({
        mergeDuplicates: true,
        prioritizeBffApis: true,
        maxApis: 50
      });
      
      const result = dataProcessor.processNetworkLogs(logs);
      
      if (!result.success) {
        throw this.createCliError('PROCESSING_FAILED', 'Data processing failed', result.error);
      }
      
      console.log(`✅ Data processing completed: ${result.uniqueEndpoints} unique endpoints, ${result.bffApiCount} BFF APIs`);
      
      const serializedData = dataProcessor.serializeForAI(result.processedData);
      console.log(`📊 Generated ${serializedData.length} characters of structured data for AI\n`);
      
      return serializedData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generates Postman Collection using AI
   */
  private async generatePostmanCollection(processedData: string): Promise<string> {
    try {
      console.log('🤖 Generating Postman Collection using AI...');
      
      if (!this.config) {
        throw this.createCliError('NO_CONFIG', 'Configuration not loaded');
      }
      
      // Parse the processed data back to ProcessedApiCollection
      const apiData = JSON.parse(processedData);
      
      const aiGenerator = createAiGenerator(this.config, {
        maxRetries: 3,
        retryDelay: 2000,
        strictValidation: true
      });
      
      const result = await aiGenerator.generatePostmanCollection(apiData);
      
      if (!result.success) {
        throw this.createCliError('AI_GENERATION_FAILED', 'AI generation failed', result.error);
      }
      
      console.log(`✅ Postman Collection generated successfully (${result.retryCount} retries used)`);
      console.log(`📄 Generated collection JSON: ${result.collectionJson?.length || 0} characters\n`);
      
      return result.collectionJson || '{}';
    } catch (error) {
      throw error;
    }
  }

  /**
   * Saves the generated collection to file
   */
  private async saveCollectionToFile(collectionJson: string): Promise<string> {
    try {
      console.log('💾 Saving Postman Collection to file...');
      
      if (!this.config) {
        throw this.createCliError('NO_CONFIG', 'Configuration not loaded');
      }
      
      const filename = this.config.output.default_filename;
      const filepath = path.resolve(filename);
      
      // Ensure the JSON is properly formatted
      const formattedJson = JSON.stringify(JSON.parse(collectionJson), null, 2);
      
      fs.writeFileSync(filepath, formattedJson, 'utf8');
      
      console.log(`✅ Collection saved successfully to: ${filepath}`);
      console.log(`📁 File size: ${fs.statSync(filepath).size} bytes\n`);
      
      return filepath;
    } catch (error) {
      throw this.createCliError('FILE_SAVE_FAILED', 'Failed to save collection to file', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Main application flow
   */
  public async run(): Promise<void> {
    try {
      // Step 1: Get URL from user
      const url = await this.getUserUrl();
      
      // Step 2: Load configuration
      await this.loadConfiguration();
      
      // Step 3: Capture network logs
      const logs = await this.captureNetworkLogs(url);
      
      // Step 4: Let user select URLs to process
      const selectedLogs = await this.selectUrlsToProcess(logs);
      
      // Step 5: Process network data
      const processedData = await this.processNetworkData(selectedLogs);
      
      // Step 6: Generate Postman Collection using AI
      const collectionJson = await this.generatePostmanCollection(processedData);
      
      // Step 7: Save to file
      const filepath = await this.saveCollectionToFile(collectionJson);
      
      // Success message
      console.log('🎉 MockGen AI completed successfully!');
      console.log(`📋 Your Postman Collection is ready at: ${filepath}`);
      console.log('💡 You can now import this collection into Postman to start testing your APIs.\n');
      
    } catch (error) {
      this.displayError(error as AppError);
      process.exit(1);
    }
  }
}

// ============================================================================
// Main Execution
// ============================================================================

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const cli = new MockGenCLI();
  await cli.run();
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}