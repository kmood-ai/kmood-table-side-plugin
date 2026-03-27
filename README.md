# KMood 多维表格工具插件

基于飞书多维表格 [Base JS SDK](https://lark-base-team.github.io/js-sdk-docs/zh/) 开发的侧边栏插件，用于展示当前用户信息并统计各数据表的记录条数。

## ✨ 主要功能

- **用户信息展示** — 显示当前登录用户 ID、语言偏好、主题模式及所在文档 ID
- **数据表记录统计** — 自动遍历当前多维表格中所有数据表，列出每张表的名称、表 ID 与记录条数，并汇总合计
- **一键刷新** — 支持手动刷新以获取最新数据

## 🛠 技术栈

| 分类      | 技术                                                                           |
| --------- | ------------------------------------------------------------------------------ |
| 构建工具  | [Vite](https://vitejs.dev/) 8                                                  |
| 语言      | [TypeScript](https://www.typescriptlang.org/) 5.9                              |
| 前端框架  | [React](https://react.dev/) 19                                                 |
| UI 组件库 | [Ant Design](https://ant.design/) 6                                            |
| 插件 SDK  | [@lark-base-open/js-sdk](https://www.npmjs.com/package/@lark-base-open/js-sdk) |

## 📦 项目结构

```
kmood-util-side-plugin/
├── index.html          # 入口 HTML
├── src/
│   ├── main.tsx        # 应用入口，挂载 React 根组件
│   └── App.tsx         # 主组件：用户信息 + 数据表统计
├── vite.config.ts      # Vite 配置
├── package.json
└── README.md
```

## 🚀 Get Started

### 环境准备

- **Node.js** >= 18（推荐使用 LTS 版本）
- **npm** >= 9 或 **pnpm** / **yarn**

### 1. 安装依赖

```bash
npm install
```

### 2. 本地开发

```bash
npm run dev
```

启动后 Vite 将在 `http://localhost:5173` 提供开发服务器。

### 3. 在飞书多维表格中调试

1. 打开任意一个飞书多维表格文档
2. 点击右上角 **扩展脚本** → **自定义插件**（或通过「插件开发」入口）
3. 选择 **添加插件** → 填写本地调试地址 `http://localhost:5173`
4. 插件将以侧边栏形式加载，即可实时查看用户信息和数据表统计

### 4. 构建打包

```bash
npm run build
```

构建产物输出到 `dist/` 目录，可直接用于插件发布。

### 5. 预览构建产物

```bash
npm run preview
```

### 6. 代码检查

```bash
npm run lint
```

## 📝 License

ISC
