# KMood 多维表格工具插件 — 需求文档（项目说明）

> **文档角色**：本文档既是需求规格说明，也是项目说明文件。后续对项目的功能变更、UI 调整等，将通过更新本文档来指导 AI 进行对应的代码修改。
>
> **最后更新**：2026-03-27

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

插件界面从上到下依次排列为 **两段式布局**：

```
┌─────────────────────────────────┐
│  ⚠️ Token 未配置提示（条件显示）   │
│  (仅当 Token 未配置时显示警告)    │
├─────────────────────────────────┤
│  ① 欢迎区                        │
│  (时间问候语 + 上下文信息折叠区)   │
│  ┌─────────────────────────────┐│
│  │ ▶ 上下文信息（默认收起）       ││
│  │   · SDK 信息（Base/Table等）  ││
│  │   · Token 配置（嵌入此处）     ││
│  └─────────────────────────────┘│
├─────────────────────────────────┤
│  ② 操作区                        │
│  ┌─────────────────────────────┐│
│  │ [表类型自动识别标签]           ││
│  │  资产表 / 生产表 / 未匹配     ││
│  ├─────────────────────────────┤│
│  │ Tab 栏（根据表类型动态展示）   ││
│  │                              ││
│  │ ■ 资产表 → 显示：            ││
│  │   Tab1: 提取设定              ││
│  │   Tab2: 批量上传资产          ││
│  │                              ││
│  │ ■ 生产表 → 显示：            ││
│  │   Tab1: 提取设定              ││
│  │   Tab2: 批量上传 Prompt       ││
│  │   Tab3: 批量生成              ││
│  │                              ││
│  │ ■ 未匹配 → 显示：            ││
│  │   提示"当前表不是资产表或      ││
│  │   生产表，请切换到正确的表"    ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

> **全局约束**：
> 1. Token 未配置时（本地缓存为空且映射表无记录），在欢迎区 **上方** 显示 **警告提示**（Alert warning），告知用户需要配置 Token。
> 2. Token 未配置时，② 操作区处于 **不可操作** 状态，需给出明确提示（如 Alert 或 disabled overlay）。
> 3. 操作区根据当前选中表的 **字段（Field）名称** 自动判断表类型，并动态展示对应的 Tab 和功能模块。
> 4. **上下文信息默认收起**，用户可点击展开查看 SDK 信息和 Token 配置。

---

## 3. 各区域详细说明

### 3.0 欢迎区 🔄 需改造

> **变更说明**：原配置区（Token 配置）已合并到欢迎区的"上下文信息"折叠面板中。

#### 功能描述
- 显示基于当前时间的问候语（早上好/中午好/下午好/晚上好）
- 展示可折叠的"上下文信息"面板（**默认收起**），包含：
  - SDK 上下文信息（Base ID、Table ID、View ID、User ID）
  - Token 配置模块（原配置区内容）
- 当 Token 未配置时，在欢迎区 **上方** 显示警告提示（Alert warning）

#### 组件构成
| 组件 | 说明 | 状态 |
|---|---|---|
| `WelcomeSection.tsx` | 欢迎区主组件（合并配置区） | 🔄 需改造 |
| `Card` | 容器卡片 | ✅ |
| `Alert` | Token 未配置时的警告提示（显示在欢迎区上方） | 🆕 需新增 |
| `Collapse` | 可折叠的"上下文信息"面板，**默认收起** | 🔄 需改造 |
| `Descriptions` | 展示 Base/Table/View/User ID 及名称 | ✅ |
| `Tag` + 复制按钮 | ID 展示与复制功能 | ✅ |
| Token 配置模块 | 内嵌的 Token 输入/展示/清除（原 TokenConfig 组件内容） | 🔄 需内嵌 |

#### 数据来源
- 使用 `useSelection` hook 获取当前选中的 Base/Table/View 信息
- 使用 `bitable.bridge.getUserId()` 获取当前用户 ID
- 时间问候语根据当前小时动态生成
- Token 状态通过 props 传入（从 App.tsx 传递）

#### Token 配置功能（原配置区）

配置区实现 **Token 双层缓存机制**：

1. **第一层：本地缓存（localStorage）**
   - 键名为 `kmood_token`，用户手动输入保存后写入。
   - 插件启动时优先从 localStorage 读取。

2. **第二层：系统 BaseID-Token 映射表**
   - 后端维护一张 `BaseID → Token` 的映射表。
   - 当本地缓存为空时，插件通过当前的 `BaseID`（由 SDK 获取）自动向后端查询对应的 Token。
   - 查询到后自动回填到本地缓存，用户无需手动输入。
   - 若后端也无记录，则提示用户手动输入 Token。

3. **Token 保存时的双向同步**
   - 用户手动保存 Token 时，同时：
     - 写入 localStorage（本地缓存）
     - 调用后端接口将 `{ baseId, token }` 写入映射表（后端持久化）
   - 这样其他用户在相同 Base 下打开插件时，即可自动获取 Token。

#### Token 获取流程

```
插件启动
  ↓
