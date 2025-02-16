import axios from 'axios'

export enum ErrorType {
  API = 'API_ERROR',
  NETWORK = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  PARSE = 'PARSE_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR'
}

export interface ErrorInfo {
  type: ErrorType
  message: string
  details?: string
  timestamp: number
  retryable: boolean
}

export class ErrorService {
  private static instance: ErrorService

  private constructor() {}

  static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService()
    }
    return ErrorService.instance
  }

  createError(type: ErrorType, message: string, details?: string): ErrorInfo {
    return {
      type,
      message: this.getUserFriendlyMessage(type, message),
      details,
      timestamp: Date.now(),
      retryable: this.isRetryable(type)
    }
  }

  private getUserFriendlyMessage(type: ErrorType, message: string): string {
    switch (type) {
      case ErrorType.API:
        return '服务暂时不可用，请稍后重试'
      case ErrorType.NETWORK:
        return '网络连接不稳定，请检查网络后重试'
      case ErrorType.TIMEOUT:
        return '请求超时，请稍后重试'
      case ErrorType.PARSE:
        return '内容解析失败，请重试'
      case ErrorType.VALIDATION:
        return '输入格式不正确，请检查后重试'
      default:
        return message || '发生未知错误，请稍后重试'
    }
  }

  private isRetryable(type: ErrorType): boolean {
    return [
      ErrorType.API,
      ErrorType.NETWORK,
      ErrorType.TIMEOUT
    ].includes(type)
  }

  handleError(error: any): ErrorInfo {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ERR_NETWORK') {
        return this.createError(ErrorType.NETWORK, '网络连接失败')
      }
      if (error.code === 'ECONNABORTED') {
        return this.createError(ErrorType.TIMEOUT, '请求超时')
      }
      const statusCode = error.response?.status ?? 0
      if (statusCode === 401 || statusCode === 403) {
        return this.createError(ErrorType.API, 'API认证失败，请检查密钥设置')
      }
      if (statusCode === 429) {
        return this.createError(ErrorType.API, 'API调用次数超限，请稍后重试')
      }
      if (statusCode >= 500) {
        return this.createError(ErrorType.API, '服务器暂时不可用')
      }
      return this.createError(ErrorType.API, error.message)
    }
    
    if (error instanceof SyntaxError) {
      return this.createError(ErrorType.PARSE, '数据格式错误')
    }
    
    return this.createError(
      ErrorType.UNKNOWN,
      error instanceof Error ? error.message : '未知错误'
    )
  }
}

// 导出单例实例
export const errorService = ErrorService.getInstance() 