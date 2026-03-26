import { useState } from 'react';
import { Collapse, Space, Typography, Alert } from 'antd';
import {
  CloudUploadOutlined,
} from '@ant-design/icons';
import TableSelector from './TableSelector';
import FileUpload from './FileUpload';
import type { UploadResult } from '../services/uploadService';

const { Text } = Typography;


interface BatchUploadPanelProps {
  /** 面板标题 */
  title: string;
  /** 提示 */
  selectTip?: string;
  /** 业务类型，用于区分上传逻辑 */
  uploadType: 'asset' | 'prompt';
  /** Token 未配置时传 true */
  disabled: boolean;
  /** 上传完成回调 */
  onUploadComplete?: (results: UploadResult[]) => void;
  /** 提交回调 */
  onSubmit?: () => void;
}

export default function BatchUploadPanel({
  title,
  selectTip,
  uploadType,
  disabled,
  onUploadComplete,
}: BatchUploadPanelProps) {
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>(undefined);

  const handleUploadComplete = (results: UploadResult[]) => {
    onUploadComplete?.(results);
  };

  const panelContent = disabled ? (
    <Alert
      message="请先在配置区配置 Token"
      type="warning"
      showIcon
      style={{ margin: 0 }}
    />
  ) : (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {/* 数据表选择器 */}
      <div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
          选择数据表：{selectTip}
        </Text>
        <TableSelector
          value={selectedTableId}
          onChange={setSelectedTableId}
          disabled={disabled}
          placeholder="请选择目标数据表"
        />
      </div>

      {/* 文件上传 */}
      <FileUpload
        disabled={disabled || !selectedTableId}
        onUploadComplete={handleUploadComplete}
      />

      {/* 未选择数据表时的提示 */}
      {!selectedTableId && (
        <Alert
          message="请先选择数据表后再上传文件"
          type="info"
          showIcon
        />
      )}
    </Space>
  );

  const items = [
    {
      key: uploadType,
      label: (
        <Space>
          <CloudUploadOutlined />
          <span>{title}</span>
        </Space>
      ),
      children: panelContent,
    },
  ];

  return (
    <Collapse
      items={items}
      defaultActiveKey={[uploadType]}
      style={{ marginBottom: 12 }}
    />
  );
}
