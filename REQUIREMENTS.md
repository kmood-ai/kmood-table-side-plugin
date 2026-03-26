# KMood 多维表格工具插件 — 需求文档（项目说明）

> **文档角色**：本文档既是需求规格说明，也是项目说明文件。后续对项目的功能变更、UI 调整等，将通过更新本文档来指导 AI 进行对应的代码修改。
>
> **最后更新**：2026-03-26

---

## 1. 项目概述

| 项 | 说明 |
|---|---|
| 项目名 | kmood-util-side-plugin |
| 定位 | 飞书多维表格（Bitable）侧边栏插件 |
| 技术栈 | React 19 + TypeScript + Vite + Ant Design 6 |
| SDK | @lark-base-open/js-sdk（飞书 Bitable Base JS SDK） |
| RPC | @connectrpc/connect + @connectrpc/connect-web（Connect 协议） |
| 后端 | https://kmood.cn/api（通过 Connect 协议通信） |

---

## 2. 整体界面结构

插件界面从上到下依次排列为：

```
┌────────────────────────────┐
│  ① 欢迎区                   │
│  (时间问候语 + SDK上下文信息) │
├────────────────────────────┤
│  ② 配置区                   │
│  (Token 输入 + 保存按钮)     │
├────────────────────────────┤
│  ③ 单元格操作区              │
│  · 提取设定                  │
│  (可折叠，折叠时仅显示标题)   │
├────────────────────────────┤
│  ④ 表格操作区                │
│  · 批量上传资产区            │
│  (可折叠，折叠时仅显示标题)   │
│  · 批量上传 Prompt 区        │
│  (可折叠，折叠时仅显示标题)   │
└────────────────────────────┘
```

> **全局约束**：在配置区中 Token 未配置（本地缓存为空）时，③ ④ 区域处于 **不可操作** 状态，需给出明确提示（如 Alert 或 disabled overlay）。

---

## 3. 各区域详细说明

### 3.0 欢迎区 ✅ 已完成

#### 功能描述
- 显示基于当前时间的问候语（早上好/中午好/下午好/晚上好）
- 展示当前 SDK 上下文信息（Base ID、Table ID、View ID）
- 信息展示区可折叠

#### 组件构成
| 组件 | 说明 | 状态 |
|---|---|---|
| `WelcomeSection.tsx` | 欢迎区主组件 | ✅ 已实现 |
| `Card` | 容器卡片 | ✅ |
| `Collapse` | 可折叠的 SDK 信息面板 | ✅ |
| `Descriptions` | 展示 Base/Table/View ID 及名称 | ✅ |
| `Tag` + 复制按钮 | ID 展示与复制功能 | ✅ |

#### 数据来源
- 使用 `useSelection` hook 获取当前选中的 Base/Table/View 信息
- 时间问候语根据当前小时动态生成

---

### 3.1 配置区 ✅ 已完成

#### 功能描述
- 用户在此处输入并保存 **Token**（服务端鉴权令牌）。
- Token 通过浏览器 `localStorage` 进行本地持久化缓存；键名为 `kmood_token`。
- 插件启动时自动从 localStorage 读取 Token：
  - **已缓存**：直接使用，配置区显示已配置状态（可展示脱敏 Token 及「修改」「清除」按钮）。
  - **未缓存**：显示输入框 + 保存按钮，并阻断下方所有操作区域。

#### 组件构成
| 组件 | 说明 | 状态 |
|---|---|---|
| `TokenConfig.tsx` | Token 配置主组件 | ✅ 已实现 |
| `Input.Password` | Token 输入框，支持可见性切换 | ✅ |
| `Button`（保存） | 校验非空后将 Token 写入 localStorage 并更新全局状态 | ✅ |
| `Button`（修改） | 进入编辑模式 | ✅ |
| `Button`（清除） | 清除 localStorage 中的 Token，重置为未配置状态 | ✅ |
| `Tag` | 已配置状态标识 | ✅ |

#### 交互约束
1. ✅ Token 输入不能为空字符串；保存前需做前端校验。
2. ✅ Token 变更后，后续所有请求应使用新 Token（通过 `authInterceptor` 从 localStorage 动态读取）。
3. ✅ 清除 Token 后，③ ④ 区域立即变为不可操作。

#### 与请求层的集成
- ✅ `services/index.ts` 中的 `authInterceptor` 从 localStorage 读取 Token 并注入 `trpc-trans-info` header。

---

