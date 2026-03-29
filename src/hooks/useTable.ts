import { useCallback } from "react";
import {
  bitable,
  type IFieldMeta,
  type IRecord,
  type ICell,
  FieldType,
  type IOpenCellValue,
  type IAddFieldConfig,
  type IFieldRes,
} from "@lark-base-open/js-sdk";
import { useSelection } from "./useSelection";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 字段信息类型
 */
export interface FieldInfo {
  id: string;
  name: string;
  type: FieldType;
  isPrimary: boolean;
  description?: string;
}

/**
 * 单元格信息类型
 */
export interface CellInfo {
  /** 字段 ID */
  fieldId: string;
  /** 字段名称 */
  fieldName: string;
  /** 字段类型 */
  fieldType: FieldType;
  /** 单元格值 */
  value: IOpenCellValue;
}

/**
 * 记录信息类型
 */
export interface RecordInfo {
  /** 记录 ID */
  recordId: string;
  /** 字段值映射 (fieldId -> value) */
  fields: Record<string, IOpenCellValue>;
}

/**
 * 新增字段的配置
 */
export interface AddFieldConfig {
  /** 字段名称 */
  name: string;
  /** 字段类型 */
  type: FieldType;
  /** 字段描述 */
  description?: string;
  /** 字段属性（不同类型有不同的属性配置） */
  property?: Record<string, unknown>;
}

/**
 * 更新字段的配置
 */
export interface UpdateFieldConfig {
  /** 新字段名称 */
  name?: string;
  /** 字段描述 */
  description?: string;
  /** 字段属性 */
  property?: Record<string, unknown>;
}

/**
 * 新增记录的配置
 */
export interface AddRecordConfig {
  /** 字段值映射 (fieldId -> value) */
  fields: Record<string, IOpenCellValue>;
}

/**
 * 更新记录的配置
 */
export interface UpdateRecordConfig {
  /** 记录 ID */
  recordId: string;
  /** 字段值映射 (fieldId -> value) */
  fields: Record<string, IOpenCellValue>;
}

/**
 * 批量操作结果
 */
export interface BatchResult {
  /** 成功的 ID 列表 */
  successIds: string[];
  /** 失败的 ID 及错误信息 */
  failedIds: { id: string; error: string }[];
}

// ============================================================================
// useTable Hook
// ============================================================================

/**
 * useTable Hook
 * 提供通用的表格读取和写入操作
 */
