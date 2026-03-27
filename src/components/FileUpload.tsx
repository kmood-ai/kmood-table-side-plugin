import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Button,
  Upload,
  Typography,
  Space,
  Tag,
  List,
  message,
  Alert,
  Input,
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
  EditOutlined,
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
  tmpId?: string;
  file?: File;
  name: string; // 去掉后缀的文件名
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

/**
 * 根据文件后缀获取上传类型
 */
const getUploadType = (filename: string): UploadType => {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  // Excel 文件使用 BINARY 类型
  if (['xlsx', 'xls'].includes(ext)) {
    return UploadType.BINARY;
  }
  // 文本类文件使用 TEXT 类型
  if (['txt', 'csv', 'json', 'xml', 'md', 'log'].includes(ext)) {
    return UploadType.TEXT;
  }
  // 图片文件使用 IMAGE 类型
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
    return UploadType.IMAGE;
  }
  // 视频文件使用 VIDEO 类型
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext)) {
    return UploadType.VIDEO;
  }
  // 音频文件使用 AUDIO 类型
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'].includes(ext)) {
    return UploadType.AUDIO;
  }
  // 其他默认使用 BINARY
  return UploadType.BINARY;
};

export interface FileUploadRef {
  updateSelectedFiles: (next: (prev: SelectedFile[]) => SelectedFile[]) => void;
}

interface FileUploadProps {
  disabled?: boolean;
  needUploadServer?: boolean;
  /** 支持的文件类型，如 ['.txt', '.csv']，不传则使用默认类型 */
  accept?: string[];
  onUploadChange?: (results: SelectedFile[]) => void;
}

const FileUpload = forwardRef<FileUploadRef, FileUploadProps>(function FileUpload({ disabled = false, accept, onUploadChange }, ref) {
  // 使用传入的 accept 或默认类型
  const acceptTypes = accept?.join(',') || ACCEPTED_TYPES;
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const selectedFilesRef = useRef<SelectedFile[]>([]);
  // eslint-disable-next-line react-hooks/refs
  selectedFilesRef.current = selectedFiles;


  const updateSelectedFiles = useCallback((next: (prev: SelectedFile[]) => SelectedFile[]) => {
    const prev = selectedFilesRef.current;

    const updated = next(prev);

    setSelectedFiles(updated);
    onUploadChange?.(updated);
    selectedFilesRef.current = updated;

  }, [onUploadChange]);

  useImperativeHandle(ref, () => ({
    updateSelectedFiles,
  }), [updateSelectedFiles]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 开始编辑文件名
   */
  const handleStartEdit = (index: number, filename: string) => {
    setEditingIndex(index);
    setEditingName(filename);
  };

  /**
   * 保存编辑的文件名
   */
  const handleSaveEdit = (index: number) => {
    if (editingName.trim() && editingIndex === index) {
      updateSelectedFiles((prev) => {
        const updated = [...prev];
        // 更新 name 字段
        updated[index] = { ...updated[index], name: editingName.trim() };
        return updated;
      });
    }
    setEditingIndex(null);
    setEditingName('');
  };

  /**
   * 取消编辑
   */
  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingName('');
  };

  // 上传单个文件
  const uploadSingleFile = async (file: File, tmpId: string) => {
    // 标记为上传中
    updateSelectedFiles((prev) => {
      const updated = [...prev];
      const index = updated.findIndex(item => item.tmpId === tmpId);
      updated[index] = { ...updated[index], status: 'uploading', file };
      return updated;
    });

    try {
      // 根据文件后缀动态判断 uploadType
      const uploadType = getUploadType(file.name);
      const response = await customUploadFiles([file], uploadType, {
        needCensor: true,
      });
      const fileInfo = response.infos?.[0];

      updateSelectedFiles((prev) => {
        const updated = [...prev];
        const index = updated.findIndex(item => item.tmpId === tmpId);
        updated[index] = { ...updated[index], status: 'success', result: fileInfo };
        return updated;
      });
      message.success(`${file.name} 上传成功`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '上传失败';
      updateSelectedFiles((prev) => {
        const updated = [...prev];
        const index = updated.findIndex(item => item.tmpId === tmpId);
        updated[index] = { ...updated[index], status: 'error', error: errMsg };
        return updated;
      });
      message.error(`${file.name} 上传失败: ${errMsg}`);
    }
  };

  // 添加文件并自动上传
  const addFilesAndUpload = (files: File[]) => {
    const newFiles: SelectedFile[] = files.map((file) => {
      // 去掉后缀的文件名
      const nameWithoutExt = file.name.includes('.')
        ? file.name.substring(0, file.name.lastIndexOf('.'))
        : file.name;

      const tmpId = nameWithoutExt + Date.now();
      return {
        file,
        tmpId,
        name: nameWithoutExt,
        status: 'pending' as const,
      };
    });

    updateSelectedFiles((prev) => [...prev, ...newFiles]);

    // 自动上传所有新添加的文件
    files.forEach((file, i) => {
      uploadSingleFile(file, newFiles[i].tmpId || '');
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
    updateSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const successCount = selectedFiles.filter((f) => f.status === 'success').length;
  const uploadingCount = selectedFiles.filter((f) => f.status === 'uploading').length;

  return (
    <div>
      {/* 隐藏的原生 file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
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
        accept={acceptTypes}
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
          支持 {accept ? accept.map(ext => ext.replace('.', '')).join('、') : 'txt、csv、json、xml、md、log、xlsx、xls'} 格式，单个文件建议不超过 2MB
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
                avatar={getFileIcon(item.file?.name || '')}
                title={
                  editingIndex === index ? (
                    <Input
                      size="small"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onPressEnter={() => handleSaveEdit(index)}
                      onBlur={() => handleSaveEdit(index)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      autoFocus
                      style={{ width: 200 }}
                    />
                  ) : (
                    <Space>
                      <Text ellipsis style={{ maxWidth: 200 }}>
                        {item.name}
                      </Text>
                      {item.status === 'success' && (
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleStartEdit(index, item.name)}
                          style={{ padding: '0 4px' }}
                        />
                      )}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatFileSize(item.file?.size || 0)}
                      </Text>
                    </Space>
                  )
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
});

export default FileUpload;