### 3.2 单元格操作区 ✅ 已完成

### 组成
1. 提取设定

### 提取设定
#### 功能描述
- 监听用户当前选中的单元格，当有选中时支持进行提交。每次提交新建一个任务进行提取，提取完成展示结果
- **可折叠**：支持展开/收起，收起时仅显示区域标题（如 "提取设定"）。

#### 组件构成
| 组件 | 说明 | 状态 |
|---|---|---|
| `CellOperations.tsx` | 单元格操作主组件 | ✅ 已实现 |
| `Collapse` | 可折叠容器 | ✅ |
| `Alert` | Token 未配置 / 未选中单元格时的提示 | ✅ |
| `Card` | 选中单元格信息展示卡片 | ✅ |
| `Descriptions` | 展示数据表名、字段名、内容 | ✅ |
| `Button`（提交提取任务） | 调用 `outerClient.feishuShotify` 提交任务 | ✅ |
| 任务状态卡片 | 展示 loading/success/error 状态 + Trace ID | ✅ |

#### 交互约束
1. ✅ Token 未配置时，整个区域 disabled，显示提示「请先在配置区配置 Token」。
2. ✅ 未选中单元格时显示引导提示。
3. ✅ 提交过程中显示 loading 状态。
4. ✅ 提交完成后展示结果（成功/失败 + Trace ID）。


---

### 3.3 表格操作区 ✅ 已完成

### 组成
1. 批量上传资产区
2. 批量上传 Prompt 区


### 批量上传资产区 ✅ 已完成
#### 功能描述
- 允许用户选择当前 Bitable 中的一张数据表，然后上传文件（资产），并将上传结果写回到选中数据表的对应字段。
- **可折叠**：支持展开/收起，收起时仅显示区域标题（如 "批量上传资产"）。

#### 组件构成
| 组件 | 说明 | 状态 |
|---|---|---|
| `BatchUploadPanel.tsx` | 通用批量上传面板组件 | ✅ 已实现 |
| `Collapse` | 可折叠容器，标题为「批量上传资产」 | ✅ |
| `TableSelector.tsx` | 数据表选择器，数据来自 `bitable.base.getTableList()` | ✅ 已实现 |
| `FileUpload.tsx` | 文件上传组件，支持拖拽和点击选择 | ✅ 已实现 |
| `Alert` | Token 未配置 / 未选择数据表时的提示 | ✅ |

#### 交互约束
1. ✅ Token 未配置时，整个区域 disabled，显示提示「请先在配置区配置 Token」。
2. ✅ 用户必须先选择数据表，再进行文件上传；未选择数据表时显示提示。
3. ✅ 上传过程中显示进度状态。
4. ✅ 上传完成后展示结果列表。
5. ✅ 折叠状态下不影响已选择的数据或上传进度（保留组件状态）。

#### 数据流
```
用户选择数据表 → 用户选择/拖拽文件 → 点击提交
  → outerClient.feishuCreateUasset（走 Connect RPC，带 trpc-trans-info header）
  → 返回结果
```

### 批量上传 Prompt 区 ✅ 已完成

#### 功能描述
- 结构与「批量上传资产区」一致，用于上传 Prompt 类文件。
- 上传的文件内容将被当作 Prompt 处理（后端可能有不同的业务逻辑，但前端上传接口相同）。
- **可折叠**：支持展开/收起，收起时仅显示区域标题（如 "批量上传 Prompt"）。

#### 组件构成
| 组件 | 说明 | 状态 |
|---|---|---|
| `BatchUploadPanel.tsx` | 复用通用批量上传面板组件 | ✅ |
| `TableSelector.tsx` | 同资产区，选择目标数据表 | ✅ |
| `FileUpload.tsx` | 同资产区，支持的文件格式：txt、csv、json、xml、md、log、xlsx、xls | ✅ |

#### 交互约束
- ✅ 与「批量上传资产区」相同（Token 校验、数据表必选、上传进度展示、折叠保留状态等）。
- ✅ 二者复用同一套上传面板组件（通过 props 区分业务类型）。

---

## 4. 组件复用建议

由于「批量上传资产区」和「批量上传 Prompt 区」结构高度一致，已抽取通用组件：