读取 localStorage("kmood_token")
  ├── 有值 → 直接使用，显示已配置状态
  └── 无值
       ↓
     通过 SDK 获取当前 BaseID
       ↓
     调用后端接口 getTokenByBaseId(baseId)
       ├── 返回 Token → 自动回填 localStorage，显示已配置状态
       └── 无记录 → 在欢迎区上方显示警告提示，折叠面板内显示输入框
```

#### 交互约束
1. ✅ Token 输入不能为空字符串；保存前需做前端校验。
2. ✅ Token 变更后，后续所有请求应使用新 Token（通过 `authInterceptor` 从 localStorage 动态读取）。
3. ✅ 清除 Token 后，② 操作区立即变为不可操作。
4. 🆕 插件启动时，若本地无 Token，自动触发后端映射表查询（带 loading 状态）。
5. 🆕 保存 Token 时，同步调用后端接口写入 BaseID-Token 映射。
6. 🆕 **上下文信息面板默认收起**（`defaultActiveKey` 为空或不设置）。
7. 🆕 **Token 未配置时，在欢迎区上方显示 Alert 警告**，引导用户展开"上下文信息"配置 Token。

#### 后端接口（待定义）
| 接口 | 方法 | 说明 |
|---|---|---|
| `getTokenByBaseId` | RPC | 根据 BaseID 查询映射的 Token |
| `setTokenByBaseId` | RPC | 写入/更新 BaseID → Token 映射 |

> **注意**：后端接口尚未定义到 proto 文件中，需后续补充到 `outer.proto` 或新建 proto。

#### 与请求层的集成
- ✅ `services/index.ts` 中的 `authInterceptor` 从 localStorage 读取 Token 并注入 `trpc-trans-info` header。
- ✅ 映射表查询/写入的 service 方法。

---

### 3.1 操作区 🆕 需重构

> **重大变更**：原「单元格操作区」和「表格操作区」合并为统一的 **操作区**，根据当前选中表的字段自动识别表类型，动态展示不同的 Tab 和功能模块。

#### 3.1.1 表类型自动识别

插件通过读取当前选中表的 **字段列表（Field List）** 来判断表类型：

| 表类型 | 识别规则 | 说明 |
|---|---|---|
| **资产表** | 字段中包含 `asset_id` 或 `image_id` 等资产类标识字段 | 用于管理图片/视频等资产 |
| **生产表** | 字段中包含 `prompt`、`duration`、`model` 等生产类标识字段 | 用于管理视频生产任务 |
| **未匹配** | 上述规则均不满足 | 提示用户切换到正确的表 |

**识别逻辑**：
```
获取当前选中表的 Field 列表（通过 useTableOperations.getFieldList()）
  ↓
遍历字段名称，匹配预定义规则
  ├── 匹配到资产类字段 → 标记为「资产表」
  ├── 匹配到生产类字段 → 标记为「生产表」
  └── 均不匹配 → 标记为「未匹配」
