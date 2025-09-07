/**
 * MockGen AI - Browser Controller Module
 * 
 * This module handles Playwright-based browser automation and network request capture.
 * It opens a browser in non-headless mode, navigates to specified URLs, captures network
 * requests with filtering, and provides user interaction capabilities.
 */

import { chromium, Browser, BrowserContext, Page, Response } from 'playwright';
import * as readline from 'readline';
import { 
  NetworkLogEntry, 
  NetworkRequest, 
  NetworkResponse, 
  NetworkLogCollection,
  AppConfig,
  ErrorCategory,
  AppError 
} from '../types/index';
import * as console from "node:console";

// ============================================================================
// Browser Controller Configuration
// ============================================================================

/**
 * Browser controller options
 */
export interface BrowserControllerOptions {
  /** Application configuration */
  config: AppConfig;
  /** Whether to show browser UI (default: true for user interaction) */
  headless?: boolean;
  /** Browser viewport settings */
  viewport?: {
    width: number;
    height: number;
  };
  /** Timeout settings in milliseconds */
  timeout?: {
    navigation: number;
    response: number;
  };
}

/**
 * Network capture result
 */
export interface NetworkCaptureResult {
  /** Whether capture was successful */
  success: boolean;
  /** Captured network log entries */
  logs: NetworkLogCollection;
  /** Total number of requests captured */
  totalRequests: number;
  /** Number of filtered requests */
  filteredRequests: number;
  /** Error message if capture failed */
  error?: string;
}

// ============================================================================
// Browser Controller Class
// ============================================================================

/**
 * Browser Controller for network request capture
 */
