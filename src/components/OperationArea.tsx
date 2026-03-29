/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Tabs,
  Tag,
  Alert,
  Space,
  Typography,
  Spin,
  Select,
} from 'antd';
import {
  AppstoreOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { bitable, type IFieldMeta, type IRecord, type ITable } from '@lark-base-open/js-sdk';
import { useTableType } from '../hooks/useTableType';
import { getTableTypeLabelKey, getTableTypeColor, ASSET_TABLE_FIELDS, PRODUCTION_TABLE_FIELDS } from '../utils/tableTypeRules';
import BatchUploadPanel from './BatchUploadPanel';
import BatchGeneration from './BatchGeneration';
import { outerClient } from '../services';
import { AssetType } from '../../generated/ipimage/common/types_pb.js';
import { message } from 'antd';
import RecordEditing from './RecordEditing';
import type { SelectedFile } from './FileUpload.js';
import { FeishuUAsset, SourcePlatform } from '../../generated/ipimage/shotify/outer_pb.js';
import useSelection from '../hooks/useSelection.js';
import { useI18n } from '../i18n';
import { formatCellValue } from '../utils/table.js';
import CollapsibleSection from './CollapsibleSection';

const { Text } = Typography;

interface OperationAreaProps {
  /** Token 未配置时传 true */
  disabled: boolean;
}

/**
 * 操作区主组件
 * 
 * 功能：
 * - 自动识别当前选中表的类型（资产表/生产表/未匹配）
 * - 根据表类型动态展示不同的 Tab 和功能模块
 * - 资产表：提取设定 + 批量上传资产
 * - 生产表：提取设定 + 批量上传 Prompt + 批量生成
 * - 未匹配：提示切换到正确的表
 */
export default function OperationArea({ disabled }: OperationAreaProps) {
  const { tableType, loading: typeLoading } = useTableType();
  const [activeTab, setActiveTab] = useState<string>('extract');
  const { state } = useSelection();
  const { t } = useI18n();

  const [assetTables, setAssetTables] = useState<ITable[]>([]);
  const [currentSelectAssetTable, setCurrentSelectAssetTable] = useState<ITable | null>(null);
  const [assetTableOptions, setAssetTableOptions] = useState<Array<{ value: string; label: string }>>([]);

  // 当 tableType 变化时，重置 activeTab 为对应的第一个 tab key
  useEffect(() => {
    if (tableType === 'asset') {
      setActiveTab('upload-asset');
    } else if (tableType === 'production') {
      setActiveTab('upload-prompt');
    }
  }, [tableType]);

  // 初始化时获取所有表并筛选资产表
  useEffect(() => {
    const initAssetTables = async () => {
      try {
        const tableList = await bitable.base.getTableList();

        // 筛选包含 asset_id 字段的资产表
        const assetTableList: ITable[] = [];
        for (const table of tableList) {
          const fieldMetaList = await table.getFieldMetaList();
          const hasAssetId = fieldMetaList.some(field => ASSET_TABLE_FIELDS.includes(field.name));
          if (hasAssetId) {
            assetTableList.push(table);
          }
        }

        setAssetTables(assetTableList);

        // 构建资产表选项列表
        const options = await Promise.all(
          assetTableList.map(async (table) => ({
            value: table.id,
            label: await table.getName(),
          }))
        );
        setAssetTableOptions(options);

        // 查找当前表往前最近的资产表
        const currentTableId = state.selectionInfo.tableId;

        // 获取所有表的ID用于查找位置
        const tableIds = await Promise.all(tableList.map(table => table.id));
        const currentTableIndex = tableIds.indexOf(currentTableId || '');

        // 获取所有资产表的ID
        const assetTableIds = await Promise.all(assetTableList.map(table => table.id));

        // 从当前表位置往前查找
        let nearestAssetTable: ITable | null = null;
        for (let i = currentTableIndex - 1; i >= 0; i--) {
          const tableId = tableIds[i];
          const assetTableIndex = assetTableIds.indexOf(tableId);
          if (assetTableIndex !== -1) {
            nearestAssetTable = assetTableList[assetTableIndex];
            break;
          }
        }

        // 如果往前没找到，则取第一个资产表（如果有）
        if (!nearestAssetTable && assetTableList.length > 0) {
          nearestAssetTable = assetTableList[0];
        }

        setCurrentSelectAssetTable(nearestAssetTable);
      } catch (error) {
        console.error('初始化资产表失败:', error);
      }
    };

    initAssetTables();
  }, [state.selectionInfo]);

  const getAssetTableInfo = useCallback(async () => {
    if (!currentSelectAssetTable) {
      return [[], [], ''] as [IRecord[], IFieldMeta[], string];
    }
    // 找到资产表的所有记录
    const fieldMetaList = await currentSelectAssetTable.getFieldMetaList();
    const recordsResponse = await currentSelectAssetTable.getRecordsByPage({ pageSize: 100 });
    const records = recordsResponse.records;

    return [records, fieldMetaList, currentSelectAssetTable.id] as [IRecord[], IFieldMeta[], string];
  }, [currentSelectAssetTable]);

  // 批量上传资产回调
  const onSubmitBatchAssets = useCallback(async (results: SelectedFile[]) => {
    try {
      // 将 BatchUploadResult[] 转换为 UassetLibItem[]
      const items = results
        .filter(item => item.result?.id) // 只处理已上传到远端的结果
        .map((result) => ({
          type: AssetType.ROLE, // 默认资产类型为角色，可根据业务需求调整
          name: result.name, // 使用 id 作为名称（或可扩展为自定义名称）
          mediaId: {
            case: 'imgId' as const,
            value: result.result?.id || '',
          },
        }));

      const resp = await outerClient.feishuBatchCreateUAsset({ items, source: { platform: SourcePlatform.FEISHU_PLATFORM, tableId: state.selectionInfo.tableId || '', tableToken: state.tableToken || '' } });
      if (resp.succItems.length > 0) {
        message.success(t('operation.submitAssetsSuccess', { count: resp.succItems.length }));
        // 更新 selectedFiles 中的结果
      }
      if (resp.failedItems.length > 0) {
        message.error(t('operation.submitAssetsPartialFailed', { reason: resp.failedItems.map(item => item.reason).join(', ') }));
      }

      const removeList = results.filter(item => resp.succItems.some(succItem => succItem.item?.mediaId.value === item.result?.id)).map(item => item.tmpId || '');
      return {
        removeList,
        traceId: resp.trace?.traceId || '',
      };
    } catch (error) {
      message.error(t('operation.submitFailed', { error: error instanceof Error ? error.message : 'Unknown error' }));
    }
  }, [state.selectionInfo.tableId, state.tableToken, t]);

  // 批量上传 Prompt 回调
  const onSubmitBatchPrompt = useCallback(async (results: SelectedFile[]) => {
    try {
      // 提取成功上传的文件ID
      const successfulFiles = results.filter(r => r.status === 'success' && r.result?.id);

      if (successfulFiles.length === 0) {
        message.warning(t('operation.noFilesToSubmit'));
        return;
      }

      if (!currentSelectAssetTable) {
        message.error(t('operation.noAssetTableSelected'));
        return;
      }

      // 目前只支持单文件，取第一个文件的ID
      const fileId = successfulFiles[0].result!.id;

      const assets: FeishuUAsset[] = [];

      try {
        const [records, fieldMetaList] = await getAssetTableInfo();

        // 遍历记录，提取附件字段
        for (const record of records) {
          const asset = new FeishuUAsset({
            name: '',
            fileType: '',
            fileToken: '',
          });
          for (const field of fieldMetaList) {


            if (field.name === 'name') {
              asset.name = formatCellValue(record.fields[field.id]);
              continue;
            }

            // 只处理附件类型字段
            if (field.name !== '图片附件' || field.type !== 17) { // 17 是附件字段类型
              continue;
            }

            const cellValue = record.fields[field.id];

            // 附件字段的值是 IOpenAttachment[] 类型
            if (Array.isArray(cellValue)) {
              for (const attachment of cellValue) {
                if (attachment && typeof attachment === 'object' && 'token' in attachment) {
                  asset.fileToken = attachment.token as string;
                  asset.fileType = attachment.type as string;
                }
              }
            }
          }
          if (asset.fileToken && asset.name) {
            assets.push(asset);
          }
        }

      } catch (error) {
        console.error('获取资产表信息失败:', error);
      }

      const resp = await outerClient.feishuSplitShot({ fileId, assets, extractAssets: true, table: { tableId: state.selectionInfo.tableId || '', tableToken: state.tableToken || '' } });
      message.success(t('operation.promptSubmitSuccess'));

      return {
        removeList: successfulFiles.map(item => item.tmpId || ''),
        traceId: resp.trace?.traceId || '',
      };
    } catch (error) {
      message.error(t('operation.submitFailed', { error: error instanceof Error ? error.message : 'Unknown error' }));
    }
  }, [state.selectionInfo.tableId, state.tableToken, t, currentSelectAssetTable, getAssetTableInfo]);

  // Token 未配置时的提示
  if (disabled) {
    return (
      <Card
        title={
          <Space>
            <AppstoreOutlined />
            <span>{t('app.operationArea')}</span>
          </Space>
        }
        size="small"
      >
        <Alert
          message={t('operation.pleaseConfigureToken')}
          description={t('operation.configureTokenToUse')}
          type="warning"
          showIcon
        />
      </Card>
    );
  }

  // 表类型识别中
  if (typeLoading) {
    return (
      <Card
        title={
          <Space>
            <AppstoreOutlined />
            <span>{t('app.operationArea')}</span>
          </Space>
        }
        size="small"
      >
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin tip={t('operation.identifyingTableType')} />
        </div>
      </Card>
    );
  }

  // 表类型标签
  const typeLabel = t(getTableTypeLabelKey(tableType));
  const typeColor = getTableTypeColor(tableType);

  // 未匹配表类型
  if (tableType === 'unknown') {
    return (
      <Card
        title={
          <Space>
            <AppstoreOutlined />
            <span>{t('app.operationArea')}</span>
            <Tag color={typeColor}>{typeLabel}</Tag>
          </Space>
        }
        size="small"
      >
        <Alert
          message={t('operation.unsupportedTable')}
          description={
            <Space direction="vertical">
              <Text>{t('operation.switchToTable')}</Text>
              <Text type="secondary">
                {t('operation.assetTableContains', { fields: ASSET_TABLE_FIELDS.join(', ') })}
              </Text>
              <Text type="secondary">
                {t('operation.productionTableContains', { fields: PRODUCTION_TABLE_FIELDS.join(', ') })}
              </Text>
            </Space>
          }
          type="warning"
          showIcon
          icon={<TableOutlined />}
        />
      </Card>
    );
  }

  // 资产表 Tab 配置
  const assetTabs = [
    {
      key: 'upload-asset',
      label: t('operation.batchProcess'),
      children: (
        <BatchUploadPanel
          accept={['png', 'jpg', 'jpeg']}
          title={t('operation.batchProcess')}
          disabled={disabled}
          onSubmit={onSubmitBatchAssets}
        />
      ),
    },
  ];

  // 生产表 Tab 配置
  const productionTabs = [
    {
      key: 'upload-prompt',
      label: t('operation.singleProcess'),
      children: (
        <RecordEditing
          disabled={disabled}
          getAssetTableInfo={getAssetTableInfo}
        />
      ),
    },
    {
      key: 'batch-generate',
      label: t('operation.batchProcess'),
      children: (<div>


        <CollapsibleSection
          title="批量上传 Prompt 文件"
          defaultExpanded={true}
          style={{ marginBottom: 16 }}
        >
          <BatchUploadPanel
            accept={['xlsx']}
            disabled={disabled || !currentSelectAssetTable}
            onSubmit={onSubmitBatchPrompt}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="批量生成操作"
          defaultExpanded={false}
        >
          <BatchGeneration
            disabled={disabled || !currentSelectAssetTable}
            assetTableId={currentSelectAssetTable?.id}
          />
        </CollapsibleSection>
      </div>)
    },
  ];

  // 根据表类型选择 Tab 配置
  const tabs = tableType === 'asset' ? assetTabs : productionTabs;

  return (
    <Card
      title={
        <Space>
          <AppstoreOutlined />
          <span>{t('app.operationArea')}</span>
          <Tag color={typeColor}>{typeLabel}</Tag>
        </Space>
      }
      size="small"
      styles={{
        body: { padding: '12px 16px' },
      }}
    >
      {/* 资产表选择器 */}
      {assetTables.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Text style={{ fontSize: 14 }}>{t('operation.selectAssetTable')}:</Text>
            <Select
              style={{ width: 200 }}
              value={currentSelectAssetTable?.id}
              onChange={(value) => {
                // 根据 ID 查找对应的表对象
                const findTableById = async () => {
                  for (const table of assetTables) {
                    const tableId = table.id;
                    if (tableId === value) {
                      setCurrentSelectAssetTable(table);
                      break;
                    }
                  }
                };
                findTableById();
              }}
              placeholder={t('operation.pleaseSelectAssetTable')}
              options={assetTableOptions}
            />
          </Space>
        </div>
      )}

      {assetTables.length === 0 && (
        <Alert
          message={t('operation.noAssetTableFound')}
          description={t('operation.createAssetTableFirst')}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 当没有选择资产表时，显示提示信息并禁用操作 */}
      {!currentSelectAssetTable && assetTables.length > 0 && (
        <Alert
          message="请先选择资产表"
          description="需要选择资产表后才能进行批量操作"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabs}
        destroyInactiveTabPane={false}
        size="small"
      />
    </Card>
  );
}
