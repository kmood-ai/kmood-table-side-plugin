import { useState, useRef } from 'react';
import {
  Button,
  Upload,
  Typography,
  Space,
  Tag,
  List,
  message,
  Alert,
} from 'antd';
import {
  UploadOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  DeleteOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { customUploadFiles, UploadType, type UploadResult } from '../services/uploadService';

const { Text, Paragraph } = Typography;

// 支持的文件类型
const ACCEPTED_TYPES = [
  '.txt',
  '.csv',
  '.json',
  '.xml',
  '.md',
  '.log',
  '.xlsx',
  '.xls',
].join(',');

export interface SelectedFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  result?: UploadResult;
  error?: string;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 根据文件类型返回图标
 */
function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    return <FileExcelOutlined style={{ color: '#52c41a', fontSize: 20 }} />;
  }
  return <FileTextOutlined style={{ color: '#1890ff', fontSize: 20 }} />;
}

/**
 * 根据状态返回状态标签
 */
function getStatusTag(status: SelectedFile['status']) {
  switch (status) {
    case 'pending':
      return (
        <Tag icon={<ClockCircleOutlined />} color="default">
          待上传
        </Tag>
      );
    case 'uploading':
      return (
        <Tag icon={<LoadingOutlined spin />} color="processing">
          上传中
        </Tag>
      );
    case 'success':
      return (
        <Tag icon={<CheckCircleOutlined />} color="success">
          已上传
        </Tag>
      );
    case 'error':
      return (
        <Tag icon={<CloseCircleOutlined />} color="error">
          上传失败
        </Tag>
      );
    default:
      return null;
  }
}

interface FileUploadProps {
  disabled?: boolean;
  onUploadComplete?: (results: UploadResult[]) => void;
}

export default function FileUpload({ disabled = false, onUploadComplete }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 上传单个文件
  const uploadSingleFile = async (file: File, index: number) => {
    // 标记为上传中
    setSelectedFiles((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status: 'uploading' };
      return updated;
    });

    try {
      const response = await customUploadFiles([file], UploadType.BINARY);
      const fileInfo = response.infos?.[0];

      setSelectedFiles((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: 'success', result: fileInfo };
        return updated;
      });

      onUploadComplete?.([fileInfo]);
      message.success(`${file.name} 上传成功`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '上传失败';
      setSelectedFiles((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: 'error', error: errMsg };
        return updated;
      });
      message.error(`${file.name} 上传失败: ${errMsg}`);
    }
  };

  // 添加文件并自动上传
  const addFilesAndUpload = (files: File[]) => {
    const startIndex = selectedFiles.length;
    const newFiles: SelectedFile[] = files.map((file) => ({
      file,
      status: 'pending' as const,
    }));

    setSelectedFiles((prev) => [...prev, ...newFiles]);

    // 自动上传所有新添加的文件
    files.forEach((file, i) => {
      uploadSingleFile(file, startIndex + i);
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    addFilesAndUpload(Array.from(files));
    // 重置 input 以便重复选同一文件
    event.target.value = '';
  };

  // 移除选中的文件
  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const successCount = selectedFiles.filter((f) => f.status === 'success').length;
  const uploadingCount = selectedFiles.filter((f) => f.status === 'uploading').length;

  return (
    <div>
      {/* 隐藏的原生 file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 统计标签 */}
      {selectedFiles.length > 0 && (
        <Space style={{ marginBottom: 8 }}>
          {uploadingCount > 0 && <Tag color="blue">{uploadingCount} 上传中</Tag>}
          {successCount > 0 && <Tag color="green">{successCount} 已上传</Tag>}
        </Space>
      )}

      {/* 拖拽上传区域 */}
      <Upload.Dragger
        accept={ACCEPTED_TYPES}
        multiple
        showUploadList={false}
        disabled={disabled}
        beforeUpload={(file) => {
          // 自动上传
          addFilesAndUpload([file]);
          return false; // 阻止默认上传行为
        }}
        style={{ marginBottom: 16 }}
      >
        <p className="ant-upload-drag-icon">
          <UploadOutlined style={{ fontSize: 36, color: disabled ? '#d9d9d9' : '#1890ff' }} />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域（自动上传）</p>
        <p className="ant-upload-hint">
          支持 txt、csv、json、xml、md、log、xlsx、xls 格式，单个文件建议不超过 2MB
        </p>
      </Upload.Dragger>

      {/* 文件列表 */}
      {selectedFiles.length > 0 && (
        <List
          size="small"
          dataSource={selectedFiles}
          renderItem={(item, index) => (
            <List.Item
              actions={[
                (item.status === 'pending' || item.status === 'error') && (
                  <Button
                    key="remove"
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveFile(index)}
                  />
                ),
                item.status === 'success' && (
                  <Button
                    key="remove-success"
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveFile(index)}
                  />
                ),
                getStatusTag(item.status),
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={getFileIcon(item.file.name)}
                title={
                  <Space>
                    <Text ellipsis style={{ maxWidth: 200 }}>
                      {item.file.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatFileSize(item.file.size)}
                    </Text>
                  </Space>
                }
                description={
                  item.status === 'success' && item.result ? (
                    <Paragraph
                      copyable
                      ellipsis={{ rows: 1 }}
                      style={{ fontSize: 12, marginBottom: 0 }}
                    >
                      {item.result.url || item.result.id}
                    </Paragraph>
                  ) : item.status === 'error' ? (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      {item.error}
                    </Text>
                  ) : null
                }
              />
            </List.Item>
          )}
        />
      )}

      {selectedFiles.length === 0 && !disabled && (
        <Alert
          message="拖拽或点击选择文件，将自动上传到远端服务"
          type="info"
          showIcon
          style={{ marginTop: 8 }}
        />
      )}
    </div>
  );
}
