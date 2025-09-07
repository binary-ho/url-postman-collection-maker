/**
 * Unit Tests for Data Processor Module
 * 
 * This test suite validates the data processing functionality including:
 * - BFF pattern identification
 * - Data processing and structuring
 * - Endpoint merging logic
 * - JSON serialization for AI consumption
 */

import { 
  createDataProcessor, 
  processNetworkLogs, 
  serializeForAI,
  extractUniqueEndpoints,
  groupByMethod
} from '../../src/modules/dataProcessor';
import { NetworkLogEntry, NetworkLogCollection } from '../../src/types/index';

describe('DataProcessor Module', () => {
  // Mock network logs for testing
  const createMockNetworkLogs = (): NetworkLogCollection => {
    return [
      // BFF Block API - home banner
      {
        id: 'log_1',
        request: {
          method: 'GET',
          url: 'https://api.example.com/v1/blocks?keys=home.banner,home.hero',
          headers: { 'content-type': 'application/json' },
          timestamp: Date.now()
        },
        response: {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: '{"home.banner": {"title": "Welcome", "image": "banner.jpg"}, "home.hero": {"text": "Hero content"}}',
          contentType: 'application/json',
          timestamp: Date.now()
        },
        resourceType: 'fetch',
        isBffBlockApi: true
      },
      // BFF Block API - footer links
      {
        id: 'log_2',
        request: {
          method: 'GET',
          url: 'https://api.example.com/v1/blocks?keys=footer.links',
          headers: { 'content-type': 'application/json' },
          timestamp: Date.now()
        },
        response: {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: '{"footer.links": [{"name": "About", "url": "/about"}]}',
          contentType: 'application/json',
          timestamp: Date.now()
        },
        resourceType: 'xhr',
        isBffBlockApi: true
      },
      // Regular API - users
      {
        id: 'log_3',
        request: {
          method: 'GET',
          url: 'https://api.example.com/v1/users?page=1&limit=10',
          headers: { 'content-type': 'application/json' },
          timestamp: Date.now()
        },
        response: {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: '{"users": [{"id": 1, "name": "John"}], "total": 1}',
          contentType: 'application/json',
          timestamp: Date.now()
        },
        resourceType: 'fetch',
        isBffBlockApi: false
      },
      // Regular API - products (POST)
      {
        id: 'log_4',
        request: {
          method: 'POST',
          url: 'https://api.example.com/v1/products',
          headers: { 'content-type': 'application/json' },
          body: '{"name": "New Product", "price": 99.99}',
          timestamp: Date.now()
        },
        response: {
          status: 201,
          statusText: 'Created',
          headers: { 'content-type': 'application/json' },
          body: '{"id": 123, "name": "New Product", "price": 99.99}',
          contentType: 'application/json',
          timestamp: Date.now()
        },
        resourceType: 'fetch',
        isBffBlockApi: false
      },
      // Duplicate endpoint - same as log_3 but different query
      {
        id: 'log_5',
        request: {
          method: 'GET',
          url: 'https://api.example.com/v1/users?page=2&limit=10',
          headers: { 'content-type': 'application/json' },
          timestamp: Date.now()
        },
        response: {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: '{"users": [{"id": 2, "name": "Jane"}], "total": 2, "page": 2}',
          contentType: 'application/json',
          timestamp: Date.now()
        },
        resourceType: 'fetch',
        isBffBlockApi: false
      }
    ];
  };

  describe('Basic Data Processing', () => {
    test('should process network logs successfully', () => {
      const mockLogs = createMockNetworkLogs();
      const processor = createDataProcessor();
      const result = processor.processNetworkLogs(mockLogs);

      expect(result.success).toBe(true);
      expect(result.totalLogs).toBe(5);
      expect(result.bffApiCount).toBe(2);
      expect(result.uniqueEndpoints).toBeGreaterThan(0);
      expect(result.processedData).toBeDefined();
      expect(result.processedData.length).toBeGreaterThan(0);
    });

    test('should handle empty logs gracefully', () => {
      const processor = createDataProcessor();
      const result = processor.processNetworkLogs([]);

      expect(result.success).toBe(true);
      expect(result.totalLogs).toBe(0);
      expect(result.bffApiCount).toBe(0);
      expect(result.uniqueEndpoints).toBe(0);
      expect(result.processedData).toEqual([]);
    });

    test('should extract correct data from logs', () => {
      const mockLogs = createMockNetworkLogs();
      const processor = createDataProcessor();
      const result = processor.processNetworkLogs(mockLogs);

      expect(result.success).toBe(true);
      const firstApi = result.processedData[0];
      expect(firstApi).toBeDefined();
      expect(firstApi!.method).toBeDefined();
      expect(firstApi!.url).toBeDefined();
      expect(firstApi!.responseBody).toBeDefined();
      expect(firstApi!.queryParams).toBeDefined();
      expect(firstApi!.pathParams).toBeDefined();
    });
  });

  describe('BFF Pattern Identification', () => {
    test('should identify BFF block APIs correctly', () => {
      const mockLogs = createMockNetworkLogs();
      const processor = createDataProcessor();
      const result = processor.processNetworkLogs(mockLogs);

      expect(result.bffApiCount).toBe(2); // Two BFF APIs in mock data
    });

    test('should prioritize BFF APIs when option is enabled', () => {
      const mockLogs = createMockNetworkLogs();
      const processor = createDataProcessor({ prioritizeBffApis: true });
      const result = processor.processNetworkLogs(mockLogs);

      expect(result.success).toBe(true);
      expect(result.bffApiCount).toBeGreaterThan(0);
    });

    test('should filter BFF block APIs', () => {
      const mockLogs = createMockNetworkLogs();
      const processor = createDataProcessor();
      const bffLogs = processor.filterBffBlockApis(mockLogs);

      expect(bffLogs.length).toBe(2); // Two BFF APIs in mock data
      bffLogs.forEach(log => {
        expect(log.isBffBlockApi).toBe(true);
      });
    });
  });

  describe('Endpoint Merging Logic', () => {
    test('should merge duplicate endpoints when enabled', () => {
      const mockLogs = createMockNetworkLogs();
      const processorWithMerging = createDataProcessor({ mergeDuplicates: true });
      const processorWithoutMerging = createDataProcessor({ mergeDuplicates: false });

      const resultWithMerging = processorWithMerging.processNetworkLogs(mockLogs);
      const resultWithoutMerging = processorWithoutMerging.processNetworkLogs(mockLogs);

      expect(resultWithMerging.uniqueEndpoints).toBeLessThanOrEqual(resultWithoutMerging.uniqueEndpoints);
    });

    test('should respect maxApis limit', () => {
      const mockLogs = createMockNetworkLogs();
      const processor = createDataProcessor({ maxApis: 2 });
      const result = processor.processNetworkLogs(mockLogs);

      expect(result.uniqueEndpoints).toBeLessThanOrEqual(2);
    });
  });

  describe('JSON Serialization', () => {
    test('should serialize processed data for AI consumption', () => {
      const mockLogs = createMockNetworkLogs();
      const processor = createDataProcessor();
      const result = processor.processNetworkLogs(mockLogs);

      expect(result.success).toBe(true);
      const serializedData = processor.serializeForAI(result.processedData);

      expect(typeof serializedData).toBe('string');
      expect(serializedData.length).toBeGreaterThan(0);

      // Should be valid JSON
      expect(() => JSON.parse(serializedData)).not.toThrow();

      // Parsed data should be an array
      const parsedData = JSON.parse(serializedData);
      expect(Array.isArray(parsedData)).toBe(true);

      // Each item should have required fields
      if (parsedData.length > 0) {
        const firstItem = parsedData[0];
        expect(firstItem).toHaveProperty('method');
        expect(firstItem).toHaveProperty('url');
        expect(firstItem).toHaveProperty('responseBody');
        expect(firstItem).toHaveProperty('queryParams');
        expect(firstItem).toHaveProperty('pathParams');
      }
    });

    test('should handle serialization errors gracefully', () => {
      const processor = createDataProcessor();
      
      // Test with circular reference (should not happen in normal use)
      const circularData: any = { method: 'GET', url: 'test' };
      circularData.self = circularData;

      expect(() => processor.serializeForAI([circularData])).toThrow();
    });
  });

  describe('Utility Functions', () => {
    test('should extract unique endpoints', () => {
      const mockLogs = createMockNetworkLogs();
      const result = processNetworkLogs(mockLogs);

      expect(result.success).toBe(true);
      const endpoints = extractUniqueEndpoints(result.processedData);

      expect(Array.isArray(endpoints)).toBe(true);
      expect(endpoints.length).toBeGreaterThan(0);
      
      // Should be sorted
      const sortedEndpoints = [...endpoints].sort();
      expect(endpoints).toEqual(sortedEndpoints);
    });

    test('should group by HTTP method', () => {
      const mockLogs = createMockNetworkLogs();
      const result = processNetworkLogs(mockLogs);

      expect(result.success).toBe(true);
      const methodGroups = groupByMethod(result.processedData);

      expect(typeof methodGroups).toBe('object');
      expect(Object.keys(methodGroups).length).toBeGreaterThan(0);

      // Should have GET and POST methods
      expect(methodGroups).toHaveProperty('GET');
      expect(methodGroups).toHaveProperty('POST');

      // Each group should be an array
      Object.values(methodGroups).forEach(group => {
        expect(Array.isArray(group)).toBe(true);
      });
    });

    test('should use utility function for quick processing', () => {
      const mockLogs = createMockNetworkLogs();
      const result = processNetworkLogs(mockLogs, { mergeDuplicates: true });

      expect(result.success).toBe(true);
      expect(result.totalLogs).toBe(5);
    });

    test('should use utility function for quick serialization', () => {
      const mockLogs = createMockNetworkLogs();
      const result = processNetworkLogs(mockLogs);

      expect(result.success).toBe(true);
      const serialized = serializeForAI(result.processedData);

      expect(typeof serialized).toBe('string');
      expect(() => JSON.parse(serialized)).not.toThrow();
    });
  });

  describe('Processing Statistics', () => {
    test('should provide accurate processing statistics', () => {
      const mockLogs = createMockNetworkLogs();
      const processor = createDataProcessor();
      const result = processor.processNetworkLogs(mockLogs);

      expect(result.success).toBe(true);
      const stats = processor.getProcessingStats(result);

      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('bffApiPercentage');
      expect(stats).toHaveProperty('compressionRatio');
      expect(stats).toHaveProperty('averageResponseSize');

      expect(stats.totalProcessed).toBe(result.uniqueEndpoints);
      expect(stats.bffApiPercentage).toBeGreaterThanOrEqual(0);
      expect(stats.bffApiPercentage).toBeLessThanOrEqual(100);
      expect(stats.compressionRatio).toBeGreaterThanOrEqual(1);
      expect(stats.averageResponseSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid URLs gracefully', () => {
      const invalidLog: NetworkLogEntry = {
        id: 'invalid',
        request: {
          method: 'GET',
          url: 'not-a-valid-url',
          headers: {},
          timestamp: Date.now()
        },
        response: {
          status: 200,
          statusText: 'OK',
          headers: {},
          body: '{"test": true}',
          contentType: 'application/json',
          timestamp: Date.now()
        },
        resourceType: 'fetch',
        isBffBlockApi: false
      };

      const processor = createDataProcessor();
      const result = processor.processNetworkLogs([invalidLog]);

      expect(result.success).toBe(true); // Should handle gracefully
      expect(result.processedData.length).toBe(1); // Should still process
    });

    test('should handle processing options correctly', () => {
      const mockLogs = createMockNetworkLogs();
      
      const options = [
        { mergeDuplicates: true, prioritizeBffApis: true, maxApis: 10 },
        { mergeDuplicates: false, prioritizeBffApis: false, maxApis: 3 },
        { mergeDuplicates: true, prioritizeBffApis: true, maxApis: 1 }
      ];

      options.forEach(option => {
        const processor = createDataProcessor(option);
        const result = processor.processNetworkLogs(mockLogs);

        expect(result.success).toBe(true);
        if (option.maxApis > 0) {
          expect(result.uniqueEndpoints).toBeLessThanOrEqual(option.maxApis);
        }
      });
    });
  });
});