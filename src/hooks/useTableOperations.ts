import { useCallback } from "react";
import { bitable, type IFieldMeta, type ITableMeta } from "@lark-base-open/js-sdk";
import { useSelection } from "./useSelection";

/**
 * 字段信息类型
 */
export interface FieldInfo {
  id: string;
  name: string;
  type: number;
  isPrimary: boolean;
  description?: string;
}

/**
 * 表格节点类型（用于表格组织结构）
 */
export interface TableNode {
  id: string;
  name: string;
  type: "table";
}

/**
 * 文件夹节点类型
 */
export interface FolderNode {
  id: string;
  name: string;
  type: "folder";
  children: (TableNode | FolderNode)[];
}

/**
 * 表格结构类型（树形结构）
 */
export type TableStructureNode = TableNode | FolderNode;

/**
 * 表格结构返回类型
 */
export interface TableStructure {
  /** 根节点列表（包含文件夹和表格） */
  nodes: TableStructureNode[];
  /** 所有表格的扁平列表（方便快速查找） */
  allTables: TableNode[];
}

/**
 * useTableOperations Hook
 * 封装飞书多维表格的操作能力
 */
export function useTableOperations() {
  const { state } = useSelection();
  const { selectionInfo } = state;

  /**
   * 获取当前选中表格的字段列表
   * @returns 字段信息数组
   */
  const getFieldList = useCallback(async (): Promise<FieldInfo[]> => {
    const { tableId } = selectionInfo;

    if (!tableId) {
      console.warn("useTableOperations.getFieldList: 当前未选中任何表格");
      return [];
    }

    try {
      const table = await bitable.base.getTableById(tableId);
      const fieldMetaList: IFieldMeta[] = await table.getFieldMetaList();

      return fieldMetaList.map((meta) => ({
        id: meta.id,
        name: meta.name,
        type: meta.type,
        isPrimary: meta.isPrimary || false,
        description: meta.description,
      }));
    } catch (error) {
      console.error("useTableOperations.getFieldList: 获取字段列表失败", error);
      throw error;
    }
  }, [selectionInfo]);

  /**
   * 根据表格 ID 获取字段列表
   * @param tableId 表格 ID
   * @returns 字段信息数组
   */
  const getFieldListByTableId = useCallback(
    async (tableId: string): Promise<FieldInfo[]> => {
      if (!tableId) {
        console.warn(
          "useTableOperations.getFieldListByTableId: tableId 不能为空"
        );
        return [];
      }

      try {
        const table = await bitable.base.getTableById(tableId);
        const fieldMetaList: IFieldMeta[] = await table.getFieldMetaList();

        return fieldMetaList.map((meta) => ({
          id: meta.id,
          name: meta.name,
          type: meta.type,
          isPrimary: meta.isPrimary || false,
          description: meta.description,
        }));
      } catch (error) {
        console.error(
          "useTableOperations.getFieldListByTableId: 获取字段列表失败",
          error
        );
        throw error;
      }
    },
    []
  );

  /**
   * 获取当前 base 下的表格组织结构
   * 注意：飞书 Bitable SDK 目前不直接支持获取文件夹层级结构，
   * 此方法返回扁平的表格列表，但预留了层级结构的类型定义以备后续扩展
   * @returns 表格结构信息
   */
  const getTableStructure = useCallback(async (): Promise<TableStructure> => {
    try {
      const tableList = await bitable.base.getTableList();
      const allTables: TableNode[] = [];
      const nodes: TableStructureNode[] = [];

      // 获取所有表格的元信息
      for (const table of tableList) {
        const tableMeta: ITableMeta = await bitable.base.getTableMetaById(
          table.id
        );
        const tableNode: TableNode = {
          id: table.id,
          name: tableMeta.name,
          type: "table",
        };
        allTables.push(tableNode);
        nodes.push(tableNode);
      }

      return {
        nodes,
        allTables,
      };
    } catch (error) {
      console.error(
        "useTableOperations.getTableStructure: 获取表格结构失败",
        error
      );
      throw error;
    }
  }, []);

  /**
   * 获取指定表格的元信息
   * @param tableId 表格 ID
   * @returns 表格元信息
   */
  const getTableMeta = useCallback(
    async (tableId: string): Promise<ITableMeta | null> => {
      if (!tableId) {
        console.warn("useTableOperations.getTableMeta: tableId 不能为空");
        return null;
      }

      try {
        return await bitable.base.getTableMetaById(tableId);
      } catch (error) {
        console.error("useTableOperations.getTableMeta: 获取表格元信息失败", error);
        throw error;
      }
    },
    []
  );

  /**
   * 获取当前选中的表格 ID
   */
  const currentTableId = selectionInfo.tableId;

  /**
   * 获取当前选中的 base ID
   */
  const currentBaseId = selectionInfo.baseId;

  return {
    /** 获取当前选中表格的字段列表 */
    getFieldList,
    /** 根据表格 ID 获取字段列表 */
    getFieldListByTableId,
    /** 获取当前 base 下的表格组织结构 */
    getTableStructure,
    /** 获取指定表格的元信息 */
    getTableMeta,
    /** 当前选中的表格 ID */
    currentTableId,
    /** 当前选中的 base ID */
    currentBaseId,
  };
}

export default useTableOperations;
