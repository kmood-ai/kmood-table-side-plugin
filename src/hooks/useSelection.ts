import { createContext, useContext } from "react";

/** SDK 选中信息类型 */
export interface SelectionInfo {
  baseId: string | null;
  tableId: string | null;
  viewId: string | null;
  fieldId: string | null;
  recordId: string | null;
}

/** Selection 状态 */
export interface SelectionState {
  /** 选中信息 */
  selectionInfo: SelectionInfo;
  /** 数据表名称 */
  tableName: string;
  /** 数据表 Token */
  tableToken: string;
  /** 视图名称 */
  viewName: string;
  /** 字段名称 */
  fieldName: string;
  /** 单元格值 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cellValue: any;
  /** 是否正在加载选中信息 */
  loading: boolean;
  /** 是否正在加载单元格值 */
  cellLoading: boolean;
}

/** Action 类型 */
type SelectionAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_CELL_LOADING"; payload: boolean }
  | { type: "SET_SELECTION_INFO"; payload: SelectionInfo }
  | { type: "SET_TABLE_NAME"; payload: string }
  | { type: "SET_TABLE_TOKEN"; payload: string }
  | { type: "SET_VIEW_NAME"; payload: string }
  | { type: "SET_FIELD_NAME"; payload: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: "SET_CELL_VALUE"; payload: any }
  | { type: "RESET_CELL"; payload?: void }
  | { type: "BATCH_UPDATE"; payload: Partial<SelectionState> };

/** 初始状态 */
export const initialState: SelectionState = {
  selectionInfo: {
    baseId: null,
    tableId: null,
    viewId: null,
    fieldId: null,
    recordId: null,
  },
  tableName: "",
  tableToken: "",
  viewName: "",
  fieldName: "",
  cellValue: null,
  loading: true,
  cellLoading: false,
};

/** Reducer */
export function selectionReducer(
  state: SelectionState,
  action: SelectionAction
): SelectionState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_CELL_LOADING":
      return { ...state, cellLoading: action.payload };
    case "SET_SELECTION_INFO":
      return { ...state, selectionInfo: action.payload };
    case "SET_TABLE_NAME":
      return { ...state, tableName: action.payload };
    case "SET_TABLE_TOKEN":
      return { ...state, tableToken: action.payload };
    case "SET_VIEW_NAME":
      return { ...state, viewName: action.payload };
    case "SET_FIELD_NAME":
      return { ...state, fieldName: action.payload };
    case "SET_CELL_VALUE":
      return { ...state, cellValue: action.payload };
    case "RESET_CELL":
      return { ...state, cellValue: null, fieldName: "" };
    case "BATCH_UPDATE":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

/** Context 类型 */
export interface SelectionContextType {
  state: SelectionState;
  /** 刷新选中信息 */
  refresh: () => Promise<void>;
  /** 重置单元格信息 */
  resetCell: () => void;
}

/** Context */
export const SelectionContext = createContext<SelectionContextType | null>(
  null
);

/**
 * useSelection Hook
 * 获取全局选中状态和操作方法
 */
export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return context;
}

export default useSelection;
