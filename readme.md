# Role Navigator

一个基于大模型的角色导航和主题探索工具。

## 功能特点

- 🎯 基于角色的主题推荐
- 📚 主题内容的多维度展示
- 🔄 动态的内容细化
- 🔍 智能主题搜索
- 💡 交互式学习路径

## 技术栈

- Vue 3
- TypeScript
- Vite
- 智谱 AI API

## 开始使用

1. 克隆项目
```bash
git clone https://github.com/your-username/role-nav.git
cd role-nav
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp .env.example .env
```
然后编辑 `.env` 文件，填入你的智谱 AI API 密钥。

4. 启动开发服务器
```bash
npm run dev
```

5. 构建生产版本
```bash
npm run build
```

## 环境变量配置

项目使用以下环境变量：

- `VITE_ZHIPU_API_KEY`: 智谱 AI 的 API 密钥（格式：api_id.api_secret）
- `VITE_API_TIMEOUT`: API 请求超时时间（毫秒）
- `VITE_APP_TITLE`: 应用标题

## 注意事项

- 确保 `.env` 文件不要提交到版本控制系统
- API 密钥请妥善保管，不要泄露
- 本地开发时请使用 `.env.local` 进行个性化配置

## 许可证

MIT 