```
src/
  ├── components/
  │   ├── WelcomeSection.tsx      # ✅ 欢迎区组件（问候语 + SDK 上下文信息）
  │   ├── TokenConfig.tsx         # ✅ Token 配置区组件
  │   ├── CellOperations.tsx      # ✅ 单元格操作区组件
  │   ├── BatchUploadPanel.tsx    # ✅ 通用批量上传面板（可折叠、含数据表选择器 + 文件上传）
  │   ├── TableSelector.tsx       # ✅ 数据表选择器（基于 bitable SDK）
  │   └── FileUpload.tsx          # ✅ 文件上传组件（拖拽上传 + 进度展示）
  │
  ├── contexts/
  │   └── SelectionProvider.tsx   # ✅ Selection 全局状态 Provider
  │
  ├── hooks/
  │   ├── index.ts                # ✅ hooks 导出入口
  │   ├── useSelection.ts         # ✅ Selection hook（监听选中状态变化）
  │   └── useTableOperations.ts   # ✅ 表格操作 hook（获取字段列表/表格结构）
  │
  ├── utils/
  │   ├── index.ts                # ✅ utils 导出入口
  │   └── table.ts                # ✅ 表格相关工具函数（formatCellValue）
  │
  └── services/
      ├── index.ts                # ✅ Connect RPC 服务（含 authInterceptor）
      └── uploadService.ts        # ✅ 上传服务
```

`BatchUploadPanel` 接受 props：

| Prop | 类型 | 说明 | 状态 |
|---|---|---|---|
| `title` | `string` | 面板标题，如 "批量上传资产" / "批量上传 Prompt" | ✅ |
| `uploadType` | `'asset' \| 'prompt'` | 业务类型，用于区分上传逻辑或后续处理 | ✅ |
| `disabled` | `boolean` | Token 未配置时传 true | ✅ |
| `onUploadComplete` | `(results: UploadResult[]) => void` | 上传完成回调 | ✅ |
| `onSubmit` | `() => void` | 提交回调 | ✅ |

---

## 5. 状态管理

| 状态 | 范围 | 存储方式 | 状态 |
|---|---|---|---|
| Token | 全局 | `localStorage` + React State（App 层面） | ✅ 已实现 |
| Selection 选中信息 | 全局 | React Context (`SelectionProvider`) | ✅ 已实现 |
| 当前用户 userId | 全局 | 通过 `bitable.bridge.getUserId()` 获取 | - |
| 已选数据表（资产区） | 组件内 | React State | ✅ 已实现 |
| 已选数据表（Prompt 区） | 组件内 | React State | ✅ 已实现 |
| 文件列表 & 上传状态 | 组件内 | React State | ✅ 已实现 |

### 新增状态管理 - Selection Context ✅

为了支持全局选中状态监听，新增了 `SelectionProvider` 和 `useSelection` hook：

```tsx
// 使用示例
const { state, refresh, resetCell } = useSelection();

// state 包含：
// - selectionInfo: { baseId, tableId, viewId, fieldId, recordId }
// - tableName, viewName, fieldName
// - cellValue
// - loading, cellLoading
```

---

## 6. 现有代码基线

### 已有文件与功能

| 文件 | 当前功能 | 状态 |
|---|---|---|
| `src/App.tsx` | 主页面：欢迎区 + 配置区 + 单元格操作区 + 表格操作区 四段式布局 | ✅ 已完成 |
| `src/main.tsx` | 应用入口，包裹 SelectionProvider | ✅ 已完成 |
| `src/components/WelcomeSection.tsx` | 欢迎区组件（问候语 + SDK 上下文信息） | ✅ 新增 |
| `src/components/TokenConfig.tsx` | Token 配置区组件 | ✅ 新增 |
| `src/components/CellOperations.tsx` | 单元格操作区组件 | ✅ 新增 |
| `src/components/BatchUploadPanel.tsx` | 通用批量上传面板组件 | ✅ 新增 |
| `src/components/TableSelector.tsx` | 数据表选择器组件 | ✅ 新增 |
| `src/components/FileUpload.tsx` | 文件上传组件（拖拽/选择 → 逐个上传 → 结果展示） | ✅ 已改造 |
| `src/contexts/SelectionProvider.tsx` | Selection 全局状态 Provider | ✅ 新增 |
| `src/hooks/useSelection.ts` | Selection hook（监听选中状态变化） | ✅ 新增 |
| `src/hooks/useTableOperations.ts` | 表格操作 hook（获取字段列表/表格结构） | ✅ 新增 |
| `src/utils/table.ts` | 表格相关工具函数（formatCellValue） | ✅ 新增 |
| `src/services/index.ts` | Connect RPC 服务（含 authInterceptor 注入 trpc-trans-info header） | ✅ 已改造 |
| `src/services/uploadService.ts` | 上传服务 | ✅ |
| `generated/` | 由 proto 生成的 TypeScript Connect 代码（Outer 等） | ✅ |

