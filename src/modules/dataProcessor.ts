/**
 * MockGen AI - Data Processor Module
 * 
 * This module handles processing of raw network logs captured by the browser controller.
 * It extracts and structures API data for AI consumption, with special focus on BFF block APIs.
 */

import { 
  NetworkLogEntry, 
  NetworkLogCollection, 
  ProcessedApiData, 
  ProcessedApiCollection,
  ErrorCategory,
  AppError 
} from '../types/index';

// ============================================================================
// Data Processing Configuration
// ============================================================================

/**
 * Data processing options
 */
export interface DataProcessingOptions {
  /** Whether to merge duplicate endpoints */
  mergeDuplicates?: boolean;
  /** Whether to prioritize BFF block APIs */
  prioritizeBffApis?: boolean;
  /** Maximum number of APIs to process */
  maxApis?: number;
  /** Whether to include request headers in output */
  includeHeaders?: boolean;
}

/**
 * Data processing result
 */
export interface DataProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  /** Processed API data collection */
  processedData: ProcessedApiCollection;
  /** Total number of logs processed */
  totalLogs: number;
  /** Number of BFF APIs identified */
  bffApiCount: number;
  /** Number of unique endpoints after merging */
  uniqueEndpoints: number;
  /** Error message if processing failed */
  error?: string;
}

/**
 * Endpoint merge information
 */
interface EndpointMergeInfo {
  /** Base endpoint key for grouping */
  endpointKey: string;
  /** All logs for this endpoint */
  logs: NetworkLogEntry[];
  /** Whether this is a BFF block API */
  isBffBlockApi: boolean;
}

// ============================================================================
// Data Processor Class
// ============================================================================

/**
 * Data Processor for network log processing and structuring
 */
export class DataProcessor {
  private options: Required<DataProcessingOptions>;

  constructor(options: DataProcessingOptions = {}) {
    // Set default options
    this.options = {
      mergeDuplicates: true,
      prioritizeBffApis: true,
      maxApis: 50,
      includeHeaders: false,
      ...options
    };
  }

