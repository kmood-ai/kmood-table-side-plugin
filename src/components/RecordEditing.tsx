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
import { bitable, ImageQuality, type IAttachmentField, type ICell, type IFieldMeta, type IOpenAttachment, type IRecord } from '@lark-base-open/js-sdk';
import { ASSET_TABLE_ATTACHMENT_FIELD_NAME, ASSET_TABLE_NAME_FIELD_NAME, getAttachmentUrls, PRODUCTION_TABLE_ASSET_IMAGE_FIELD_NAME, PRODUCTION_TABLE_UPLOAD_FIELD_NAME } from '../utils';
import type { CellPosition } from '../types';
import EditingModal, { type SuggestionType } from './EditingModal';

const { Text, Paragraph } = Typography;

interface RecordEditingProps {
  /** Token 未配置时传 true */
  disabled: boolean;
  /**
   * 获取资产表信息
   */
  getAssetTableInfo: () => Promise<[IRecord[], IFieldMeta[], string]>;
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
export default function RecordEditing({ disabled, getAssetTableInfo }: RecordEditingProps) {
  const { t } = useI18n();
  const { state, refresh } = useSelection();
  const { selectionInfo, tableName } = state;
  const {
    getTable,
    getRecord,
    getFieldList,
    currentRecordId,
    setCell,
  } = useTable();

  // 状态管理
  const [loading, setLoading] = useState<boolean>(false);
  const [recordData, setRecordData] = useState<RecordInfo | null>(null);
  const [fieldList, setFieldList] = useState<IFieldMeta[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 编辑状态
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const [suggestions, setSuggestions] = useState<SuggestionType[][]>([]);

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
    const prevCellPositionRef = useRef<CellPosition>({ fieldId: '', recordId: '', tableId: '' });

    const getThumbnailUrls = useCallback(async () => {
      if (!recordId || !tableId || !fieldId || !attachments || attachments.length === 0) {
        return;
      }
      setLoading(true);
      const urls = await getAttachmentUrls(attachments, { fieldId, recordId, tableId }, ImageQuality.Low);
      setThumbnailUrls(urls);
      setLoading(false);
    }, [attachments, fieldId, recordId, tableId]);

    useEffect(() => {
      if (prevCellPositionRef.current.fieldId === fieldId && prevCellPositionRef.current.recordId === recordId && prevCellPositionRef.current.tableId === tableId) {
        return;
      }
      prevCellPositionRef.current = { fieldId, recordId: recordId || '', tableId: tableId || '' };
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

      const displayFieldsList = displayFields.map((field) => fields.find((f) => f.name === field)).filter(Boolean) as IFieldMeta[];

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
  const handleEdit = useCallback(async (fieldId: string, currentValue: string) => {
    const [records, fieldMetaList, assetTableId] = await getAssetTableInfo();
    const currentFieldList = await getFieldList();
    const current = currentRecordId ? await getRecord(currentRecordId) : undefined;
    const uploadField = currentFieldList.find(item => item.name === PRODUCTION_TABLE_UPLOAD_FIELD_NAME);
    const uploadedList = current ? current.fields[uploadField?.id || ''] as IOpenAttachment[] : [];

    const suggestions = [];
    if (Array.isArray(uploadedList) && uploadedList.length > 0) {
      suggestions.push(uploadedList.map((item) => ({ ...item, displayName: item.name, source: 'local', cellPosition: { fieldId: uploadField?.id || '', recordId: currentRecordId || '', tableId: selectionInfo.tableId || '' } })) as SuggestionType[]);
    } else {
      suggestions.push([])
    }

    const nameField = fieldMetaList.find(item => item.name === ASSET_TABLE_NAME_FIELD_NAME);
    const attachmentField = fieldMetaList.find(item => item.name === ASSET_TABLE_ATTACHMENT_FIELD_NAME);
    if (nameField && attachmentField) {
      const result = await Promise.all(records.map(async record => {
        const name = formatCellValue(record.fields[nameField.id]);
        const attachments = record.fields[attachmentField.id];
        const attachment = (Array.isArray(attachments) && attachments.length > 0) ? attachments[0] : {};

        return {
          ...(typeof attachment === 'object' ? attachment : {}),
          displayName: name as string,
          source: 'asset',
          cellPosition: { fieldId: attachmentField.id || '', recordId: record.recordId || '', tableId: assetTableId || '' },
        } as SuggestionType;
      }));

      suggestions.push(result.filter(item => item.name && item.token));
    }

    setSuggestions(suggestions);
    setEditingFieldId(fieldId);
    setEditingValue(currentValue || '');
    setIsEditModalVisible(true);
  }, [currentRecordId, getAssetTableInfo, getFieldList, getRecord, selectionInfo.tableId]);

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
  const handleSaveEdit = useCallback(async (newValue: string, selectedSuggestions: (IOpenAttachment & {
    source: 'local' | 'asset';
    thumbnailUrl?: string;
    cellPosition?: CellPosition;
  })[]) => {
    if (!editingFieldId || !currentRecordId || !selectionInfo.tableId) {
      return;
    }

    // 调用 setCell 更新单元格值
    await setCell(
      editingFieldId,
      currentRecordId,
      newValue,
      selectionInfo.tableId,
    );

    const table = await getTable(selectionInfo.tableId);
    const fields = await getFieldList();
    const assetTableField = fields.find(item => item.name === PRODUCTION_TABLE_ASSET_IMAGE_FIELD_NAME)?.id;
    const assetSuggestions = selectedSuggestions.filter(s => s.source === 'asset');

    if (assetTableField) {
      const field = await table.getFieldById(assetTableField) as IAttachmentField;
      const attachments = assetSuggestions.map(s => ({
        source: s.source,
        token: s.token,
        name: s.name,
        type: s.type,
        size: s.size,
        timeStamp: s.timeStamp,
      }) as IOpenAttachment);
      await field.setValue(currentRecordId, attachments);
    }

    // 关闭弹窗
    handleCancelEdit();

    // 重新加载数据
    await loadRecordData();
  }, [editingFieldId, currentRecordId, selectionInfo.tableId, setCell, getTable, getFieldList, handleCancelEdit, loadRecordData]);

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
                    <AttachmentList key={field.id + currentRecordId} attachments={cellValue as unknown as IOpenAttachment[]} fieldId={field.id} recordId={currentRecordId} tableId={selectionInfo.tableId} />
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
      <EditingModal
        visible={isEditModalVisible}
        value={editingValue}
        suggestions={suggestions}
        onCancel={handleCancelEdit}
        onSave={handleSaveEdit}
      />
    </Space>
  );
}
