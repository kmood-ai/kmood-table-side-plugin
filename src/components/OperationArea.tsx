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
import { getTableTypeLabel, getTableTypeColor, ASSET_TABLE_FIELDS, PRODUCTION_TABLE_FIELDS } from '../utils/tableTypeRules';
import BatchUploadPanel, { type BatchUploadResult } from './BatchUploadPanel';
import { fromBase64, outerClient } from '../services';
import { AssetType } from '../../generated/ipimage/common/types_pb.js';
import type { UploadResult } from '../services/uploadService';
import { message } from 'antd';
import CellOperations from './CellOperations';
import type { SelectedFile } from './FileUpload.js';
import { SourcePlatform } from '../../generated/ipimage/shotify/outer_pb.js';
import useSelection from '../hooks/useSelection.js';
import { TOKEN_STORAGE_KEY } from '../constant.js';

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
        message.success(`批量提交 ${resp.succItems.length} 个资产成功`);
        // 更新 selectedFiles 中的结果
      }
      if (resp.failedItems.length > 0) {
        message.error(`部分资产提交失败: ${resp.failedItems.map(item => item.reason).join(', ')}`);
      }

      const removeList = results.filter(item => resp.succItems.some(succItem => succItem.item?.mediaId.value === item.result?.id)).map(item => item.tmpId || '');

      console.log('removeList', resp.succItems, removeList);
      return removeList;
    } catch (error) {
      message.error(`提交失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [state.selectionInfo.tableId, state.tableToken]);

  // 批量上传 Prompt 回调
  const onSubmitBatchPrompt = useCallback(async () => {
    try {
      await outerClient.feishuSplitShot({});
      message.success('批量 Prompt 提交成功，正在处理中，需要大约 30s 能看到结果');
    } catch (error) {
      message.error(`提交失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, []);

  // Token 未配置时的提示
  if (disabled) {
    return (
      <Card
        title={
          <Space>
            <AppstoreOutlined />
            <span>操作区</span>
          </Space>
        }
        size="small"
      >
        <Alert
          message="请先在配置区配置 Token"
          description="配置 Token 后才能使用操作区功能"
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
            <span>操作区</span>
          </Space>
        }
        size="small"
      >
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin tip="正在识别表类型..." />
        </div>
      </Card>
    );
  }

  // 表类型标签
  const typeLabel = getTableTypeLabel(tableType);
  const typeColor = getTableTypeColor(tableType);

  // 未匹配表类型
  if (tableType === 'unknown') {
    return (
      <Card
        title={
          <Space>
            <AppstoreOutlined />
            <span>操作区</span>
            <Tag color={typeColor}>{typeLabel}</Tag>
          </Space>
        }
        size="small"
      >
        <Alert
          message="当前数据表不是资产表或生产表"
          description={
            <Space direction="vertical">
              <Text>请切换到包含以下字段的表：</Text>
              <Text type="secondary">
                · 资产表：包含 {ASSET_TABLE_FIELDS.join(', ')} 等资产类字段
              </Text>
              <Text type="secondary">
                · 生产表：包含 {PRODUCTION_TABLE_FIELDS.join(', ')} 等生产类字段
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
      label: '批量处理',
      children: (
        <BatchUploadPanel
          accept={['png', 'jpg', 'jpeg']}
          title="批量上传资产"
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
      label: '单个处理',
      children: (
        <Empty description="开发中，敬请期待" />
        // <CellOperations
        //   disabled={disabled}
        // />
      ),
    },
    {
      key: 'batch-generate',
      label: '批量处理',
      children: <Empty description="开发中，敬请期待" />
    },
  ];

  // 根据表类型选择 Tab 配置
  const tabs = tableType === 'asset' ? assetTabs : productionTabs;

  return (
    <Card
      title={
        <Space>
          <AppstoreOutlined />
          <span>操作区</span>
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