```

> **字段匹配规则可配置**：后续可通过配置文件或后端下发规则，避免硬编码。初期使用前端硬编码的字段名进行匹配。

#### 3.1.2 Tab 布局与功能模块

根据识别出的表类型，操作区动态展示不同的 Tab：

##### 资产表 Tab 列表

| Tab | 功能模块 | 说明 | 状态 |
|---|---|---|---|
| **提取设定** | `CellOperations` | 监听选中单元格，提交提取任务 | ✅ 已实现 |
| **批量上传资产** | `BatchUploadPanel(type=asset)` | 选择数据表、上传资产文件 | ✅ 已实现 |

##### 生产表 Tab 列表

| Tab | 功能模块 | 说明 | 状态 |
|---|---|---|---|
| **提取设定** | `CellOperations` | 监听选中单元格，提交提取任务 | ✅ 已实现 |
| **批量上传 Prompt** | `BatchUploadPanel(type=prompt)` | 选择数据表、上传 Prompt 文件 | ✅ 已实现 |
| **批量生成** | `BatchGeneration` | 批量提交生产任务（调用 `FeishuCallback`） | 🆕 需新增 |

##### 未匹配

| 状态 | 展示内容 |
|---|---|
| 未匹配 | 显示 `Alert`（warning 类型），提示"当前数据表不是资产表或生产表，请切换到包含对应字段的表" |

#### 3.1.3 操作区组件构成

| 组件 | 说明 | 状态 |
|---|---|---|
| `OperationArea.tsx` | 操作区主组件，包含表类型识别 + Tab 容器 | 🆕 需新增 |
| `Tabs` (Ant Design) | Tab 切换容器 | 🆕 需新增 |
| `Tag` | 表类型标签（资产表 / 生产表 / 未匹配） | 🆕 需新增 |
| `CellOperations.tsx` | 提取设定模块（复用已有组件） | ✅ 已实现 |
| `BatchUploadPanel.tsx` | 批量上传模块（复用已有组件） | ✅ 已实现 |
| `BatchGeneration.tsx` | 批量生成模块（生产表专用） | 🆕 需新增 |
| `Alert` | Token 未配置 / 未匹配表类型时的提示 | ✅ 已实现 |

#### 3.1.4 批量生成模块（生产表专用）🆕

##### 功能描述
- 读取当前生产表中的数据行，批量提交视频生成任务。
- 调用 `outerClient.feishuCallback` 接口，传入 `SegmentInfo` 列表。
- 展示提交结果（每行的任务 ID、状态、Trace ID）。

##### 组件构成
| 组件 | 说明 | 状态 |
|---|---|---|
| `BatchGeneration.tsx` | 批量生成主组件 | 🆕 需新增 |
| `Button`（提交生成） | 收集表格数据并调用后端 | 🆕 |
| 结果列表 | 展示每行的 task_id、状态、trace_id | 🆕 |
| `Alert` | 数据校验失败时的提示 | 🆕 |

##### 数据流
```
读取生产表数据行 → 组装 SegmentInfo 列表 → 调用 feishuCallback
  → 返回 ShotAsyncRes 列表（含 task_id、状态、trace_id）
  → 展示结果
```

#### 交互约束
1. ✅ Token 未配置时，整个操作区 disabled，显示提示「请先在配置区配置 Token」。
2. 🆕 表类型识别在 tableId 变化时自动触发。
3. 🆕 Tab 切换不丢失各 Tab 内的组件状态（使用 `destroyInactiveTabPane={false}`）。
4. 🆕 表类型标签使用不同颜色区分：资产表=蓝色、生产表=绿色、未匹配=橙色。

---

## 4. 组件目录结构

```
src/
  ├── components/
  │   ├── WelcomeSection.tsx      # 🔄 欢迎区组件（合并了配置区，含问候语 + 上下文信息 + Token 配置）
  │   ├── OperationArea.tsx       # 🆕 操作区主组件（表类型识别 + Tab 容器）
  │   ├── CellOperations.tsx      # ✅ 提取设定模块
  │   ├── BatchUploadPanel.tsx    # ✅ 通用批量上传面板
  │   ├── BatchGeneration.tsx     # 🆕 批量生成模块（生产表专用）
  │   ├── TableSelector.tsx       # ✅ 数据表选择器（基于 bitable SDK）
  │   └── FileUpload.tsx          # ✅ 文件上传组件（拖拽上传 + 进度展示）
  │
  ├── contexts/
  │   └── SelectionProvider.tsx   # ✅ Selection 全局状态 Provider
  │
  ├── hooks/
  │   ├── index.ts                # ✅ hooks 导出入口
  │   ├── useSelection.ts         # ✅ Selection hook（监听选中状态变化）
  │   ├── useTableOperations.ts   # ✅ 表格操作 hook（获取字段列表/表格结构）
  │   ├── useTableType.ts         # 🆕 表类型识别 hook
  │   └── useToken.ts             # 🆕 Token 管理 hook（封装 localStorage + 映射表逻辑）
  │
  ├── utils/
  │   ├── index.ts                # ✅ utils 导出入口
  │   ├── table.ts                # ✅ 表格相关工具函数（formatCellValue）
  │   └── tableTypeRules.ts       # 🆕 表类型匹配规则定义
  │
  └── services/
      ├── index.ts                # ✅ Connect RPC 服务（含 authInterceptor）
      ├── uploadService.ts        # ✅ 上传服务
      └── tokenService.ts         # ✅ Token 映射表服务（getTokenByBaseId / setTokenByBaseId）
