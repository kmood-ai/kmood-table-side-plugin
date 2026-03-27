# KMood 多维表格工具插件

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
