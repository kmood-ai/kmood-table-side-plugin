import { useState, useRef } from 'react';
import { Space, Alert, Typography, Button, message } from 'antd';
import FileUpload, { type SelectedFile, type FileUploadRef, type AttachmentData as FileAttachmentData } from './FileUpload';
import { useSelection } from '../hooks';
import type { UploadResult } from '../services/uploadService';
import { DeleteOutlined } from '@ant-design/icons';
import { useI18n } from '../i18n';

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

export type OnSubmitReturn = {
  removeList?: string[];
  traceId?: string;
} | undefined;

/**
 * 附件数据接口，用于展示已有附件
 */
export type AttachmentData = FileAttachmentData;

interface BatchUploadPanelProps {
  /** 面板标题 */
  title?: string;
  /** Token 未配置时传 true */
  disabled: boolean;
  /** 支持的上传文件类型，如 ['.txt', '.csv'] */
  accept?: string[];
  /** 是否需要上传到远端服务器，默认 true */
  needUploadServer?: boolean;
  /** 是否支持多选文件，默认 true */
  multiple?: boolean;
  /** 已有附件数据，用于展示和下载 */
  attachments?: AttachmentData[];
  /** 提交回调，支持异步 */
  onSubmit?: (results: SelectedFile[]) => Promise<OnSubmitReturn | undefined> | void;
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
  attachments,
  onSubmit,
}: BatchUploadPanelProps) {
  const { t } = useI18n();
  const { state } = useSelection();
  const tableId = state.selectionInfo.tableId;
  const fileUploadRef = useRef<FileUploadRef>(null);
  const [uploadResults, setUploadResults] = useState<SelectedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [traceIds, setTraceIds] = useState<string[]>([]);

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
      const result = await onSubmit(uploadResults);
      if (result?.traceId) {
        setTraceIds(prev => [result.traceId || '', ...prev]);
      }
      if (result?.removeList && result.removeList.length > 0) {
        fileUploadRef.current?.updateSelectedFiles((prev) =>
          prev.filter((item) => !result.removeList?.includes(item.tmpId ?? ''))
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearTraceInfo = () => {
    setTraceIds([]);
    message.success(t('batchUpload.traceInfoCleared'));
  };

  // Token 未配置时的提示
  if (disabled) {
    return (
      <Alert
        message={t('operation.pleaseConfigureToken')}
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
        attachments={attachments}
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
          {t('batchUpload.submit')}
        </Button>
      )}

      {traceIds.length > 0 && (
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Typography.Text type="secondary">{t('batchUpload.traceInfoTips')}</Typography.Text>
            <Button size="small" onClick={handleClearTraceInfo} icon={<DeleteOutlined />}>
              {t('batchUpload.clear')}
            </Button>
          </Space>
          {traceIds.map((traceId) => (
            <div
              key={traceId}
              style={{
                background: '#f7f8fa',
                // border: '1px solid #d0d3da',
                borderRadius: 4,
                padding: '4px 8px',
              }}
            >
              <Space
                align="start"
                style={{ width: '100%', justifyContent: 'space-between' }}
              >
                <Typography.Text
                  copyable={{ text: traceId }}
                  style={{
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                    color: '#1f2329',
                    lineHeight: '12px',
                    fontSize: 11,
                  }}
                >
                  {traceId}
                </Typography.Text>
              </Space>
            </div>
          ))}
        </Space>
      )}


    </Space>
  );
}
