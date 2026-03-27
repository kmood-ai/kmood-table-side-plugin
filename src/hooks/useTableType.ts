import { useState, useEffect, useCallback } from 'react';
import { useSelection, type FieldInfo } from './index';
import { useTableOperations } from './useTableOperations';
import { identifyTableType, type TableType } from '../utils/tableTypeRules';

export interface UseTableTypeResult {
  /** 当前表的识别类型 */
  tableType: TableType;
  /** 是否正在识别中 */
  loading: boolean;
  /** 当前表的字段列表 */
  fieldList: FieldInfo[];
  /** 手动重新识别 */
  refresh: () => Promise<void>;
}

/**
 * useTableType Hook
 * 自动识别当前选中表的类型（资产表/生产表/未匹配）
 * 
 * 识别逻辑：
 * - 监听 tableId 变化，自动获取字段列表
 * - 根据字段名称匹配预定义规则
 * - 返回识别结果
 */
export function useTableType(): UseTableTypeResult {
  const { state } = useSelection();
  const { getFieldList } = useTableOperations();
  const [tableType, setTableType] = useState<TableType>('unknown');
  const [loading, setLoading] = useState(false);
  const [fieldList, setFieldList] = useState<FieldInfo[]>([]);

  const tableId = state.selectionInfo.tableId;

  /**
   * 执行表类型识别
   */
  const identifyType = useCallback(async () => {
    if (!tableId) {
      setTableType('unknown');
      setFieldList([]);
      return;
    }

    setLoading(true);
    try {
      const fields = await getFieldList();
      setFieldList(fields);

      // 提取字段名称列表
      const fieldNames = fields.map((f) => f.name);
      
      // 识别表类型
      const type = identifyTableType(fieldNames);
      setTableType(type);
    } catch (error) {
      console.error('useTableType: 识别表类型失败', error);
      setTableType('unknown');
      setFieldList([]);
    } finally {
      setLoading(false);
    }
  }, [tableId, getFieldList]);

  /**
   * 手动刷新
   */
  const refresh = useCallback(async () => {
    await identifyType();
  }, [identifyType]);

  // tableId 变化时自动识别
  useEffect(() => {
    identifyType();
  }, [identifyType]);

  return {
    tableType,
    loading,
    fieldList,
    refresh,
  };
}

export default useTableType;
export type { TableType };
