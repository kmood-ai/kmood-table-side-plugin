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
  Empty,
} from 'antd';
import {
  AppstoreOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { useTableType } from '../hooks/useTableType';
import { getTableTypeLabelKey, getTableTypeColor, ASSET_TABLE_FIELDS, PRODUCTION_TABLE_FIELDS } from '../utils/tableTypeRules';
import BatchUploadPanel, { type BatchUploadResult } from './BatchUploadPanel';
import { fromBase64, outerClient } from '../services';
import { AssetType } from '../../generated/ipimage/common/types_pb.js';
import type { UploadResult } from '../services/uploadService';
import { message } from 'antd';
import CellOperations from './CellOperations';
import RecordEditing from './RecordEditing';
import type { SelectedFile } from './FileUpload.js';
import { SourcePlatform } from '../../generated/ipimage/shotify/outer_pb.js';
import useSelection from '../hooks/useSelection.js';
import { TOKEN_STORAGE_KEY } from '../constant.js';
import { useI18n } from '../i18n';

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


  // 当 tableType 变化时，重置 activeTab 为对应的第一个 tab key
  useEffect(() => {
    if (tableType === 'asset') {
      setActiveTab('upload-asset');
    } else if (tableType === 'production') {
      setActiveTab('upload-prompt');
    }
  }, [tableType]);

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

      // 目前只支持单文件，取第一个文件的ID
      const fileId = successfulFiles[0].result!.id;

      const resp = await outerClient.feishuSplitShot({ fileId, table: { tableId: state.selectionInfo.tableId || '', tableToken: state.tableToken || '' } });
      message.success(t('operation.promptSubmitSuccess'));

      return {
        removeList: successfulFiles.map(item => item.tmpId || ''),
        traceId: resp.trace?.traceId || '',
      };
    } catch (error) {
      message.error(t('operation.submitFailed', { error: error instanceof Error ? error.message : 'Unknown error' }));
    }
  }, [state.selectionInfo.tableId, state.tableToken, t]);

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
        />
      ),
    },
    {
      key: 'batch-generate',
      label: t('operation.batchProcess'),
      children: (<div>
        <BatchUploadPanel
          accept={['xlsx']}
          title={'批量生成prompt'}
          disabled={disabled}
          onSubmit={onSubmitBatchPrompt}
        /></div>)
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
