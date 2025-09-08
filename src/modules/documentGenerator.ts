/**
 * Document Generator Module
 * 
 * This module generates API documentation from processed network logs
 * without using AI. It creates structured documentation in various formats
 * including Markdown, JSON, and HTML.
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  ProcessedApiCollection,
  ProcessedApiData,
  ErrorCategory,
  AppError 
} from '../types/index';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Document generation options
 */
export interface DocumentGenerationOptions {
  /** Output format for the documentation */
  format: 'markdown' | 'json' | 'html';
  /** Include request/response examples */
  includeExamples: boolean;
  /** Include BFF API analysis */
  includeBffAnalysis: boolean;
  /** Maximum number of examples per endpoint */
  maxExamples: number;
  /** Output file path */
  outputPath: string;
}

/**
 * Document generation result
 */
export interface DocumentGenerationResult {
  /** Whether the generation was successful */
  success: boolean;
  /** Generated document content */
  content?: string;
  /** Output file path */
  filePath?: string;
  /** Error message if failed */
  error?: string;
  /** Generation statistics */
  stats?: DocumentStats;
}

/**
 * Document generation statistics
 */
export interface DocumentStats {
  /** Total number of endpoints documented */
  totalEndpoints: number;
  /** Number of BFF block APIs */
  bffApiCount: number;
  /** Number of regular APIs */
  regularApiCount: number;
  /** Unique hosts found */
  uniqueHosts: string[];
  /** HTTP methods used */
  httpMethods: string[];
  /** Document size in characters */
  documentSize: number;
}

// ============================================================================
// Document Generator Class
// ============================================================================

/**
 * Main document generator class
 */
export class DocumentGenerator {
  private options: DocumentGenerationOptions;

  constructor(options: Partial<DocumentGenerationOptions> = {}) {
    this.options = {
      format: 'markdown',
      includeExamples: true,
      includeBffAnalysis: true,
      maxExamples: 3,
      outputPath: './api_documentation.md',
      ...options
    };
  }

