import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Card,
  Space,
  Typography,
  Alert,
  Spin,
  Descriptions,
  Button,
  Empty,
  Modal,
  Input,
  message,
  Tabs,
  List,
  Popover,
  Image,
} from 'antd';
import {
  ReloadOutlined,
  FileTextOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useSelection } from '../hooks/useSelection';
import { useTable } from '../hooks/useTable';
import type { RecordInfo, FieldInfo } from '../hooks/useTable';
import { formatCellValue } from '../utils/table';
import { useI18n } from '../i18n';
import { bitable, type ICell, type IOpenAttachment } from '@lark-base-open/js-sdk';
import { getAttachmentUrls } from '../utils';

const { Text, Paragraph } = Typography;

interface RecordEditingProps {
  /** Token 未配置时传 true */
  disabled: boolean;
}

const displayFields = [
  'id',
  'prompt',
  '本地文件',
  '资产图片',
];

/**
 * RecordEditing 组件
 * 
 * 功能：
 * - 展示当前选中行的完整内容
 * - 自动从 useSelection 获取当前选中行数据
 * - 使用 useTable hook 获取选中行的完整内容
 * - 以描述列表形式展示行数据
 */
export default function RecordEditing({ disabled }: RecordEditingProps) {
  const { t } = useI18n();
  const { state, refresh } = useSelection();
  const { selectionInfo, tableName } = state;
  const {
    getRecord,
    getFieldList,
    currentRecordId,
    setCell,
  } = useTable();

  // 状态管理
  const [loading, setLoading] = useState<boolean>(false);
  const [recordData, setRecordData] = useState<RecordInfo | null>(null);
  const [fieldList, setFieldList] = useState<FieldInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 编辑状态
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // 联想面板状态
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [suggestionKeyword, setSuggestionKeyword] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<string>('all');
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const textAreaRef = useRef<any>(null);

  // Mock 数据：联想列表
  const mockSuggestions = {
    all: [
      { id: '1', name: 'logo设计图.png', type: 'local' },
      { id: '2', name: '产品原型图.fig', type: 'local' },
      { id: '3', name: '营销海报_v2.psd', type: 'asset' },
      { id: '4', name: '用户指南.pdf', type: 'local' },
      { id: '5', name: '品牌VI素材.zip', type: 'asset' },
    ],
    local: [
      { id: '1', name: 'logo设计图.png', type: 'local' },
      { id: '2', name: '产品原型图.fig', type: 'local' },
      { id: '4', name: '用户指南.pdf', type: 'local' },
    ],
    asset: [
      { id: '3', name: '营销海报_v2.psd', type: 'asset' },
      { id: '5', name: '品牌VI素材.zip', type: 'asset' },
    ],
  };

  /**
   * 处理输入变化，检测触发字符
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    setEditingValue(value);
    setCursorPosition(cursorPos);

    // 检测最近的触发字符 '@' 或 '【'
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const lastBracketIndex = textBeforeCursor.lastIndexOf('【');
    const triggerIndex = Math.max(lastAtIndex, lastBracketIndex);

    if (triggerIndex !== -1) {
      // 提取关键词（触发字符之后到光标之间的文本）
      const keyword = textBeforeCursor.substring(triggerIndex + 1);

      // 如果关键词中没有空格或右括号，显示联想面板
      if (!keyword.includes(' ') && !keyword.includes('】')) {
        setSuggestionKeyword(keyword);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  /**
   * 过滤建议列表
   */
  const getFilteredSuggestions = () => {
    const list = currentTab === 'all'
      ? mockSuggestions.all
      : currentTab === 'local'
        ? mockSuggestions.local
        : mockSuggestions.asset;

    if (!suggestionKeyword) {
      return list;
    }

    return list.filter(item =>
      item.name.toLowerCase().includes(suggestionKeyword.toLowerCase())
    );
  };

  /**
   * 处理选择联想项
   */
  const handleSelectSuggestion = (itemName: string) => {
    const textBeforeCursor = editingValue.substring(0, cursorPosition);
    const textAfterCursor = editingValue.substring(cursorPosition);

    // 找到最近的触发字符位置
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const lastBracketIndex = textBeforeCursor.lastIndexOf('【');
    const triggerIndex = Math.max(lastAtIndex, lastBracketIndex);

    // 替换触发字符和关键词为完整的标签
    const newTextBefore = textBeforeCursor.substring(0, triggerIndex);
    const insertText = `【${itemName}】`;
    const newValue = newTextBefore + insertText + textAfterCursor;

    setEditingValue(newValue);
    setShowSuggestions(false);

    // 将光标移动到插入内容之后
    setTimeout(() => {
      if (textAreaRef?.current) {
        const newCursorPos = newTextBefore.length + insertText.length;
        textAreaRef.current.focus();
        textAreaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  /**
   * 附件列表组件（支持异步加载缩略图）
   */
  const AttachmentList = ({
    attachments,
    fieldId,
    recordId,
    tableId,
  }: {
    attachments?: IOpenAttachment[];
    fieldId: string;
    recordId: string | null;
    tableId: string | null;
  }) => {
    const [thumbnailUrls, setThumbnailUrls] = useState<(string | null)[]>([]);
    const [loading, setLoading] = useState(false);

    const getThumbnailUrls = useCallback(async () => {

      if (!recordId || !tableId || !fieldId || !attachments || attachments.length === 0) {
        return;
      }
      setLoading(true);
      const urls = await getAttachmentUrls(attachments, { fieldId, recordId, tableId });
      setThumbnailUrls(urls);
      setLoading(false);
    }, [recordId, tableId, fieldId, attachments]);

    useEffect(() => {
      getThumbnailUrls();
    }, [recordId, tableId, fieldId]);

    if (loading) {
      return <Spin size="small" />;
    }

    return (
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {attachments?.map((attachment: IOpenAttachment, index: number) => {
          const { token, name, type } = attachment;
          const thumbnailUrl = thumbnailUrls[index];

          // 判断是否为图片类型
          const isImage = type?.startsWith('image/') ||
            /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(name || '');

          return (
            <Space key={token || index} size="small" align="start">
              {isImage && thumbnailUrl ? (
                <Image
                  src={thumbnailUrl}
                  alt={name || '附件'}
                  width={60}
                  height={60}
                  style={{ objectFit: 'cover', borderRadius: 4 }}
                  preview={{
                    src: thumbnailUrl,
                  }}
                />
              ) : null}
              <Text style={{ fontSize: 12 }}>{name || '未命名附件'}</Text>
            </Space>
          );
        })}
      </Space>
    );
  };

  /**
   * 加载选中行的完整内容
   */
  const loadRecordData = useCallback(async () => {
    if (!currentRecordId || !selectionInfo.tableId) {
      setRecordData(null);
      setFieldList([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 获取字段列表和记录数据
      const [fields, record] = await Promise.all([
        getFieldList(),
        getRecord(currentRecordId),
      ]);

      const displayFieldsList = displayFields.map((field) => fields.find((f) => f.name === field)).filter(Boolean) as FieldInfo[];

      setFieldList(displayFieldsList);
      setRecordData(record);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('RecordEditing: 加载记录数据失败', err);
    } finally {
      setLoading(false);
    }
  }, [currentRecordId, selectionInfo.tableId, getFieldList, getRecord]);

  /**
   * 当选中行变化时，重新加载数据
   */
  useEffect(() => {
    loadRecordData();
  }, [loadRecordData]);

  /**
   * 手动刷新
   */
  const handleRefresh = useCallback(async () => {
    await refresh();
    await loadRecordData();
  }, [refresh, loadRecordData]);

  /**
   * 打开编辑弹窗
   */
  const handleEdit = useCallback((fieldId: string, currentValue: string) => {
    setEditingFieldId(fieldId);
    setEditingValue(currentValue || '');
    setIsEditModalVisible(true);
  }, []);

  /**
   * 关闭编辑弹窗
   */
  const handleCancelEdit = useCallback(() => {
    setIsEditModalVisible(false);
    setEditingFieldId(null);
    setEditingValue('');
  }, []);

  /**
   * 保存编辑内容
   */
  const handleSaveEdit = useCallback(async () => {
    if (!editingFieldId || !currentRecordId || !selectionInfo.tableId) {
      return;
    }

    try {
      // 调用 setCell 更新单元格值
      await setCell(
        editingFieldId,
        currentRecordId,
        editingValue,
        selectionInfo.tableId,
      );

      message.success(t('record.updateSuccess'));

      // 关闭弹窗
      handleCancelEdit();

      // 重新加载数据
      await loadRecordData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      message.error(t('record.updateFailed') + ': ' + errorMsg);
      console.error('RecordEditing: 更新单元格失败', err);
    }
  }, [editingFieldId, currentRecordId, selectionInfo.tableId, editingValue, setCell, t, handleCancelEdit, loadRecordData]);

  /**
   * Token 未配置时的提示
   */
  if (disabled) {
    return (
      <Alert
        message={t('operation.pleaseConfigureToken')}
        description={t('operation.configureTokenToUse')}
        type="warning"
        showIcon
        style={{ margin: 0 }}
      />
    );
  }

  /**
   * 未选中行时的提示
   */
  if (!currentRecordId) {
    return (
      <Alert
        message={t('record.selectRowFirst')}
        description={t('record.selectRowDesc')}
        type="info"
        showIcon
        icon={<FileTextOutlined />}
        style={{ margin: 0 }}
      />
    );
  }

  /**
   * 加载中状态
   */
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin tip={t('record.loadingData')} />
      </div>
    );
  }

  /**
   * 错误状态
   */
  if (error) {
    return (
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Alert
          message={t('record.loadFailed')}
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={handleRefresh}>
              {t('cell.retry')}
            </Button>
          }
        />
      </Space>
    );
  }

  /**
   * 无数据状态
   */
  if (!recordData || fieldList.length === 0) {
    return (
      <Empty
        description={t('record.noData')}
        style={{ padding: 24 }}
      >
        <Button type="primary" onClick={handleRefresh}>
          {t('cell.refresh')}
        </Button>
      </Empty>
    );
  }

  /**
   * 渲染记录数据
   */
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {/* 操作栏 */}
      <Space>
        <Button
          type="link"
          size="small"
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
        >
          {t('cell.refresh')}
        </Button>
      </Space>

      {/* 字段数据 */}
      <Card
        size="small"
        title={t('record.fieldData')}
        styles={{ body: { padding: 12 } }}
      >
        <Descriptions column={1} size="small" bordered>
          {fieldList.map((field) => {
            const cellValue = recordData.fields[field.id];
            const formattedValue = formatCellValue(cellValue);

            const fieldType = field.type;

            return (
              <Descriptions.Item
                key={field.id}
                label={
                  <Space>
                    <Text strong>{field.name}</Text>
                    {field.isPrimary && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        (主字段)
                      </Text>
                    )}
                  </Space>
                }
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {/* 展示附件内容 */}
                  {fieldType === 17 ? (
                    <AttachmentList attachments={cellValue as unknown as IOpenAttachment[]} fieldId={field.id} recordId={currentRecordId} tableId={selectionInfo.tableId} />
                  ) : formattedValue ? (
                    <Paragraph
                      ellipsis={{
                        rows: 3,
                        expandable: true,
                        symbol: t('cell.expand'),
                      }}
                      style={{ marginBottom: 0, maxWidth: 250 }}
                    >
                      {formattedValue}
                    </Paragraph>
                  ) : (
                    <Text type="secondary" italic>
                      {t('record.empty')}
                    </Text>
                  )}
                  {/* 为 prompt 字段添加编辑按钮 */}
                  {field.name === 'prompt' && (
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(field.id, formattedValue || '')}
                      style={{ padding: 0 }}
                    >
                      {t('record.edit')}
                    </Button>
                  )}
                </Space>
              </Descriptions.Item>
            );
          })}
        </Descriptions>
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title={t('record.editPrompt')}
        open={isEditModalVisible}
        onOk={handleSaveEdit}
        onCancel={handleCancelEdit}
        width={600}
        okText={t('record.save')}
        cancelText={t('record.cancel')}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.TextArea
            ref={textAreaRef}
            value={editingValue}
            onChange={handleInputChange}
            rows={8}
            placeholder={t('record.enterPrompt')}
          />

          {/* 联想面板 */}
          {showSuggestions && (
            <Card
              size="small"
              title="资源联想"
              style={{
                maxHeight: 300,
                overflow: 'auto',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            >
              <Tabs
                activeKey={currentTab}
                onChange={setCurrentTab}
                size="small"
                items={[
                  {
                    key: 'all',
                    label: '全部',
                    children: (
                      <List
                        size="small"
                        dataSource={getFilteredSuggestions()}
                        renderItem={(item) => (
                          <List.Item
                            style={{ cursor: 'pointer', padding: '8px 12px' }}
                            onClick={() => handleSelectSuggestion(item.name)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f0f0f0';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <Space>
                              <FileTextOutlined />
                              <Text>{item.name}</Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {item.type === 'local' ? '本地文件' : '资产表'}
                              </Text>
                            </Space>
                          </List.Item>
                        )}
                      />
                    ),
                  },
                  {
                    key: 'local',
                    label: '本地文件',
                    children: (
                      <List
                        size="small"
                        dataSource={getFilteredSuggestions()}
                        renderItem={(item) => (
                          <List.Item
                            style={{ cursor: 'pointer', padding: '8px 12px' }}
                            onClick={() => handleSelectSuggestion(item.name)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f0f0f0';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <Space>
                              <FileTextOutlined />
                              <Text>{item.name}</Text>
                            </Space>
                          </List.Item>
                        )}
                      />
                    ),
                  },
                  {
                    key: 'asset',
                    label: '资产表',
                    children: (
                      <List
                        size="small"
                        dataSource={getFilteredSuggestions()}
                        renderItem={(item) => (
                          <List.Item
                            style={{ cursor: 'pointer', padding: '8px 12px' }}
                            onClick={() => handleSelectSuggestion(item.name)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f0f0f0';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <Space>
                              <FileTextOutlined />
                              <Text>{item.name}</Text>
                            </Space>
                          </List.Item>
                        )}
                      />
                    ),
                  },
                ]}
              />
            </Card>
          )}
        </Space>
      </Modal>
    </Space>
  );
}