export function useTable() {
  const { state } = useSelection();
  const { selectionInfo } = state;

  // ==========================================================================
  // 内部工具方法
  // ==========================================================================

  /**
   * 获取表格实例
   */
  const getTable = useCallback(async (tableId: string) => {
    if (!tableId) {
      throw new Error("tableId 不能为空");
    }
    return await bitable.base.getTableById(tableId);
  }, []);

  /**
   * 获取当前选中的表格实例
   */
  const getCurrentTable = useCallback(async () => {
    const { tableId } = selectionInfo;
    if (!tableId) {
      throw new Error("当前未选中任何表格");
    }
    return await getTable(tableId);
  }, [selectionInfo, getTable]);

  // ==========================================================================
  // 读取功能
  // ==========================================================================

  /**
   * 1. 读取特定表格的 field list
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 字段信息数组
   */
  const getFieldList = useCallback(
    async (tableId?: string): Promise<IFieldMeta[]> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          console.warn("useTable.getFieldList: 未指定表格 ID 且当前未选中表格");
          return [];
        }

        const table = await getTable(targetTableId);
        const fieldMetaList: IFieldMeta[] = await table.getFieldMetaList();

        return fieldMetaList;
      } catch (error) {
        console.error("useTable.getFieldList: 获取字段列表失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 2. 读取特定表格全部内容
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 所有记录信息数组
   */
  const getAllRecords = useCallback(
    async (tableId?: string): Promise<RecordInfo[]> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          console.warn(
            "useTable.getAllRecords: 未指定表格 ID 且当前未选中表格"
          );
          return [];
        }

        const table = await getTable(targetTableId);
        const recordIdList = await table.getRecordIdList();
        const records: RecordInfo[] = [];

        // 获取字段列表用于遍历
        const fieldMetaList = await table.getFieldMetaList();
        const fieldIds = fieldMetaList.map((f) => f.id);

        // 逐条获取记录
        for (const recordId of recordIdList) {
          const fields: Record<string, IOpenCellValue> = {};
          for (const fieldId of fieldIds) {
            const value = await table.getCellValue(fieldId, recordId);
            fields[fieldId] = value;
          }
          records.push({ recordId, fields });
        }

        return records;
      } catch (error) {
        console.error("useTable.getAllRecords: 获取全部记录失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 3. 读取特定表格特定行（或指定行 list）的内容
   * @param recordIds 记录 ID 或记录 ID 列表
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 记录信息数组
   */
  const getRecords = useCallback(
    async (
      recordIds: string | string[],
      tableId?: string
    ): Promise<RecordInfo[]> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          console.warn("useTable.getRecords: 未指定表格 ID 且当前未选中表格");
          return [];
        }

        const recordIdList = Array.isArray(recordIds) ? recordIds : [recordIds];
        if (recordIdList.length === 0) {
          return [];
        }

        const table = await getTable(targetTableId);
        const fieldMetaList = await table.getFieldMetaList();
        const fieldIds = fieldMetaList.map((f) => f.id);
        const records: RecordInfo[] = [];

        for (const recordId of recordIdList) {
          const fields: Record<string, IOpenCellValue> = {};
          for (const fieldId of fieldIds) {
            const value = await table.getCellValue(fieldId, recordId);
            fields[fieldId] = value;
          }
          records.push({ recordId, fields });
        }

        return records;
      } catch (error) {
        console.error("useTable.getRecords: 获取记录失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 3.1 读取单条记录
   * @param recordId 记录 ID
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 记录信息
   */
  const getRecord = useCallback(
    async (recordId: string, tableId?: string): Promise<RecordInfo | null> => {
      const records = await getRecords(recordId, tableId);
      return records.length > 0 ? records[0] : null;
    },
    [getRecords]
  );

  /**
   * 4. 读取特定单元格的 type 和内容
   * @param fieldId 字段 ID
   * @param recordId 记录 ID
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 单元格信息
   */
  const getCell = useCallback(
    async (
      fieldId: string,
      recordId: string,
      tableId?: string
    ): Promise<CellInfo | null> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          console.warn("useTable.getCell: 未指定表格 ID 且当前未选中表格");
          return null;
        }

        const table = await getTable(targetTableId);
        const fieldMeta = await table.getFieldMetaById(fieldId);
        const value = await table.getCellValue(fieldId, recordId);

        return {
          fieldId,
          fieldName: fieldMeta.name,
          fieldType: fieldMeta.type,
          value,
        };
      } catch (error) {
        console.error("useTable.getCell: 获取单元格失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 4.1 获取当前选中的单元格信息
   * @returns 单元格信息
   */
  const getCurrentCell = useCallback(async (): Promise<CellInfo | null> => {
    const { tableId, fieldId, recordId } = selectionInfo;
    if (!tableId || !fieldId || !recordId) {
      console.warn("useTable.getCurrentCell: 当前未选中单元格");
      return null;
    }
    return await getCell(fieldId, recordId, tableId);
  }, [selectionInfo, getCell]);

  // ==========================================================================
  // 写入功能
  // ==========================================================================

  /**
   * 1.1 更新字段名称
   * @param fieldId 字段 ID
   * @param newName 新字段名称
   * @param tableId 表格 ID，不传则使用当前选中的表格
   */
  const updateFieldName = useCallback(
    async (
      fieldId: string,
      newName: string,
      tableId?: string
    ): Promise<void> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          throw new Error("未指定表格 ID 且当前未选中表格");
        }

        const table = await getTable(targetTableId);
        const field = await table.getFieldById(fieldId);
        await field.setValue(fieldId, newName);
      } catch (error) {
        console.error("useTable.updateFieldName: 更新字段名称失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 1.2 新增字段
   * @param config 字段配置
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 新增字段的 ID
   */
  const addField = useCallback(
    async (config: IAddFieldConfig, tableId?: string): Promise<IFieldRes> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          throw new Error("未指定表格 ID 且当前未选中表格");
        }

        const table = await getTable(targetTableId);
        const field = await table.addField(config);

        return field;
      } catch (error) {
        console.error("useTable.addField: 新增字段失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 1.3 更新字段配置
   * @param fieldId 字段 ID
   * @param config 更新配置
   * @param tableId 表格 ID，不传则使用当前选中的表格
   */
  const updateField = useCallback(
    async (
      fieldId: string,
      config: UpdateFieldConfig,
      tableId?: string
    ): Promise<void> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          throw new Error("未指定表格 ID 且当前未选中表格");
        }

        const table = await getTable(targetTableId);
        const field = await table.getFieldById(fieldId);

        // 更新名称
        if (config.name !== undefined) {
          await field.setValue(fieldId, config.name);
        }
      } catch (error) {
        console.error("useTable.updateField: 更新字段失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 2. 更新指定表格指定行的内容
   * @param recordId 记录 ID
   * @param fields 字段值映射 (fieldId -> value)
   * @param tableId 表格 ID，不传则使用当前选中的表格
   */
  const updateRecord = useCallback(
    async (
      recordId: string,
      fields: Record<string, IOpenCellValue>,
      tableId?: string
    ): Promise<void> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          throw new Error("未指定表格 ID 且当前未选中表格");
        }

        const table = await getTable(targetTableId);
        await table.setRecord(recordId, { fields });
      } catch (error) {
        console.error("useTable.updateRecord: 更新记录失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 2.1 批量更新记录
   * @param records 更新配置数组
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 批量操作结果
   */
  const updateRecords = useCallback(
    async (
      records: UpdateRecordConfig[],
      tableId?: string
    ): Promise<BatchResult> => {
      const targetTableId = tableId || selectionInfo.tableId;
      if (!targetTableId) {
        throw new Error("未指定表格 ID 且当前未选中表格");
      }

      const table = await getTable(targetTableId);
      const successIds: string[] = [];
      const failedIds: { id: string; error: string }[] = [];

      for (const record of records) {
        try {
          await table.setRecord(record.recordId, { fields: record.fields });
          successIds.push(record.recordId);
        } catch (error) {
          failedIds.push({
            id: record.recordId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return { successIds, failedIds };
    },
    [selectionInfo, getTable]
  );

  /**
   * 3. 新增 record
   * @param fields 字段值映射 (fieldId -> value)
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 新增记录的 ID
   */
  const addRecord = useCallback(
    async (
      fields: Record<string, IOpenCellValue>,
      tableId?: string
    ): Promise<string> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          throw new Error("未指定表格 ID 且当前未选中表格");
        }

        const table = await getTable(targetTableId);
        const recordId = await table.addRecord({ fields });
        return recordId;
      } catch (error) {
        console.error("useTable.addRecord: 新增记录失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 3.1 批量新增记录
   * @param recordsList 字段值映射数组
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 新增记录的 ID 数组
   */
  const addRecords = useCallback(
    async (
      recordsList: Record<string, IOpenCellValue>[],
      tableId?: string
    ): Promise<string[]> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          throw new Error("未指定表格 ID 且当前未选中表格");
        }

        const table = await getTable(targetTableId);
        const records = recordsList.map((fields) => ({ fields }));
        const recordIds = await table.addRecords(records);
        return recordIds;
      } catch (error) {
        console.error("useTable.addRecords: 批量新增记录失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 4. 写指定单元格的内容
   * @param fieldId 字段 ID
   * @param recordId 记录 ID
   * @param value 单元格值
   * @param tableId 表格 ID，不传则使用当前选中的表格
   */
  const setCell = useCallback(
    async (
      fieldId: string,
      recordId: string,
      value: IOpenCellValue,
      tableId?: string
    ): Promise<void> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          throw new Error("未指定表格 ID 且当前未选中表格");
        }

        const table = await getTable(targetTableId);
        await table.setCellValue(fieldId, recordId, value);
      } catch (error) {
        console.error("useTable.setCell: 写入单元格失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 4.1 写入当前选中的单元格
   * @param value 单元格值
   */
  const setCurrentCell = useCallback(
    async (value: IOpenCellValue): Promise<void> => {
      const { tableId, fieldId, recordId } = selectionInfo;
      if (!tableId || !fieldId || !recordId) {
        throw new Error("当前未选中单元格");
      }
      await setCell(fieldId, recordId, value, tableId);
    },
    [selectionInfo, setCell]
  );

  // ==========================================================================
  // 删除功能（额外提供）
  // ==========================================================================

  /**
   * 删除字段
   * @param fieldId 字段 ID
   * @param tableId 表格 ID，不传则使用当前选中的表格
   */
  const deleteField = useCallback(
    async (fieldId: string, tableId?: string): Promise<void> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          throw new Error("未指定表格 ID 且当前未选中表格");
        }

        const table = await getTable(targetTableId);
        await table.deleteField(fieldId);
      } catch (error) {
        console.error("useTable.deleteField: 删除字段失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 删除记录
   * @param recordId 记录 ID
   * @param tableId 表格 ID，不传则使用当前选中的表格
   */
  const deleteRecord = useCallback(
    async (recordId: string, tableId?: string): Promise<void> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          throw new Error("未指定表格 ID 且当前未选中表格");
        }

        const table = await getTable(targetTableId);
        await table.deleteRecord(recordId);
      } catch (error) {
        console.error("useTable.deleteRecord: 删除记录失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 批量删除记录
   * @param recordIds 记录 ID 数组
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 批量操作结果
   */
  const deleteRecords = useCallback(
    async (recordIds: string[], tableId?: string): Promise<BatchResult> => {
      const targetTableId = tableId || selectionInfo.tableId;
      if (!targetTableId) {
        throw new Error("未指定表格 ID 且当前未选中表格");
      }

      const table = await getTable(targetTableId);
      const successIds: string[] = [];
      const failedIds: { id: string; error: string }[] = [];

      for (const recordId of recordIds) {
        try {
          await table.deleteRecord(recordId);
          successIds.push(recordId);
        } catch (error) {
          failedIds.push({
            id: recordId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return { successIds, failedIds };
    },
    [selectionInfo, getTable]
  );

  // ==========================================================================
  // 辅助功能
  // ==========================================================================

  /**
   * 获取表格记录总数
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 记录总数
   */
  const getRecordCount = useCallback(
    async (tableId?: string): Promise<number> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          return 0;
        }

        const table = await getTable(targetTableId);
        const recordIdList = await table.getRecordIdList();
        return recordIdList.length;
      } catch (error) {
        console.error("useTable.getRecordCount: 获取记录总数失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 获取表格所有记录 ID
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 记录 ID 数组
   */
  const getRecordIdList = useCallback(
    async (tableId?: string): Promise<string[]> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          return [];
        }

        const table = await getTable(targetTableId);
        return await table.getRecordIdList();
      } catch (error) {
        console.error("useTable.getRecordIdList: 获取记录 ID 列表失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  /**
   * 根据字段名称获取字段 ID
   * @param fieldName 字段名称
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 字段 ID，未找到返回 null
   */
  const getFieldIdByName = useCallback(
    async (fieldName: string, tableId?: string): Promise<string | null> => {
      try {
        const fields = await getFieldList(tableId);
        const field = fields.find((f) => f.name === fieldName);
        return field ? field.id : null;
      } catch (error) {
        console.error("useTable.getFieldIdByName: 查找字段失败", error);
        throw error;
      }
    },
    [getFieldList]
  );

  /**
   * 根据字段 ID 获取字段信息
   * @param fieldId 字段 ID
   * @param tableId 表格 ID，不传则使用当前选中的表格
   * @returns 字段信息
   */
  const getFieldById = useCallback(
    async (fieldId: string, tableId?: string): Promise<FieldInfo | null> => {
      try {
        const targetTableId = tableId || selectionInfo.tableId;
        if (!targetTableId) {
          return null;
        }

        const table = await getTable(targetTableId);
        const fieldMeta = await table.getFieldMetaById(fieldId);

        return {
          id: fieldMeta.id,
          name: fieldMeta.name,
          type: fieldMeta.type,
          isPrimary: fieldMeta.isPrimary || false,
          // description: fieldMeta.description,
        };
      } catch (error) {
        console.error("useTable.getFieldById: 获取字段信息失败", error);
        throw error;
      }
    },
    [selectionInfo, getTable]
  );

  // ==========================================================================
  // 返回值
  // ==========================================================================

  return {
    // 当前选中信息
    /** 当前选中的表格 ID */
    currentTableId: selectionInfo.tableId,
    /** 当前选中的字段 ID */
    currentFieldId: selectionInfo.fieldId,
    /** 当前选中的记录 ID */
    currentRecordId: selectionInfo.recordId,
    getTable,

    // 读取功能
    /** 获取字段列表 */
    getFieldList,
    /** 获取全部记录 */
    getAllRecords,
    /** 获取指定记录（支持单条或多条） */
    getRecords,
    /** 获取单条记录 */
    getRecord,
    /** 获取单元格信息 */
    getCell,
    /** 获取当前选中的单元格信息 */
    getCurrentCell,

    // 写入功能 - 字段
    /** 更新字段名称 */
    updateFieldName,
    /** 新增字段 */
    addField,
    /** 更新字段配置 */
    updateField,
    /** 删除字段 */
    deleteField,

    // 写入功能 - 记录
    /** 更新单条记录 */
    updateRecord,
    /** 批量更新记录 */
    updateRecords,
    /** 新增单条记录 */
    addRecord,
    /** 批量新增记录 */
    addRecords,
    /** 删除单条记录 */
    deleteRecord,
    /** 批量删除记录 */
    deleteRecords,

    // 写入功能 - 单元格
    /** 写入单元格 */
    setCell,
    /** 写入当前选中的单元格 */
    setCurrentCell,

    // 辅助功能
    /** 获取记录总数 */
    getRecordCount,
    /** 获取记录 ID 列表 */
    getRecordIdList,
    /** 根据字段名称获取字段 ID */
    getFieldIdByName,
    /** 根据字段 ID 获取字段信息 */
    getFieldById,
  };
}

export default useTable;