  /**
   * Creates a structured application error
   */
  private createDocumentError(code: string, message: string, details?: string, originalError?: Error): AppError {
    const error: AppError = {
      category: ErrorCategory.VALIDATION,
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
   * Generates documentation from processed API data
   */
  public async generateDocumentation(processedData: ProcessedApiCollection): Promise<DocumentGenerationResult> {
    try {
      console.log(`📝 Generating ${this.options.format.toUpperCase()} documentation for ${processedData.length} APIs...`);
      
      if (processedData.length === 0) {
        return {
          success: false,
          error: 'No API data provided for documentation generation'
        };
      }

      let content: string;
      
      switch (this.options.format) {
        case 'markdown':
          content = this.generateMarkdownDocumentation(processedData);
          break;
        case 'json':
          content = this.generateJsonDocumentation(processedData);
          break;
        case 'html':
          content = this.generateHtmlDocumentation(processedData);
          break;
        default:
          throw this.createDocumentError(
            'INVALID_FORMAT',
            `Unsupported documentation format: ${this.options.format}`
          );
      }

      // Save to file
      const filePath = path.resolve(this.options.outputPath);
      fs.writeFileSync(filePath, content, 'utf8');

      // Generate statistics
      const stats = this.generateStats(processedData, content);

      console.log(`✅ Documentation generated successfully`);
      console.log(`📁 File: ${filePath}`);
      console.log(`📊 Stats: ${stats.totalEndpoints} endpoints, ${stats.bffApiCount} BFF APIs`);

      return {
        success: true,
        content,
        filePath,
        stats
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Documentation generation failed:', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Checks if an API is a BFF block API based on URL pattern
   */
  private isBffBlockApi(api: ProcessedApiData): boolean {
    try {
      const url = new URL(api.url);
      const pathname = url.pathname;
      const searchParams = url.searchParams;
      
      // Check for /blocks path and keys= query parameter
      return pathname.includes('/blocks') && searchParams.has('keys');
    } catch (error) {
      return false;
    }
  }

  /**
   * Generates Markdown documentation
   */
  private generateMarkdownDocumentation(processedData: ProcessedApiCollection): string {
    const lines: string[] = [];
    
    // Header
    lines.push('# API Documentation');
    lines.push('');
    lines.push(`Generated on: ${new Date().toISOString()}`);
    lines.push(`Total Endpoints: ${processedData.length}`);
    lines.push('');

    // Statistics
    const stats = this.generateStats(processedData, '');
    lines.push('## Overview');
    lines.push('');
    lines.push(`- **Total Endpoints**: ${stats.totalEndpoints}`);
    lines.push(`- **BFF Block APIs**: ${stats.bffApiCount}`);
    lines.push(`- **Regular APIs**: ${stats.regularApiCount}`);
    lines.push(`- **Unique Hosts**: ${stats.uniqueHosts.join(', ')}`);
    lines.push(`- **HTTP Methods**: ${stats.httpMethods.join(', ')}`);
    lines.push('');

    // BFF APIs Section
    if (this.options.includeBffAnalysis) {
      const bffApis = processedData.filter(api => this.isBffBlockApi(api));
      if (bffApis.length > 0) {
        lines.push('## BFF Block APIs');
        lines.push('');
        lines.push('These APIs follow the Backend for Frontend (BFF) block pattern:');
        lines.push('');
        
        bffApis.forEach(api => {
          lines.push(`### ${api.method} ${api.url}`);
          lines.push('');
          lines.push(`**Type**: BFF Block API`);
          lines.push(`**Host**: ${this.extractHostFromUrl(api.url)}`);
          
          if (api.queryParams && Object.keys(api.queryParams).length > 0) {
            lines.push('');
            lines.push('**Query Parameters**:');
            Object.entries(api.queryParams).forEach(([key, value]) => {
              lines.push(`- \`${key}\`: ${value}`);
            });
          }
          
          if (this.options.includeExamples && api.responseBody) {
            lines.push('');
            lines.push('**Response Example**:');
            lines.push('```json');
            lines.push(this.formatJsonForDisplay(api.responseBody));
            lines.push('```');
          }
          
          lines.push('');
          lines.push('---');
          lines.push('');
        });
      }
    }

    // Regular APIs Section
    const regularApis = processedData.filter(api => !this.isBffBlockApi(api));
    if (regularApis.length > 0) {
      lines.push('## Regular APIs');
      lines.push('');
      
      // Group by HTTP method
      const methodGroups = this.groupByMethod(regularApis);
      
      Object.entries(methodGroups).forEach(([method, apis]) => {
        lines.push(`### ${method} Endpoints`);
        lines.push('');
        
        apis.forEach(api => {
          lines.push(`#### ${api.method} ${api.url}`);
          lines.push('');
          lines.push(`**Host**: ${this.extractHostFromUrl(api.url)}`);
          
          if (api.queryParams && Object.keys(api.queryParams).length > 0) {
            lines.push('');
            lines.push('**Query Parameters**:');
            Object.entries(api.queryParams).forEach(([key, value]) => {
              lines.push(`- \`${key}\`: ${value}`);
            });
          }
          
          if (this.options.includeExamples && api.responseBody) {
            lines.push('');
            lines.push('**Response Example**:');
            lines.push('```json');
            lines.push(this.formatJsonForDisplay(api.responseBody));
            lines.push('```');
          }
          
          lines.push('');
        });
        
        lines.push('---');
        lines.push('');
      });
    }

    // Footer
    lines.push('## Generated by MockGen AI');
    lines.push('');
    lines.push('This documentation was automatically generated from browser network logs.');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generates JSON documentation
   */
  private generateJsonDocumentation(processedData: ProcessedApiCollection): string {
    const doc = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalEndpoints: processedData.length,
        generator: 'MockGen AI Document Generator'
      },
      statistics: this.generateStats(processedData, ''),
      apis: processedData.map(api => ({
        method: api.method,
        url: api.url,
        host: this.extractHostFromUrl(api.url),
        isBffBlockApi: this.isBffBlockApi(api),
        queryParams: api.queryParams,
        pathParams: api.pathParams,
        responseBody: this.options.includeExamples ? api.responseBody : undefined
      }))
    };

    return JSON.stringify(doc, null, 2);
  }

  /**
   * Generates HTML documentation
   */
  private generateHtmlDocumentation(processedData: ProcessedApiCollection): string {
    const stats = this.generateStats(processedData, '');
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Documentation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
        .stats { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .endpoint { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; padding: 20px; }
        .method { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: white; }
        .get { background: #28a745; }
        .post { background: #007bff; }
        .put { background: #ffc107; color: black; }
        .delete { background: #dc3545; }
        .bff-badge { background: #6f42c1; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .param { background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    </style>
</head>
<body>
    <div class="header">
        <h1>API Documentation</h1>
        <p>Generated on: ${new Date().toISOString()}</p>
    </div>
    
    <div class="stats">
        <h2>Overview</h2>
        <ul>
            <li><strong>Total Endpoints:</strong> ${stats.totalEndpoints}</li>
            <li><strong>BFF Block APIs:</strong> ${stats.bffApiCount}</li>
            <li><strong>Regular APIs:</strong> ${stats.regularApiCount}</li>
            <li><strong>Unique Hosts:</strong> ${stats.uniqueHosts.join(', ')}</li>
            <li><strong>HTTP Methods:</strong> ${stats.httpMethods.join(', ')}</li>
        </ul>
    </div>
    
    <h2>API Endpoints</h2>
    ${processedData.map(api => `
        <div class="endpoint">
            <h3>
                <span class="method ${api.method.toLowerCase()}">${api.method}</span>
                ${api.url}
                ${this.isBffBlockApi(api) ? '<span class="bff-badge">BFF</span>' : ''}
            </h3>
            <p><strong>Host:</strong> ${this.extractHostFromUrl(api.url)}</p>
            
            ${api.queryParams && Object.keys(api.queryParams).length > 0 ? `
                <h4>Query Parameters</h4>
                <ul>
                    ${Object.entries(api.queryParams).map(([key, value]) => 
                        `<li><span class="param">${key}</span>: ${value}</li>`
                    ).join('')}
                </ul>
            ` : ''}
            
            ${this.options.includeExamples && api.responseBody ? `
                <h4>Response Example</h4>
                <pre><code>${this.escapeHtml(this.formatJsonForDisplay(api.responseBody))}</code></pre>
            ` : ''}
        </div>
    `).join('')}
    
    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666;">
        <p>Generated by MockGen AI Document Generator</p>
    </footer>
</body>
</html>`;

    return html;
  }

  /**
   * Generates documentation statistics
   */
  private generateStats(processedData: ProcessedApiCollection, content: string): DocumentStats {
    const bffApis = processedData.filter(api => this.isBffBlockApi(api));
    const uniqueHosts = [...new Set(processedData.map(api => this.extractHostFromUrl(api.url)))];
    const httpMethods = [...new Set(processedData.map(api => api.method))];

    return {
      totalEndpoints: processedData.length,
      bffApiCount: bffApis.length,
      regularApiCount: processedData.length - bffApis.length,
      uniqueHosts,
      httpMethods,
      documentSize: content.length
    };
  }

  /**
   * Groups APIs by HTTP method
   */
  private groupByMethod(apis: ProcessedApiCollection): Record<string, ProcessedApiCollection> {
    return apis.reduce((groups, api) => {
      const method = api.method;
      if (!groups[method]) {
        groups[method] = [];
      }
      groups[method].push(api);
      return groups;
    }, {} as Record<string, ProcessedApiCollection>);
  }

  /**
   * Extracts hostname from URL
   */
  private extractHostFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      // If URL parsing fails, try to extract host from the string
      const match = url.match(/https?:\/\/([^\/]+)/);
      return match && match[1] ? match[1] : 'unknown';
    }
  }

  /**
   * Formats JSON for display with proper indentation
   */
  private formatJsonForDisplay(jsonString: string): string {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  }

  /**
   * Escapes HTML characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a document generator instance
 */
export function createDocumentGenerator(options?: Partial<DocumentGenerationOptions>): DocumentGenerator {
  return new DocumentGenerator(options);
}

/**
 * Generates documentation from processed API data
 */
export async function generateDocumentation(
  processedData: ProcessedApiCollection,
  options?: Partial<DocumentGenerationOptions>
): Promise<DocumentGenerationResult> {
  const generator = createDocumentGenerator(options);
  return generator.generateDocumentation(processedData);
}