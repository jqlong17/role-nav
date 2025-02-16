import axios from 'axios'
import { errorService, ErrorType } from './error'

const ZHIPU_API_KEY = import.meta.env.VITE_ZHIPU_API_KEY
const ZHIPU_API_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatOptions {
  temperature?: number
  max_tokens?: number
}

interface ThemeContent {
  dimension: string
  tabs: Array<{
    title: string
    content?: string
  }>
}

interface ZhipuResponse {
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  created: number
  id: string
  model: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class AIService {
  private static instance: AIService
  
  private constructor() {}

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService()
    }
    return AIService.instance
  }

  private async generateToken(): Promise<string> {
    try {
      const [apiId, apiSecret] = ZHIPU_API_KEY.split('.')
      if (!apiId || !apiSecret) {
        throw errorService.createError(
          ErrorType.VALIDATION,
          'API KEY 格式错误'
        )
      }

      const header = {
        alg: 'HS256',
        sign_type: 'SIGN'
      }
      
      const payload = {
        api_key: apiId,
        exp: Math.floor(Date.now() / 1000) + 3600,
        timestamp: Math.floor(Date.now() / 1000),
        type: "public"
      }

      // Base64Url 编码
      const encodeBase64Url = (str: string) => {
        return btoa(str)
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '')
      }

      // 生成签名
      const generateSignature = async (input: string, key: string) => {
        const encoder = new TextEncoder()
        const keyData = encoder.encode(key)
        const msgData = encoder.encode(input)
        
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        )
        
        const signature = await crypto.subtle.sign(
          'HMAC',
          cryptoKey,
          msgData
        )
        
        return encodeBase64Url(String.fromCharCode(...new Uint8Array(signature)))
      }

      const headerStr = encodeBase64Url(JSON.stringify(header))
      const payloadStr = encodeBase64Url(JSON.stringify(payload))
      const input = `${headerStr}.${payloadStr}`
      
      const signature = await generateSignature(input, apiSecret)
      return `${input}.${signature}`
    } catch (error) {
      console.error('生成 token 失败:', error)
      throw errorService.handleError(error)
    }
  }

  private extractContent(content: string): string {
    // 移除内容中的 markdown 代码块标记
    content = content.replace(/^```json\s*/, '') // 移除开头的 ```json
      .replace(/^```\s*/, '') // 移除开头的 ```
      .replace(/\s*```$/, '') // 移除结尾的 ```
      .trim()
    
    return content
  }

  private cleanJsonString(content: string): string {
    // 移除所有可能导致 JSON 解析失败的标记
    return content
      .replace(/^```json\s*/, '') // 移除开头的 ```json
      .replace(/^```\s*/, '') // 移除开头的 ```
      .replace(/\s*```$/, '') // 移除结尾的 ```
      .replace(/^\s*{\s*/, '{') // 标准化开头的大括号
      .replace(/\s*}\s*$/, '}') // 标准化结尾的大括号
      .trim()
  }

  async chat(prompt: string, options: ChatOptions = {}): Promise<string> {
    const maxRetries = 3
    let retryCount = 0
    let lastError: any = null
    
    while (retryCount < maxRetries) {
      try {
        const token = await this.generateToken()
        
        const response = await axios.post<ZhipuResponse>(ZHIPU_API_ENDPOINT, {
          model: 'glm-4-flash',
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: options.temperature ?? 0.7,
          top_p: 0.7,
          request_id: `web_${Date.now()}`
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000,
        })

        if (!response.data?.choices?.[0]?.message?.content) {
          throw errorService.createError(
            ErrorType.API,
            'API返回数据格式不正确'
          )
        }

        const content = response.data.choices[0].message.content
        return this.extractContent(content)
      } catch (error) {
        lastError = error
        retryCount++
        
        const errorInfo = errorService.handleError(error)
        console.error(`API请求失败 (尝试 ${retryCount}/${maxRetries}):`, errorInfo)
        
        if (errorInfo.retryable && retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        throw errorInfo
      }
    }
    
    throw errorService.handleError(lastError)
  }

  async searchTopics(keyword: string): Promise<{
    role: string
    themes: string[]
  }> {
    try {
      const prompt = `基于用户搜索的主题"${keyword}"，请推测用户的真实社会角色，以及该角色最可能感兴趣的3个主题（要包含用户搜索的主题）。
请以 JSON 格式返回，格式如下：
{
  "role": "角色名称",
  "themes": ["主题1", "主题2", "主题3"]
}

注意：
1. 必须返回合法的 JSON 格式
2. 不要添加任何额外的格式标记（如 markdown 代码块）
3. 直接返回 JSON 字符串`

      const content = await this.chat(prompt)
      try {
        const cleanedContent = this.cleanJsonString(content)
        console.log('清理后的内容:', cleanedContent)
        
        const result = JSON.parse(cleanedContent)
        if (!result.role || !Array.isArray(result.themes) || result.themes.length === 0) {
          throw errorService.createError(
            ErrorType.PARSE,
            'API返回数据格式不正确'
          )
        }
        return {
          role: result.role,
          themes: result.themes.slice(0, 3)
        }
      } catch (error) {
        console.error('解析搜索结果失败:', error, '\n原始内容:', content)
        throw errorService.createError(
          ErrorType.PARSE,
          'API返回数据解析失败'
        )
      }
    } catch (error) {
      throw errorService.handleError(error)
    }
  }

  async generateThemeContent(
    theme: string, 
    useFinerGranularity: boolean = false,
    currentTabs?: Array<{title: string}>
  ): Promise<ThemeContent> {
    try {
      // 构建当前标签页信息
      const currentTabsInfo = currentTabs ? 
        `当前标签页信息：
${JSON.stringify(currentTabs, null, 2)}

请基于以上标签页，提供更细颗粒度的阶段划分。` : ''

      const finerGranularityPrompt = useFinerGranularity ? 
        `用户希望更细颗粒度的时间来获取详细的知识。
${currentTabsInfo}
请提供比当前更细致的阶段划分，例如：
- 如果当前是"月"，可以细分为"周"
- 如果当前是"阶段"，可以细分为具体的时间点
- 如果当前是"年"，可以细分为"月"或"季度"
请确保新的阶段划分能够完整覆盖原有阶段的内容范围。` : ''

      const analysisPrompt = `分析主题"${theme}"，给出以下信息：
1. 最相关的角色
2. 3个相关主题
3. 最适合组织内容的连续维度（维度值要连续）

${finerGranularityPrompt}

请以 JSON 格式返回，格式如下：
{
  "role": "角色名称",
  "relatedThemes": ["主题1", "主题2", "主题3"],
  "dimension": "维度名称",
  "explanation": "为什么选择这个维度的说明",
  "stages": ["阶段1", "阶段2", "阶段3"]
}

注意：
1. 必须返回合法的 JSON 格式
2. 不要添加任何额外的格式标记（如 markdown 代码块）
3. 直接返回 JSON 字符串
4. stages 数组中的每个阶段名称必须是具体的描述，不要使用数字编号
5. 每个阶段名称应该简洁明了，不要包含特殊字符
6. dimension 必须是一个连续的维度，如难度、时间、深度等`

      console.log('发送分析请求:', analysisPrompt)
      const analysisContent = await this.chat(analysisPrompt, {
        temperature: 0.5 // 降低随机性，使输出更加稳定
      })
      console.log('收到分析响应:', analysisContent)
      
      try {
        const cleanedContent = this.cleanJsonString(analysisContent)
        console.log('清理后的内容:', cleanedContent)

        let result: {
          role: string
          relatedThemes: string[]
          dimension: string
          explanation: string
          stages: string[]
        }

        try {
          result = JSON.parse(cleanedContent)
        } catch (parseError) {
          console.error('JSON 解析失败:', parseError, '\n原始内容:', analysisContent)
          throw errorService.createError(
            ErrorType.PARSE,
            'API返回的数据不是有效的 JSON 格式'
          )
        }
        
        // 验证必要字段
        if (!result.dimension || typeof result.dimension !== 'string') {
          throw errorService.createError(
            ErrorType.PARSE,
            '返回内容缺少有效的维度信息'
          )
        }

        if (!Array.isArray(result.stages)) {
          throw errorService.createError(
            ErrorType.PARSE,
            '返回内容缺少有效的阶段信息'
          )
        }

        const stages = result.stages
          .map((stage: string) => stage.trim())
          .filter((stage: string) => stage)

        if (stages.length === 0) {
          console.error('未找到有效阶段:', result.stages)
          throw errorService.createError(
            ErrorType.PARSE,
            '返回内容中没有有效的阶段信息'
          )
        }

        if (stages.length < 2) {
          console.error('阶段数量不足:', stages)
          throw errorService.createError(
            ErrorType.PARSE,
            '返回内容中的阶段数量不足'
          )
        }

        console.log('解析结果:', {
          dimension: result.dimension,
          stages
        })

        return {
          dimension: result.dimension,
          tabs: stages.map((title: string) => ({ title }))
        }
      } catch (error) {
        console.error('解析返回内容失败:', error)
        throw errorService.createError(
          ErrorType.PARSE,
          'API返回数据解析失败'
        )
      }
    } catch (error) {
      console.error('生成主题内容时出错:', error)
      throw errorService.handleError(error)
    }
  }
} 