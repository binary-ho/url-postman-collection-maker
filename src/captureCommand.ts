#!/usr/bin/env ts-node

/**
 * MockGen AI - Network Capture & Documentation Command
 * 
 * This is the CLI handler for network capture and documentation generation
 * without AI. It orchestrates modules to provide network log collection
 * and structured API documentation:
 * 1. Get URL input from user via gum
 * 2. Load configuration
 * 3. Capture network logs using browser controller
 * 4. Let user select specific URLs to process
 * 5. Process data using data processor
 * 6. Generate API documentation using document generator
 * 7. Save the result to file
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createBrowserController, extractUniqueUrls } from './modules/browserController';
import { createDataProcessor } from './modules/dataProcessor';
import { createDocumentGenerator } from './modules/documentGenerator';
import { 
  AppConfig, 
  NetworkLogCollection, 
  ErrorCategory, 
  AppError 
} from '@/types';
import {loadConfigSafe} from "@/config";

// ============================================================================
// CLI Application Class
// ============================================================================

/**
 * Main CLI application class for network capture and documentation
 */
export class NetworkCaptureCLI {
  private config: AppConfig | null = null;

  constructor() {
    console.log('📡 MockGen AI - Network Capture & Documentation');
    console.log('   Capture network logs and generate API documentation without AI\n');
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

      // Step 6: Get documentation format preference
      const format = await this.getDocumentationFormat();

      // Step 7: Generate API documentation
      const filepath = await this.generateDocumentation(processedData, format);

      // Success message
      console.log('🎉 Network capture and documentation completed successfully!');
      console.log(`📋 Your API documentation is ready at: ${filepath}`);
      console.log('💡 You can now review the captured API information and use it for development.\n');

    } catch (error) {
      this.displayError(error as AppError);
      process.exit(1);
    }
  }

  /**
   * Gets URL input from user using gum or from environment variable
   */
  private async getUserUrl(): Promise<string> {
    try {
      // Load .env file first to ensure environment variables are available
      const envPath = path.resolve('.env');
      if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
      }
      
      // Check if default URL is set in environment variable
      const defaultUrl = process.env['MOCKGEN_DEFAULT_URL'];
      
      if (defaultUrl && defaultUrl.trim()) {
        const url = defaultUrl.trim();
        
        // Validate the default URL
        try {
          new URL(url);
        } catch {
          throw this.createCliError('INVALID_DEFAULT_URL', `Invalid default URL format: ${url}`, 'Please provide a valid HTTP or HTTPS URL in MOCKGEN_DEFAULT_URL environment variable');
        }
        
        console.log('🔗 Using default URL from environment variable:');
        console.log(`✅ URL: ${url}\n`);
        return url;
      }
      
      // No default URL set, prompt user for input
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
      
      // Add "Select All URLs" option at the top
      const selectAllOption = '🌐 Select All URLs (Process all captured URLs)';
      const urlOptions = [selectAllOption].concat(
        uniqueUrls.map((url, index) => {
          try {
            const urlObj = new URL(url);
            return `${index + 1}. ${urlObj.pathname}${urlObj.search} (${urlObj.hostname})`;
          } catch {
            return `${index + 1}. ${url}`;
          }
        })
      );
      
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
        
        // Check if "Select All URLs" option was selected
        const selectAllSelected = selectedOptions.some(option => option.includes('🌐 Select All URLs'));
        
        if (selectAllSelected) {
          console.log(`✅ Selected all URLs for processing (${uniqueUrls.length} URLs, ${logs.length} total requests)\n`);
          return logs;
        }
        
        // Extract selected URLs based on user choice (individual selection)
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
      console.log(`📊 Generated ${serializedData.length} characters of structured data\n`);
      
      return serializedData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generates API documentation from processed data
   */
  private async generateDocumentation(processedDataString: string, format: 'markdown' | 'json' | 'html' = 'markdown'): Promise<string> {
    try {
      console.log('📝 Generating API documentation...');
      
      // Parse the processed data back to ProcessedApiCollection
      const processedData = JSON.parse(processedDataString);
      
      // Determine output file extension based on format
      const extensions = { markdown: 'md', json: 'json', html: 'html' };
      const extension = extensions[format];

      // 로컬 시간 YYMMDD_HHMMSS
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(2, 15).replace('T', '_');
      const outputPath = `./api_documentation_${timestamp}.${extension}`;
      
      const documentGenerator = createDocumentGenerator({
        format,
        includeExamples: true,
        includeBffAnalysis: true,
        maxExamples: 3,
        outputPath
      });
      
      const result = await documentGenerator.generateDocumentation(processedData);
      
      if (!result.success) {
        throw this.createCliError('DOCUMENTATION_FAILED', 'Documentation generation failed', result.error);
      }
      
      console.log(`✅ API documentation generated successfully`);
      console.log(`📄 Format: ${format.toUpperCase()}`);
      console.log(`📊 Stats: ${result.stats?.totalEndpoints} endpoints, ${result.stats?.bffApiCount} BFF APIs\n`);
      
      return result.filePath || outputPath;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets documentation format from user
   */
  private async getDocumentationFormat(): Promise<'markdown' | 'json' | 'html'> {
    try {
      console.log('📋 Please select documentation format:');
      
      const formats = [
        '📝 Markdown (.md) - Human-readable documentation',
        '📊 JSON (.json) - Structured data format',
        '🌐 HTML (.html) - Web-viewable documentation'
      ];
      
      const tempFile = path.join(process.cwd(), '.temp_formats.txt');
      fs.writeFileSync(tempFile, formats.join('\n'));
      
      try {
        const result = execSync(`gum choose < "${tempFile}"`, {
          encoding: 'utf8',
          stdio: ['inherit', 'pipe', 'inherit']
        });
        
        const selectedFormat = result.trim();
        
        if (selectedFormat.includes('Markdown')) {
          return 'markdown';
        } else if (selectedFormat.includes('JSON')) {
          return 'json';
        } else if (selectedFormat.includes('HTML')) {
          return 'html';
        } else {
          // Default to markdown
          return 'markdown';
        }
      } finally {
        // Clean up temporary file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Command failed')) {
        console.log('⚠️ Format selection cancelled. Using Markdown format...\n');
        return 'markdown';
      }
      throw error;
    }
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
}

// ============================================================================
// Main Execution
// ============================================================================

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const cli = new NetworkCaptureCLI();
  await cli.run();
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}