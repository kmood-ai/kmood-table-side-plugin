import { useState, useRef } from 'react';
import { Space, Alert, Typography, Button } from 'antd';
import FileUpload, { type SelectedFile, type FileUploadRef } from './FileUpload';
import { useSelection } from '../hooks';
import type { UploadResult } from '../services/uploadService';

const { Title } = Typography;

/**
 * 本地文件结果（不上传到远端时使用）
 */
export interface LocalFileResult {
  /** 本地文件对象 */
  file: File;
  /** 文件名 */
  name: string;
  /** 文件大小（字节） */
  size: number;
  /** 是否处理成功 */
  success: boolean;
  /** 错误信息（失败时） */
  error?: string;
}

/**
 * 批量上传结果类型
 * - needUploadServer=true 时为 UploadResult（包含远端 id、url）
 * - needUploadServer=false 时为 LocalFileResult（仅本地文件信息）
 */
export type BatchUploadResult = UploadResult | LocalFileResult;

interface BatchUploadPanelProps {
  /** 面板标题 */
  title?: string;
  /** Token 未配置时传 true */
  disabled: boolean;
  /** 支持的上传文件类型，如 ['.txt', '.csv'] */
  accept?: string[];
  /** 是否需要上传到远端服务器，默认 true */
  needUploadServer?: boolean;
  /** 提交回调，支持异步 */
  onSubmit?: (results: SelectedFile[]) => Promise<string[] | undefined> | void;
}

/**
 * 批量上传面板组件
 * 用于上传资产或 Prompt 文件
 */
export default function BatchUploadPanel({
  title,
  disabled,
  accept,
  needUploadServer = true,
  onSubmit,
}: BatchUploadPanelProps) {
  const { state } = useSelection();
  const tableId = state.selectionInfo.tableId;
  const fileUploadRef = useRef<FileUploadRef>(null);
  const [uploadResults, setUploadResults] = useState<SelectedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 上传成功的文件数量
  const successCount = uploadResults.filter((r) =>
    r.result?.id
  ).length;

  const handleUploadComplete = (results: SelectedFile[]) => {
    setUploadResults(results);
  };

  const handleSubmit = async () => {
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      const removeList = await onSubmit(uploadResults);
      if (removeList && removeList.length > 0) {
        fileUploadRef.current?.updateSelectedFiles((prev) =>
          prev.filter((item) => !removeList.includes(item.tmpId ?? ''))
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Token 未配置时的提示
  if (disabled) {
    return (
      <Alert
        message="请先在配置区配置 Token"
        type="warning"
        showIcon
        style={{ margin: 0 }}
      />
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {/* 标题 */}
      {title && (
        <Title level={5} style={{ margin: 0 }}>
          {title}
        </Title>
      )}

      {/* 文件上传 */}
      <FileUpload
        ref={fileUploadRef}
        disabled={disabled || !tableId}
        accept={accept}
        needUploadServer={needUploadServer}
        onUploadChange={handleUploadComplete}
      />

      {/* 提交按钮 */}
      {onSubmit && (
        <Button
          type="primary"
          block
          disabled={successCount === 0}
          loading={submitting}
          onClick={handleSubmit}
        >
          提交
        </Button>
      )}
    </Space>
  );
}
