/**
 * Token 映射表服务
 * 提供 BaseID-Token 映射的查询功能
 *
 * 从 Vite 环境变量读取映射表（构建时已静态注入）
 * 不同环境使用不同配置：
 *   - npm run dev       → .env.development
 *   - npm run build     → .env (生产)
 *   - npm run build:test → .env.test (测试)
 */

export interface TokenMappingResult {
  success: boolean;
  token?: string;
  error?: string;
}

// 从环境变量读取映射表（Vite 构建时会将 VITE_* 变量静态替换到代码中）
const tokenCache: Record<string, string> = JSON.parse(
  import.meta.env.VITE_TOKEN_MAPPING || "{}"
);

// 打印加载信息（仅首次）
let loggedOnce = false;
function logInit(): void {
  if (loggedOnce) return;
  console.log(
    "[tokenService] 已加载静态 Token 映射表:",
    Object.keys(tokenCache).length,
    "条记录"
  );
  loggedOnce = true;
}

/**
 * 根据 BaseID 从映射表查询 Token
 * @param baseId Base ID
 * @returns Token 查询结果
 */
export async function getTokenByBaseId(
  baseId: string
): Promise<TokenMappingResult> {
  if (!baseId) {
    return { success: false, error: "BaseID 不能为空" };
  }

  logInit();

  const token = tokenCache[baseId];
  if (token) {
    console.log(`[tokenService] getTokenByBaseId: ${baseId} -> 已找到`);
    return { success: true, token };
  }

  console.log(`[tokenService] getTokenByBaseId: ${baseId} -> 未找到`);
  return { success: false, error: "未找到对应的 Token" };
}