```

> **注意**：原独立的 `TokenConfig.tsx` 组件已合并到 `WelcomeSection.tsx` 中，不再作为独立组件存在。

---

## 5. 状态管理

| 状态 | 范围 | 存储方式 | 状态 |
|---|---|---|---|
| Token | 全局 | `localStorage` + React State（App 层面）+ 后端映射表 | ✅🔄 需增加映射表 |
| Selection 选中信息 | 全局 | React Context (`SelectionProvider`) | ✅ 已实现 |
| 当前用户 userId | 全局 | 通过 `bitable.bridge.getUserId()` 获取 | ✅ 已实现 |
| 表类型识别结果 | 组件内 | React State（`useTableType` hook） | 🆕 需新增 |
| 当前 Tab 选中状态 | 组件内 | React State | 🆕 需新增 |
| 批量生成任务状态 | 组件内 | React State | 🆕 需新增 |
| 已选数据表（上传区） | 组件内 | React State | ✅ 已实现 |
| 文件列表 & 上传状态 | 组件内 | React State | ✅ 已实现 |

### Selection Context ✅

```tsx
// 使用示例
const { state, refresh, resetCell } = useSelection();

// state 包含：
// - selectionInfo: { baseId, tableId, viewId, fieldId, recordId }
// - tableName, viewName, fieldName
// - cellValue
// - loading, cellLoading
```

### useTableType Hook 🆕

```tsx
// 使用示例
const { tableType, loading, fieldList } = useTableType();

