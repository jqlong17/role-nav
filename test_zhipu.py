import os
import json
import jwt
import time
import requests
from datetime import datetime

# 配置信息
API_KEY = os.getenv('ZHIPU_API_KEY')  # 从环境变量获取 API key
API_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

def generate_token(api_key: str) -> str:
    """
    生成智谱 API 的 JWT token
    """
    try:
        api_key_parts = api_key.split('.')
        if len(api_key_parts) != 2:
            raise ValueError("API KEY 格式错误，应为 'id.secret' 格式")
            
        api_id, api_secret = api_key_parts
        
        payload = {
            "api_key": api_id,
            "exp": int(time.time()) + 3600,  # 1小时后过期
            "timestamp": int(time.time()),
            "type": "public"  # 添加类型字段
        }
        
        token = jwt.encode(
            payload,
            api_secret,
            algorithm='HS256',
            headers={"alg": "HS256", "sign_type": "SIGN"}  # 添加必要的头部信息
        )
        return token
        
    except Exception as e:
        print(f"生成 token 时出错: {str(e)}")
        return ""

def test_zhipu_api(prompt: str, test_name: str) -> None:
    """
    测试智谱 AI 的 API 调用
    
    Args:
        prompt: 要发送给 API 的提示文本
        test_name: 测试名称，用于日志输出
    """
    print(f'\n开始测试: {test_name}')
    print('-' * 50)
    
    # 生成 JWT token
    token = generate_token(API_KEY)
    if not token:
        print("错误: 无法生成有效的 token")
        return
    
    # 准备请求头
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # 准备请求体
    data = {
        'model': 'glm-4-flash',
        'messages': [{
            'role': 'user',
            'content': prompt
        }],
        'temperature': 0.7,
        'top_p': 0.7,
        'request_id': f'test_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
    }
    
    try:
        # 发送请求
        print(f'发送请求...\n提示词:\n{prompt}\n')
        response = requests.post(API_ENDPOINT, headers=headers, json=data)
        
        # 打印原始响应
        print(f'状态码: {response.status_code}')
        print(f'原始响应:\n{json.dumps(response.json(), ensure_ascii=False, indent=2)}')
        
        # 如果请求成功，解析并打印内容
        if response.status_code == 200:
            result = response.json()
            if 'choices' in result and len(result['choices']) > 0:
                content = result['choices'][0]['message']['content']
                print(f'\n生成的内容:\n{content}')
                
                # 打印 token 使用情况
                if 'usage' in result:
                    usage = result['usage']
                    print(f'\nToken 使用情况:')
                    print(f'提示词 tokens: {usage["prompt_tokens"]}')
                    print(f'生成内容 tokens: {usage["completion_tokens"]}')
                    print(f'总计 tokens: {usage["total_tokens"]}')
            else:
                print('\n警告: 响应格式不符合预期')
        else:
            print(f'\n错误: 请求失败，状态码 {response.status_code}')
            
    except Exception as e:
        print(f'\n错误: {str(e)}')

def main():
    """
    主函数，运行一系列测试用例
    """
    # 测试用例 1: 主题分析
    analysis_prompt = '''分析主题"Vue 基础"，给出以下信息：
1. 最相关的角色
2. 3个相关主题
3. 最适合组织内容的连续维度（维度值要连续，比如难度级别可以是"入门-进阶-专家"，时间顺序可以是"过去-现在-未来"）

请按以下格式回复：
角色：[角色名称]
主题1：[主题名称]
主题2：[主题名称]
主题3：[主题名称]
维度：[维度名称]
说明：[为什么选择这个维度]
范围：[第一级],[第二级],[第三级]'''
    
    test_zhipu_api(analysis_prompt, '主题分析测试')
    
    # 测试用例 2: 内容生成
    content_prompt = '''为主题"Vue 基础"生成"入门"级别的内容指南。

背景信息：
- 目标角色：前端开发者
- 相关主题：组件开发、状态管理、路由系统
- 维度：掌握程度

请生成以下内容：
1. 这个级别的特点和目标
2. 核心内容要点
3. 学习或实践建议
4. 常见问题和解决方案

请直接输出文本内容，不要使用 markdown 格式。'''
    
    test_zhipu_api(content_prompt, '内容生成测试')

if __name__ == '__main__':
    if not API_KEY:
        print('错误: 未设置 ZHIPU_API_KEY 环境变量')
    else:
        main() 