export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private capturedLogs: NetworkLogEntry[] = [];
  private isCapturing: boolean = false;
  private logCounter: number = 0;

  constructor(private options: BrowserControllerOptions) {
    // Set default options
    this.options = {
      headless: false,
      viewport: { width: 1280, height: 720 },
      timeout: { navigation: 30000, response: 10000 },
      ...options
    };
  }

  /**
   * Creates a structured application error
   */
  private createBrowserError(code: string, message: string, details?: string, originalError?: Error): AppError {
    const error: AppError = {
      category: ErrorCategory.BROWSER,
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
   * Initializes the browser instance
   */
  private async initializeBrowser(): Promise<void> {
    try {
      console.log('🚀 Initializing browser...');
      
      // Launch Chromium browser
      this.browser = await chromium.launch({
        headless: this.options.headless ?? false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      // Create browser context
      this.context = await this.browser.newContext({
        viewport: this.options.viewport ?? { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Create new page
      this.page = await this.context.newPage();

      // Set navigation timeout
      this.page.setDefaultNavigationTimeout(this.options.timeout!.navigation);
      this.page.setDefaultTimeout(this.options.timeout!.response);

      console.log('✅ Browser initialized successfully');
    } catch (error) {
      throw this.createBrowserError(
        'BROWSER_INIT_ERROR',
        'Failed to initialize browser',
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a hostname is allowed based on configuration
   */
  private isHostAllowed(url: string): boolean {
    const allowedHosts = this.options.config.filter.allowed_hosts;
    
    // If no allowed hosts specified, allow all
    if (allowedHosts.length === 0) {
      return true;
    }

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      return allowedHosts.some(allowedHost => {
        // Exact match or subdomain match
        return hostname === allowedHost || hostname.endsWith('.' + allowedHost);
      });
    } catch (error) {
      // Invalid URL, reject
      return false;
    }
  }

  /**
   * Checks if a response should be captured based on content type and resource type
   */
  private shouldCaptureResponse(response: Response): boolean {
    try {
      // Check if host is allowed
      if (!this.isHostAllowed(response.url())) {
        return false;
      }

      // Get content type
      const contentType = response.headers()['content-type'] || '';
      
      // Only capture JSON responses
      if (!contentType.includes('application/json')) {
        return false;
      }

      // Check resource type (should be fetch or xhr)
      const request = response.request();
      const resourceType = request.resourceType();
      
      if (resourceType !== 'fetch' && resourceType !== 'xhr') {
        return false;
      }

      // Check HTTP method (capture common API methods)
      const method = request.method().toUpperCase();
      const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      
      if (!allowedMethods.includes(method)) {
        return false;
      }

      return true;
    } catch (error) {
      console.warn('⚠️ Error checking response capture criteria:', error);
      return false;
    }
  }

  /**
   * Processes a network response and creates a log entry
   */
  private async processNetworkResponse(response: Response): Promise<NetworkLogEntry | null> {
    try {
      if (!this.shouldCaptureResponse(response)) {
        return null;
      }

      const request = response.request();
      const url = response.url();
      
      // Extract request data
      const postData = request.postData();
      const networkRequest: NetworkRequest = {
        method: request.method(),
        url: url,
        headers: request.headers(),
        timestamp: Date.now()
      };
      
      // Only add body if postData exists
      if (postData) {
        networkRequest.body = postData;
      }

      // Extract response data
      let responseBody = '';
      try {
        responseBody = await response.text();
      } catch (error) {
        console.warn('⚠️ Could not read response body for:', url);
        responseBody = '';
      }

      const networkResponse: NetworkResponse = {
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        body: responseBody,
        contentType: response.headers()['content-type'] || '',
        timestamp: Date.now()
      };

      // Check if this looks like a BFF block API
      const isBffBlockApi = this.isBffBlockApiPattern(url);

      // Create log entry
      const logEntry: NetworkLogEntry = {
        id: `log_${++this.logCounter}_${Date.now()}`,
        request: networkRequest,
        response: networkResponse,
        resourceType: request.resourceType(),
        isBffBlockApi
      };

      return logEntry;
    } catch (error) {
      console.warn('⚠️ Error processing network response:', error);
      return null;
    }
  }

  /**
   * Checks if a URL matches BFF block API pattern
   */
  private isBffBlockApiPattern(url: string): boolean {
    try {
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
   * Sets up network request capture
   */
  private setupNetworkCapture(): void {
    if (!this.page) {
      throw this.createBrowserError('PAGE_NOT_INITIALIZED', 'Page not initialized');
    }

    console.log('🔍 Setting up network capture...');

    // Register response listener
    this.page.on('response', async (response: Response) => {
      if (!this.isCapturing) {
        return;
      }

      try {
        const logEntry = await this.processNetworkResponse(response);
        if (logEntry) {
          this.capturedLogs.push(logEntry);
          console.log(`📡 Captured: ${logEntry.request.method} ${logEntry.request.url}`);
        }
      } catch (error) {
        console.warn('⚠️ Error in response handler:', error);
      }
    });

    console.log('✅ Network capture setup complete');
  }

  /**
   * Navigates to the specified URL
   */
  private async navigateToUrl(url: string): Promise<void> {
    if (!this.page) {
      throw this.createBrowserError('PAGE_NOT_INITIALIZED', 'Page not initialized');
    }

    try {
      console.log(`🌐 Navigating to: ${url}`);
      
      // Validate URL format
      new URL(url); // This will throw if URL is invalid
      
      await this.page.goto(url, {
        waitUntil: 'commit', timeout: 60000
      });
      
      console.log('✅ Navigation complete');
    } catch (error) {
      throw this.createBrowserError(
        'NAVIGATION_ERROR',
        `Failed to navigate to URL: ${url}`,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Waits for user to press Enter key
   */
  private async waitForUserInput(): Promise<void> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('\n🎯 Browser is ready for interaction!');
      console.log('📋 Instructions:');
      console.log('   1. Use the browser to navigate and interact with the website');
      console.log('   2. Perform any actions that trigger API calls (login, search, etc.)');
      console.log('   3. When finished, return to this terminal and press Enter');
      console.log('\n⏳ Press Enter when you have completed all interactions...');

      rl.question('', () => {
        rl.close();
        console.log('✅ User input received, stopping capture...');
        resolve();
      });
    });
  }

  /**
   * Starts network capture for the specified URL
   */
  public async captureNetworkLogs(url: string): Promise<NetworkCaptureResult> {
    try {
      // Reset state
      this.capturedLogs = [];
      this.logCounter = 0;
      this.isCapturing = false;

      // Initialize browser
      await this.initializeBrowser();

      // Setup network capture
      this.setupNetworkCapture();

      // Navigate to URL
      await this.navigateToUrl(url);

      // Start capturing
      this.isCapturing = true;
      console.log('🎬 Network capture started');

      // Wait for user interaction
      await this.waitForUserInput();

      // Stop capturing
      this.isCapturing = false;
      console.log('🛑 Network capture stopped');

      // Return results
      const result: NetworkCaptureResult = {
        success: true,
        logs: [...this.capturedLogs],
        totalRequests: this.capturedLogs.length,
        filteredRequests: this.capturedLogs.filter(log => log.isBffBlockApi).length
      };

      console.log(`📊 Capture complete: ${result.totalRequests} total, ${result.filteredRequests} BFF APIs`);
      
      return result;
    } catch (error) {
      const errorMessage: string = error instanceof Error ? error.message : String(error);
      console.error('❌ Network capture failed:', errorMessage);
      
      return {
        success: false,
        logs: [],
        totalRequests: 0,
        filteredRequests: 0,
        error: errorMessage
      };
    } finally {
      // Always cleanup resources
      await this.cleanup();
    }
  }

  /**
   * Cleans up browser resources
   */
  public async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up browser resources...');
      
      this.isCapturing = false;
      
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      console.log('✅ Browser cleanup complete');
    } catch (error) {
      console.warn('⚠️ Error during cleanup:', error);
    }
  }

  /**
   * Gets the current capture status
   */
  public getStatus(): {
    isCapturing: boolean;
    capturedCount: number;
    browserInitialized: boolean;
  } {
    return {
      isCapturing: this.isCapturing,
      capturedCount: this.capturedLogs.length,
      browserInitialized: this.browser !== null
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a browser controller instance with the given configuration
 */
export function createBrowserController(config: AppConfig, options?: Partial<BrowserControllerOptions>): BrowserController {
  const controllerOptions: BrowserControllerOptions = {
    config,
    headless: false, // Always non-headless for user interaction
    ...options
  };
  
  return new BrowserController(controllerOptions);
}

/**
 * Extracts unique URLs from network log collection
 */
export function extractUniqueUrls(logs: NetworkLogCollection): string[] {
  const urls = new Set<string>();
  
  logs.forEach(log => {
    urls.add(log.request.url);
  });
  
  return Array.from(urls).sort();
}

/**
 * Filters logs by BFF block API pattern
 */
export function filterBffBlockApis(logs: NetworkLogCollection): NetworkLogCollection {
  return logs.filter(log => log.isBffBlockApi);
}

/**
 * Groups logs by hostname
 */
export function groupLogsByHostname(logs: NetworkLogCollection): Record<string, NetworkLogCollection> {
  const groups: Record<string, NetworkLogCollection> = {};
  
  logs.forEach(log => {
    try {
      const url = new URL(log.request.url);
      const hostname = url.hostname;
      
      if (!groups[hostname]) {
        groups[hostname] = [];
      }
      
      groups[hostname].push(log);
    } catch (error) {
      // Skip invalid URLs
    }
  });
  
  return groups;
}