// tableType: 'asset' | 'production' | 'unknown'
// loading: boolean — 正在加载字段列表
// fieldList: FieldInfo[] — 当前表的字段列表
```

---

## 6. 现有代码基线

### 已有文件与功能

| 文件 | 当前功能 | 状态 |
|---|---|---|
| `src/App.tsx` | 主页面：欢迎区 + 操作区 两段式布局 | 🔄 需改造 |
| `src/main.tsx` | 应用入口，包裹 SelectionProvider | ✅ 已完成 |
| `src/components/WelcomeSection.tsx` | 欢迎区组件（合并配置区，含问候语 + 上下文信息 + Token 配置） | 🔄 需改造 |
| `src/components/OperationArea.tsx` | 操作区主组件（表类型识别 + Tab 容器） | 🆕 需新增 |
| `src/components/CellOperations.tsx` | 提取设定模块 | ✅ 已完成 |
| `src/components/BatchUploadPanel.tsx` | 通用批量上传面板组件 | ✅ 已完成 |
| `src/components/BatchGeneration.tsx` | 批量生成模块（生产表专用） | 🆕 需新增 |
| `src/components/TableSelector.tsx` | 数据表选择器组件 | ✅ 已完成 |
| `src/components/FileUpload.tsx` | 文件上传组件 | ✅ 已完成 |
| `src/contexts/SelectionProvider.tsx` | Selection 全局状态 Provider | ✅ 已完成 |
| `src/hooks/useSelection.ts` | Selection hook | ✅ 已完成 |
| `src/hooks/useTableOperations.ts` | 表格操作 hook | ✅ 已完成 |
| `src/hooks/useTableType.ts` | 表类型识别 hook | 🆕 需新增 |
| `src/utils/table.ts` | 表格相关工具函数 | ✅ 已完成 |
| `src/utils/tableTypeRules.ts` | 表类型匹配规则 | 🆕 需新增 |
| `src/services/index.ts` | Connect RPC 服务 | ✅ 已完成 |
| `src/services/uploadService.ts` | 上传服务 | ✅ 已完成 |
| `src/services/tokenService.ts` | Token 映射表服务 | 🆕 需新增 |
| `generated/` | 由 proto 生成的 TypeScript Connect 代码 | ✅ |

### 改造要点

#### 已完成 ✅
1. **CellOperations.tsx** — 单元格提取设定
2. **BatchUploadPanel.tsx** — 通用批量上传面板
3. **TableSelector.tsx** — 数据表选择器
4. **FileUpload.tsx** — 文件上传组件
5. **SelectionProvider + useSelection** — 全局选中状态
6. **useTableOperations** — 表格操作能力封装
7. **services/index.ts** — authInterceptor Token 注入
8. **tokenService.ts** — Token 映射表服务

#### 需改造 🔄
1. **App.tsx** — 从三段式改为两段式（欢迎区 + 操作区），移除独立的 TokenConfig 组件
2. **WelcomeSection.tsx** — 合并配置区功能：
   - 将 Token 配置模块嵌入到"上下文信息"折叠面板中
   - **上下文信息面板默认收起**
   - 当 Token 未配置时，在欢迎区上方显示 Alert 警告

#### 需新增 🆕
1. **OperationArea.tsx** — 操作区主组件（表类型识别 + Tab 动态渲染）
2. **BatchGeneration.tsx** — 批量生成模块（生产表专用）
3. **useTableType.ts** — 表类型识别 hook
4. **useToken.ts** — Token 管理 hook（封装 localStorage + 映射表逻辑）
5. **tableTypeRules.ts** — 字段匹配规则定义
6. **后端 proto** — 新增 `getTokenByBaseId` / `setTokenByBaseId` 接口定义

#### 需删除 🗑️
1. **TokenConfig.tsx** — 原独立的配置区组件，功能已合并到 WelcomeSection.tsx

---

## 7. 技术备忘

- **base64 编码**：使用 `btoa(unescape(encodeURIComponent(str)))` 兼容中文和特殊字符。
- **Connect Interceptor**：`@connectrpc/connect` 的 `Interceptor` 类型，签名为 `(next) => async (req) => { ... return next(req); }`。
- **Bitable SDK 数据表列表**：`bitable.base.getTableList()` 返回 Table 对象数组，通过 `bitable.base.getTableMetaById(table.id)` 获取表名。
- **Bitable SDK 选中监听**：`bitable.base.onSelectionChange(callback)` 监听选中变化。
- **Bitable SDK 字段列表**：`table.getFieldMetaList()` 返回 `IFieldMeta[]`，包含 `id`、`name`、`type`、`isPrimary` 等属性。
- **localStorage Key**：`kmood_token`。
- **表类型识别**：通过字段名称匹配，规则定义在 `utils/tableTypeRules.ts` 中，后续可改为后端下发。

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

### useTableType 🆕

表类型自动识别 hook。

```tsx
const { tableType, loading, fieldList, refresh } = useTableType();
```

| 属性/方法 | 类型 | 说明 |
|---|---|---|
| `tableType` | `'asset' \| 'production' \| 'unknown'` | 当前表的识别类型 |
| `loading` | `boolean` | 是否正在识别中 |
| `fieldList` | `FieldInfo[]` | 当前表的字段列表 |
| `refresh()` | `() => Promise<void>` | 手动重新识别 |

---

## 9. 表类型匹配规则

### 资产表识别字段

以下字段名称（不区分大小写）出现任意一个即判定为资产表：

| 字段名 | 说明 |
|---|---|
| `asset_id` | 资产 ID |
| `image_id` | 图片 ID |
| `asset_pri_id` | 资产主键 ID |
| `资产ID` | 中文资产 ID |
| `图片ID` | 中文图片 ID |

### 生产表识别字段

以下字段名称（不区分大小写）出现 **至少两个** 即判定为生产表：

| 字段名 | 说明 |
|---|---|
| `prompt` | 提示词 |
| `duration` | 时长 |
| `model` | 模型 |
| `quality` | 质量 |
| `mode_ch` | 模式（中文） |
| `ratio` | 比例 |
| `resolution` | 分辨率 |

> **优先级**：若同时匹配到资产表和生产表字段，优先判定为生产表（生产表通常也包含资产字段）。

---

## 变更日志

| 日期 | 内容 |
|---|---|
| 2026-03-26 | 初始版本：定义配置区、批量上传资产区、批量上传 Prompt 区三段式布局需求 |
| 2026-03-26 | 功能完成：标注所有已完成功能，更新组件构成，补充新增组件说明（欢迎区、单元格操作区、Hooks、Contexts、Utils） |
| 2026-03-27 | **重大重构**：页面结构从四段式改为三段式（欢迎区 + 配置区 + 操作区）；配置区增加 BaseID-Token 映射表缓存机制；操作区改为根据表字段自动识别表类型（资产表/生产表/未匹配），动态展示不同 Tab 和功能模块；新增批量生成模块、useTableType hook、表类型匹配规则 |
| 2026-03-27 | **布局精简**：页面从三段式改为两段式（欢迎区 + 操作区）；配置区合并到欢迎区的"上下文信息"折叠面板中；上下文信息默认收起；Token 未配置时在欢迎区上方显示警告提示；删除独立的 TokenConfig 组件 |
