/**
 * API Client Service for pgeu-system backend
 * Handles all HTTP communication with conference scanner APIs
 * Uses Capacitor HTTP to bypass CORS restrictions
 */

import { CapacitorHttp, HttpResponse, HttpOptions } from '@capacitor/core';
import type {
  StatusResponse,
  LookupResponse,
  SearchResponse,
  StoreResponse,
  StatsResponse,
  ApiError,
  ApiRequestOptions,
  StoreRequestBody,
} from '../types/api';
import { redactTokens } from '../utils/redact';

/**
 * API Client for pgeu-system backend
 */
export class ApiClient {
  private baseUrl: string;

  /**
   * Create a new API client
   * @param baseUrl - Conference base URL (e.g., https://postgresql.eu/events/pgconf2024/checkin/abc123.../)
   */
  constructor(baseUrl: string) {
    // Ensure baseUrl ends with /
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }

  /**
   * Make HTTP request with retry logic
   */
  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    options?: {
      params?: Record<string, string>;
      data?: string;
      timeout?: number;
    }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const httpOptions: HttpOptions = {
          url,
          method,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'PGConfScanner/2.0.0',
          },
          connectTimeout: options?.timeout || 10000,
          readTimeout: options?.timeout || 10000,
        };

        // Add query params for GET requests
        if (method === 'GET' && options?.params) {
          const searchParams = new URLSearchParams(options.params);
          httpOptions.url = `${url}?${searchParams.toString()}`;
        }

        // Add body data for POST requests
        if (method === 'POST' && options?.data) {
          httpOptions.data = options.data;
        }

        console.log(`[ApiClient] ${method} ${redactTokens(httpOptions.url)}`);
        const response: HttpResponse = await CapacitorHttp.request(httpOptions);
        console.log(`[ApiClient] Response status:`, response.status);

        // Handle error status codes
        if (response.status >= 400) {
          throw this.handleHttpError(response);
        }

        return response.data as T;
      } catch (error) {
        lastError = error;

        // Only retry on network errors or 5xx server errors
        const apiError = error as ApiError;
        const shouldRetry =
          attempt < maxRetries &&
          (error instanceof Error && error.message.includes('network')) ||
          (apiError.statusCode !== undefined && apiError.statusCode >= 500);

        if (!shouldRetry) {
          throw error;
        }

        // Exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Get conference status
   * @param options - Request options
   * @returns Status response
   */
  async getStatus(options?: ApiRequestOptions): Promise<StatusResponse> {
    try {
      return await this.request<StatusResponse>('GET', 'api/status/', {
        timeout: options?.timeout || 5000,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Lookup attendee by QR code token
   * @param qrCode - Scanned QR code content (full URL or token)
   * @param options - Request options
   * @returns Lookup response with attendee details
   */
  async lookupAttendee(qrCode: string, options?: ApiRequestOptions): Promise<LookupResponse> {
    try {
      return await this.request<LookupResponse>('GET', 'api/lookup/', {
        params: { lookup: qrCode },
        timeout: options?.timeout || 10000,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Search for attendees by name/email (check-in mode only)
   * @param query - Search query
   * @param options - Request options
   * @returns Search response with matching attendees
   */
  async searchAttendees(query: string, options?: ApiRequestOptions): Promise<SearchResponse> {
    try {
      return await this.request<SearchResponse>('GET', 'api/search/', {
        params: { search: query },
        timeout: options?.timeout || 10000,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Store check-in or badge scan
   * @param body - Store request body
   * @param options - Request options
   * @returns Store response
   */
  async store(body: StoreRequestBody, options?: ApiRequestOptions): Promise<StoreResponse> {
    try {
      // Convert body to URLSearchParams for x-www-form-urlencoded
      const params = new URLSearchParams();
      params.append('token', body.token);
      if (body.note !== undefined) {
        params.append('note', body.note);
      }

      return await this.request<StoreResponse>('POST', 'api/store/', {
        data: params.toString(),
        timeout: options?.timeout || 15000,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get check-in statistics (admin only)
   * @param options - Request options
   * @returns Statistics response
   */
  async getStats(options?: ApiRequestOptions): Promise<StatsResponse> {
    try {
      return await this.request<StatsResponse>('GET', 'api/stats/', {
        timeout: options?.timeout || 20000,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle HTTP error responses
   */
  private handleHttpError(response: HttpResponse): ApiError {
    const status = response.status;
    const responseData = response.data;

    // Extract error message from response body if available
    let serverMessage: string | undefined;
    if (typeof responseData === 'string') {
      // Ignore HTML error pages (Django debug pages, server error pages, etc.)
      const isHtml = responseData.trim().toLowerCase().startsWith('<!doctype') ||
                     responseData.trim().toLowerCase().startsWith('<html');
      if (!isHtml) {
        serverMessage = responseData;
      }
    } else if (responseData && typeof responseData === 'object' && 'message' in responseData) {
      serverMessage = String(responseData.message);
    }

    switch (status) {
      case 404:
        return {
          type: 'not_found',
          message: serverMessage || 'The scanned QR code was not recognised or cannot be used for this type of scan',
          statusCode: status,
        };
      case 403:
        return {
          type: 'forbidden',
          message: serverMessage || 'Access denied. Please check your conference registration.',
          statusCode: status,
        };
      case 412:
        return {
          type: 'precondition_failed',
          message: serverMessage || 'Operation cannot be completed',
          statusCode: status,
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: 'server_error',
          message: 'Server error. Please try again or contact support.',
          statusCode: status,
        };
      default:
        return {
          type: 'unknown',
          message: serverMessage || `Request failed with status ${status}`,
          statusCode: status,
        };
    }
  }

  /**
   * Handle general errors and convert to ApiError
   */
  private handleError(error: unknown): ApiError {
    // If it's already an ApiError, return it
    if (error && typeof error === 'object' && 'type' in error && 'message' in error) {
      return error as ApiError;
    }

    // Network or timeout error
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return {
          type: 'timeout',
          message: 'Request timed out. Check your connection and try again.',
          details: error.message,
        };
      }
      return {
        type: 'network_error',
        message: 'Network error. Please check your connection.',
        details: error.message,
      };
    }

    // Unknown error
    return {
      type: 'unknown',
      message: 'An unknown error occurred',
    };
  }
}

/**
 * Create an API client for a conference
 * @param apiUrl - Conference API URL
 * @returns API client instance
 */
export function createApiClient(apiUrl: string): ApiClient {
  return new ApiClient(apiUrl);
}
