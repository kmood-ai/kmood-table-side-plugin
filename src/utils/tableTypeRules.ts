/**
 * 表类型匹配规则定义
 * 根据字段名称判断表的类型
 */

export type TableType = "asset" | "production" | "unknown";
export type TableTypeLabelKey = "tableType.asset" | "tableType.production" | "tableType.unknown";

/**
 * 资产表识别字段（不区分大小写）
 * 出现任意一个即判定为资产表
 */
export const ASSET_TABLE_FIELDS = ["name", "资产ID", "资产id"];

/**
 * 生产表识别字段（不区分大小写）
 * 需要匹配至少两个字段才判定为生产表
 */
export const PRODUCTION_TABLE_FIELDS = ["prompt"];

/**
 * 生产表最少匹配字段数
 */
export const PRODUCTION_MIN_MATCH_COUNT = 1;

/**
 * 判断字段名是否匹配目标字段列表（不区分大小写）
 */
function matchFieldName(fieldName: string, targetFields: string[]): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return targetFields.some((target) => target.toLowerCase() === lowerFieldName);
}

/**
 * 根据字段列表识别表类型
 * @param fieldNames 字段名称列表
 * @returns 表类型：'asset' | 'production' | 'unknown'
 *
 * 规则：
 * - 若同时匹配到资产表和生产表字段，优先判定为生产表
 * - 资产表：字段中包含任意一个资产类标识字段
 * - 生产表：字段中包含至少两个生产类标识字段
 */
export function identifyTableType(fieldNames: string[]): TableType {
  // 计算生产表字段匹配数量
  const productionMatchCount = fieldNames.filter((name) =>
    matchFieldName(name, PRODUCTION_TABLE_FIELDS)
  ).length;

  // 检查是否匹配资产表字段
  const hasAssetField = fieldNames.some((name) =>
    matchFieldName(name, ASSET_TABLE_FIELDS)
  );

  // 优先判定为生产表（生产表通常也包含资产字段）
  if (productionMatchCount >= PRODUCTION_MIN_MATCH_COUNT) {
    return "production";
  }

  // 其次判定为资产表
  if (hasAssetField) {
    return "asset";
  }

  // 均不匹配
  return "unknown";
}

/**
 * 获取表类型的显示名称
 */
export function getTableTypeLabel(type: TableType): string {
  const labels: Record<TableType, string> = {
    asset: "资产表",
    production: "生产表",
    unknown: "未匹配",
  };
  return labels[type];
}

export function getTableTypeLabelKey(type: TableType): TableTypeLabelKey {
  const keys: Record<TableType, TableTypeLabelKey> = {
    asset: "tableType.asset",
    production: "tableType.production",
    unknown: "tableType.unknown",
  };
  return keys[type];
}

/**
 * 获取表类型对应的颜色
 */
export function getTableTypeColor(type: TableType): string {
  const colors: Record<TableType, string> = {
    asset: "blue",
    production: "green",
    unknown: "orange",
  };
  return colors[type];
}