  /**
   * Creates a structured application error
   */
  private createProcessingError(code: string, message: string, details?: string, originalError?: Error): AppError {
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
   * Checks if a network log entry represents a BFF block API
   */
  private isBffBlockApiPattern(logEntry: NetworkLogEntry): boolean {
    try {
      const url = logEntry.request.url;
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const searchParams = urlObj.searchParams;
      
      // Check for /blocks path and keys= query parameter
      return pathname.includes('/blocks') && searchParams.has('keys');
    } catch (error) {
      return false;
    }
  }

  /**
   * Extracts query parameters from URL
   */
  private extractQueryParams(url: string): Record<string, string> {
    try {
      const urlObj = new URL(url);
      const params: Record<string, string> = {};
      
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      
      return params;
    } catch (error) {
      return {};
    }
  }

  /**
   * Extracts path parameters from URL (placeholder for future enhancement)
   */
  private extractPathParams(_url: string): Record<string, string> {
    // For now, return empty object
    // This could be enhanced to detect path parameters like /users/{id}
    return {};
  }

  /**
   * Creates an endpoint key for grouping similar requests
   */
  private createEndpointKey(logEntry: NetworkLogEntry): string {
    try {
      const url = logEntry.request.url;
      const urlObj = new URL(url);
      const method = logEntry.request.method.toUpperCase();
      
      // Create key from method + hostname + pathname (without query params)
      return `${method} ${urlObj.hostname}${urlObj.pathname}`;
    } catch (error) {
      // Fallback to full URL if parsing fails
      return `${logEntry.request.method} ${logEntry.request.url}`;
    }
  }

  /**
   * Groups network logs by endpoint for merging
   */
  private groupLogsByEndpoint(logs: NetworkLogCollection): Map<string, EndpointMergeInfo> {
    const endpointGroups = new Map<string, EndpointMergeInfo>();
    
    logs.forEach(log => {
      const endpointKey = this.createEndpointKey(log);
      const isBffBlockApi = this.isBffBlockApiPattern(log);
      
      if (endpointGroups.has(endpointKey)) {
        const existing = endpointGroups.get(endpointKey)!;
        existing.logs.push(log);
        // If any log in the group is BFF, mark the whole group as BFF
        existing.isBffBlockApi = existing.isBffBlockApi || isBffBlockApi;
      } else {
        endpointGroups.set(endpointKey, {
          endpointKey,
          logs: [log],
          isBffBlockApi
        });
      }
    });
    
    return endpointGroups;
  }

  /**
   * Merges multiple logs for the same endpoint into a single processed API data
   */
  private mergeEndpointLogs(mergeInfo: EndpointMergeInfo): ProcessedApiData {
    const { logs } = mergeInfo;
    
    if (logs.length === 0) {
      throw this.createProcessingError('EMPTY_LOGS', 'Cannot merge empty logs array');
    }
    
    // Use the first log as the base
    const baseLog = logs[0]!;
    
    // Try to find the most complete response body
    let bestResponseBody = baseLog.response.body;
    let bestLog = baseLog;
    
    // Look for the response with the most content
    logs.forEach(log => {
      if (log.response.body.length > bestResponseBody.length) {
        bestResponseBody = log.response.body;
        bestLog = log;
      }
    });
    
    // Extract data from the best log
    const processedData: ProcessedApiData = {
      method: bestLog.request.method.toUpperCase(),
      url: bestLog.request.url,
      responseBody: bestResponseBody,
      queryParams: this.extractQueryParams(bestLog.request.url),
      pathParams: this.extractPathParams(bestLog.request.url)
    };
    
    return processedData;
  }

  /**
   * Processes a single network log entry into processed API data
   */
  private processLogEntry(logEntry: NetworkLogEntry): ProcessedApiData {
    const processedData: ProcessedApiData = {
      method: logEntry.request.method.toUpperCase(),
      url: logEntry.request.url,
      responseBody: logEntry.response.body,
      queryParams: this.extractQueryParams(logEntry.request.url),
      pathParams: this.extractPathParams(logEntry.request.url)
    };
    
    return processedData;
  }

  /**
   * Filters and prioritizes logs based on processing options
   */
  private filterAndPrioritizeLogs(logs: NetworkLogCollection): NetworkLogCollection {
    let filteredLogs = [...logs];
    
    // If prioritizing BFF APIs, sort them first
    if (this.options.prioritizeBffApis) {
      filteredLogs.sort((a, b) => {
        const aIsBff = this.isBffBlockApiPattern(a);
        const bIsBff = this.isBffBlockApiPattern(b);
        
        if (aIsBff && !bIsBff) return -1;
        if (!aIsBff && bIsBff) return 1;
        return 0;
      });
    }
    
    // Limit the number of APIs if specified
    if (this.options.maxApis > 0) {
      filteredLogs = filteredLogs.slice(0, this.options.maxApis);
    }
    
    return filteredLogs;
  }

  /**
   * Main processing function to convert network logs to processed API data
   */
  public processNetworkLogs(logs: NetworkLogCollection): DataProcessingResult {
    try {
      console.log(`🔄 Processing ${logs.length} network logs...`);
      
      if (logs.length === 0) {
        return {
          success: true,
          processedData: [],
          totalLogs: 0,
          bffApiCount: 0,
          uniqueEndpoints: 0
        };
      }
      
      // Filter and prioritize logs
      const filteredLogs = this.filterAndPrioritizeLogs(logs);
      console.log(`📋 Filtered to ${filteredLogs.length} logs for processing`);
      
      let processedData: ProcessedApiCollection = [];
      let bffApiCount = 0;
      
      if (this.options.mergeDuplicates) {
        // Group logs by endpoint and merge duplicates
        const endpointGroups = this.groupLogsByEndpoint(filteredLogs);
        console.log(`🔗 Grouped into ${endpointGroups.size} unique endpoints`);
        
        endpointGroups.forEach(mergeInfo => {
          const processed = this.mergeEndpointLogs(mergeInfo);
          processedData.push(processed);
          
          if (mergeInfo.isBffBlockApi) {
            bffApiCount++;
          }
        });
      } else {
        // Process each log individually
        filteredLogs.forEach(log => {
          const processed = this.processLogEntry(log);
          processedData.push(processed);
          
          if (this.isBffBlockApiPattern(log)) {
            bffApiCount++;
          }
        });
      }
      
      console.log(`✅ Processing complete: ${processedData.length} APIs, ${bffApiCount} BFF APIs`);
      
      return {
        success: true,
        processedData,
        totalLogs: logs.length,
        bffApiCount,
        uniqueEndpoints: processedData.length
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Data processing failed:', errorMessage);
      
      return {
        success: false,
        processedData: [],
        totalLogs: logs.length,
        bffApiCount: 0,
        uniqueEndpoints: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Serializes processed data to JSON string for AI consumption
   */
  public serializeForAI(processedData: ProcessedApiCollection): string {
    try {
      // Create a clean structure for AI consumption
      const aiData = processedData.map(api => ({
        method: api.method,
        url: api.url,
        responseBody: api.responseBody,
        queryParams: api.queryParams,
        pathParams: api.pathParams
      }));
      
      return JSON.stringify(aiData, null, 2);
    } catch (error) {
      throw this.createProcessingError(
        'SERIALIZATION_ERROR',
        'Failed to serialize processed data for AI consumption',
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Filters processed data to only include BFF block APIs
   */
  public filterBffBlockApis(logs: NetworkLogCollection): NetworkLogCollection {
    return logs.filter(log => this.isBffBlockApiPattern(log));
  }

  /**
   * Gets processing statistics
   */
  public getProcessingStats(result: DataProcessingResult): {
    totalProcessed: number;
    bffApiPercentage: number;
    compressionRatio: number;
    averageResponseSize: number;
  } {
    const totalProcessed = result.uniqueEndpoints;
    const bffApiPercentage = totalProcessed > 0 ? (result.bffApiCount / totalProcessed) * 100 : 0;
    const compressionRatio = result.totalLogs > 0 ? result.totalLogs / totalProcessed : 1;
    
    const averageResponseSize = result.processedData.length > 0 
      ? result.processedData.reduce((sum, api) => sum + api.responseBody.length, 0) / result.processedData.length
      : 0;
    
    return {
      totalProcessed,
      bffApiPercentage: Math.round(bffApiPercentage * 100) / 100,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      averageResponseSize: Math.round(averageResponseSize)
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a data processor instance with the given options
 */
export function createDataProcessor(options?: DataProcessingOptions): DataProcessor {
  return new DataProcessor(options);
}

/**
 * Quick processing function for simple use cases
 */
export function processNetworkLogs(
  logs: NetworkLogCollection, 
  options?: DataProcessingOptions
): DataProcessingResult {
  const processor = createDataProcessor(options);
  return processor.processNetworkLogs(logs);
}

/**
 * Quick serialization function for AI consumption
 */
export function serializeForAI(processedData: ProcessedApiCollection): string {
  const processor = createDataProcessor();
  return processor.serializeForAI(processedData);
}

/**
 * Extracts unique API endpoints from processed data
 */
export function extractUniqueEndpoints(processedData: ProcessedApiCollection): string[] {
  const endpoints = new Set<string>();
  
  processedData.forEach(api => {
    try {
      const urlObj = new URL(api.url);
      const endpoint = `${api.method} ${urlObj.pathname}`;
      endpoints.add(endpoint);
    } catch (error) {
      // Fallback to full URL if parsing fails
      endpoints.add(`${api.method} ${api.url}`);
    }
  });
  
  return Array.from(endpoints).sort();
}

/**
 * Groups processed data by HTTP method
 */
export function groupByMethod(processedData: ProcessedApiCollection): Record<string, ProcessedApiCollection> {
  const groups: Record<string, ProcessedApiCollection> = {};
  
  processedData.forEach(api => {
    const method = api.method.toUpperCase();
    if (!groups[method]) {
      groups[method] = [];
    }
    groups[method].push(api);
  });
  
  return groups;
}