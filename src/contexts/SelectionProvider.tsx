import { type ReactNode, useReducer, useCallback, useEffect } from "react";
import type { SelectionInfo } from "../hooks";
import { selectionReducer, initialState, type SelectionContextType, SelectionContext } from "../hooks/useSelection";
import { bitable } from '@lark-base-open/js-sdk';

/** 从 URL 中解析 table_token */
function parseTableTokenFromUrl(url: string): string {
    try {
        const pathname = url || window.location.pathname;
        // 匹配 /wiki/{token} 或 /base/{token}
        const match = pathname.match(/\/(wiki|base)\/([^/?]+)/);
        return match ? match[2] : "";
    } catch {
        return "";
    }
}

/** Provider Props */
interface SelectionProviderProps {
    children: ReactNode;
}

/**
 * Selection Provider
 * 提供全局的选中状态管理
 */
export function SelectionProvider({ children }: SelectionProviderProps) {
    const [state, dispatch] = useReducer(selectionReducer, initialState);

    /** 获取 Table 和 View 名称 */
    const fetchNames = useCallback(async (tableId: string | null, viewId: string | null) => {
        if (tableId) {
            try {
                const tableMeta = await bitable.base.getTableMetaById(tableId);
                dispatch({ type: 'SET_TABLE_NAME', payload: tableMeta.name });
            } catch {
                dispatch({ type: 'SET_TABLE_NAME', payload: '' });
            }
        } else {
            dispatch({ type: 'SET_TABLE_NAME', payload: '' });
        }

        if (tableId && viewId) {
            try {
                const table = await bitable.base.getTableById(tableId);
                const view = await table.getViewById(viewId);
                const viewMeta = await view.getMeta();
                dispatch({ type: 'SET_VIEW_NAME', payload: viewMeta.name });
            } catch {
                dispatch({ type: 'SET_VIEW_NAME', payload: '' });
            }
        } else {
            dispatch({ type: 'SET_VIEW_NAME', payload: '' });
        }
    }, []);

    /** 获取单元格值 */
    const fetchCellValue = useCallback(async (tableId: string | null, fieldId: string | null, recordId: string | null) => {
        if (tableId && fieldId && recordId) {
            dispatch({ type: 'SET_CELL_LOADING', payload: true });
            try {
                const table = await bitable.base.getTableById(tableId);
                const field = await table.getFieldById(fieldId);
                const fieldMeta = await field.getMeta();
                dispatch({ type: 'SET_FIELD_NAME', payload: fieldMeta.name });
                const value = await table.getCellValue(fieldId, recordId);
                dispatch({ type: 'SET_CELL_VALUE', payload: value });
            } catch (error) {
                console.error('获取单元格值失败:', error);
                dispatch({ type: 'RESET_CELL' });
            } finally {
                dispatch({ type: 'SET_CELL_LOADING', payload: false });
            }
        } else {
            dispatch({ type: 'RESET_CELL' });
        }
    }, []);


    const updateTableToken = useCallback(async ({ tableId, viewId, recordId, fieldId }: { tableId: string | null, viewId: string | null, recordId: string | null, fieldId: string | null }) => {
        const selection = await bitable.base.getSelection();
        const url = await bitable.bridge.getBitableUrl({
            tableId: tableId || selection.tableId,
            viewId: viewId || selection.viewId,
            recordId: recordId || selection.recordId,
            fieldId: fieldId || selection.fieldId,
        });

        // 从 URL 解析 table_token 并写入 context
        const tableToken = parseTableTokenFromUrl(url);
        dispatch({ type: 'SET_TABLE_TOKEN', payload: tableToken });
    }, []);

    /** 获取选中信息并更新状态 */
    const fetchSelectionInfo = useCallback(async () => {
        try {
            const selection = await bitable.base.getSelection();
            const selectionInfo: SelectionInfo = {
                baseId: selection.baseId,
                tableId: selection.tableId,
                viewId: selection.viewId,
                fieldId: selection.fieldId,
                recordId: selection.recordId,
            };
            dispatch({ type: 'SET_SELECTION_INFO', payload: selectionInfo });

            // 并行获取名称和单元格值
            await Promise.all([
                fetchNames(selection.tableId, selection.viewId),
                fetchCellValue(selection.tableId, selection.fieldId, selection.recordId),
                updateTableToken({ tableId: selection.tableId, viewId: selection.viewId, recordId: selection.recordId, fieldId: selection.fieldId }),
            ]);
        } catch (error) {
            console.error('获取 selection 信息失败:', error);
        }
    }, [fetchNames, fetchCellValue]);

    /** 刷新方法 */
    const refresh = useCallback(async () => {
        dispatch({ type: 'SET_LOADING', payload: true });
        await fetchSelectionInfo();
        dispatch({ type: 'SET_LOADING', payload: false });
    }, [fetchSelectionInfo]);

    /** 重置单元格 */
    const resetCell = useCallback(() => {
        dispatch({ type: 'RESET_CELL' });
    }, []);

    useEffect(() => {
        // 初始化加载
        const init = async () => {
            dispatch({ type: 'SET_LOADING', payload: true });
            await fetchSelectionInfo();
            dispatch({ type: 'SET_LOADING', payload: false });
        };
        init();

        // 监听 selection 变化
        const unsubscribe = bitable.base.onSelectionChange((e) => {
            const data = e.data;
            const selectionInfo: SelectionInfo = {
                baseId: data.baseId,
                tableId: data.tableId,
                viewId: data.viewId,
                fieldId: data.fieldId,
                recordId: data.recordId,
            };
            dispatch({ type: 'SET_SELECTION_INFO', payload: selectionInfo });

            // 异步更新名称和单元格值
            (async () => {
                await Promise.all([
                    fetchNames(data.tableId, data.viewId),
                    fetchCellValue(data.tableId, data.fieldId, data.recordId),
                    updateTableToken({ tableId: data.tableId, viewId: data.viewId, recordId: data.recordId, fieldId: data.fieldId }),
                ]);
            })();
        });

        return () => {
            unsubscribe();
        };
    }, [fetchSelectionInfo, fetchNames, fetchCellValue]);

    const contextValue: SelectionContextType = {
        state,
        refresh,
        resetCell,
    };

    return (
        <SelectionContext.Provider value={contextValue}>
            {children}
        </SelectionContext.Provider>
    );
}