### 改造要点（完成情况）

1. **App.tsx** ✅ 已完成
   - 改为「欢迎区 + 配置区 + 单元格操作区 + 表格操作区」四段式布局
   - Token 状态提升到 App 层面管理

2. **FileUpload.tsx** ✅ 已完成
   - 改造为可复用的子组件，接受 `disabled` prop
   - 由 BatchUploadPanel 包裹

3. **services/index.ts** ✅ 已完成
   - `authInterceptor` 从 localStorage 动态读取 Token 并注入 `trpc-trans-info` header

4. **新增 TokenConfig.tsx** ✅ 已完成
   - Token 输入/展示/清除组件

5. **新增 BatchUploadPanel.tsx** ✅ 已完成
   - 通用的可折叠批量上传面板

6. **新增 TableSelector.tsx** ✅ 已完成
   - 数据表下拉选择器

7. **新增 CellOperations.tsx** ✅ 已完成
   - 单元格操作区组件

8. **新增 WelcomeSection.tsx** ✅ 已完成
   - 欢迎区组件

9. **新增 SelectionProvider + useSelection** ✅ 已完成
   - 全局选中状态管理

10. **新增 useTableOperations** ✅ 已完成
    - 表格操作能力封装（获取字段列表、表格结构等）

---

## 7. 技术备忘

- **base64 编码**：使用 `btoa(unescape(encodeURIComponent(str)))` 兼容中文和特殊字符。
- **Connect Interceptor**：`@connectrpc/connect` 的 `Interceptor` 类型，签名为 `(next) => async (req) => { ... return next(req); }`。
- **Bitable SDK 数据表列表**：`bitable.base.getTableList()` 返回 Table 对象数组，通过 `bitable.base.getTableMetaById(table.id)` 获取表名。
- **Bitable SDK 选中监听**：`bitable.base.onSelectionChange(callback)` 监听选中变化。
- **localStorage Key**：`kmood_token`。

---

## 8. Hooks API 文档

### useSelection

全局选中状态管理 hook。

```tsx
const { state, refresh, resetCell } = useSelection();
```

| 属性/方法 | 类型 | 说明 |
|---|---|---|
| `state.selectionInfo` | `SelectionInfo` | 当前选中的 baseId/tableId/viewId/fieldId/recordId |
| `state.tableName` | `string` | 当前选中表格名称 |
| `state.viewName` | `string` | 当前选中视图名称 |
| `state.fieldName` | `string` | 当前选中字段名称 |
| `state.cellValue` | `any` | 当前选中单元格的值 |
| `state.loading` | `boolean` | 是否正在加载选中信息 |
| `state.cellLoading` | `boolean` | 是否正在加载单元格值 |
| `refresh()` | `() => Promise<void>` | 手动刷新选中信息 |
| `resetCell()` | `() => void` | 重置单元格状态 |

### useTableOperations

表格操作能力封装 hook。

```tsx
const { getFieldList, getFieldListByTableId, getTableStructure, getTableMeta, currentTableId, currentBaseId } = useTableOperations();
```

| 方法 | 类型 | 说明 |
|---|---|---|
| `getFieldList()` | `() => Promise<FieldInfo[]>` | 获取当前选中表格的字段列表 |
| `getFieldListByTableId(tableId)` | `(tableId: string) => Promise<FieldInfo[]>` | 根据表格 ID 获取字段列表 |
| `getTableStructure()` | `() => Promise<TableStructure>` | 获取当前 base 下的表格组织结构 |
| `getTableMeta(tableId)` | `(tableId: string) => Promise<ITableMeta \| null>` | 获取指定表格的元信息 |
| `currentTableId` | `string \| null` | 当前选中的表格 ID |
| `currentBaseId` | `string \| null` | 当前选中的 base ID |

---

## 变更日志

| 日期 | 内容 |
|---|---|
| 2026-03-26 | 初始版本：定义配置区、批量上传资产区、批量上传 Prompt 区三段式布局需求 |
| 2026-03-26 | 功能完成：标注所有已完成功能，更新组件构成，补充新增组件说明（欢迎区、单元格操作区、Hooks、Contexts、Utils） |
