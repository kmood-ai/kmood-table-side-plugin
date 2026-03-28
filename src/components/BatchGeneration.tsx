import { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Alert,
  Table,
  Tag,
  message,
  Descriptions,
  Spin,
} from 'antd';
import {
  ThunderboltOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { bitable, type IOpenAttachment, type IOpenCellValue, type ISelectFieldOption } from '@lark-base-open/js-sdk';
import { outerClient } from '../services';
import { useI18n } from '../i18n';
import { formatCellValue } from '../utils/table';
import { useSelection, useTable } from '../hooks';
import { PRODUCTION_TABLE_ID_FIELD_NAME, PRODUCTION_TABLE_PROMPT_FIELD_NAME } from '../utils';
import { ASSET_TABLE_ATTACHMENT_FIELD_NAME, ASSET_TABLE_ID_FIELD_NAME, ASSET_TABLE_NAME_FIELD_NAME, PRODUCTION_TABLE_ASSET_IMAGE_FIELD_NAME, PRODUCTION_TABLE_DURATION_FIELD_NAME, PRODUCTION_TABLE_MODE_CH_FIELD_NAME, PRODUCTION_TABLE_STATUS_FIELD_NAME, PRODUCTION_TABLE_UPLOAD_FIELD_NAME } from '../utils/tableTypeRules';
import { PRODUCTION_TABLE_RATIO_FIELD_NAME } from '../utils/tableTypeRules';
import { PRODUCTION_TABLE_RESOLUTION_FIELD_NAME } from '../utils/tableTypeRules';
import { Media } from '../../generated/ipimage/shotify/outer_pb';

const { Text } = Typography;

interface BatchGenerationProps {
  /** Token 未配置时传 true */
  disabled: boolean;
  /** 生产表 ID */
  assetTableId?: string;
}

interface TaskResult {
  rowId: number;
  taskId?: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  traceId?: string;
}

interface BatchStatus {
  status: 'idle' | 'loading' | 'completed';
  results: TaskResult[];
  totalCount: number;
  successCount: number;
  errorCount: number;
}

/**
 * 批量生成模块（生产表专用）
 * 
 * 功能：
 * - 读取当前生产表中的数据行
 * - 批量提交视频生成任务
 * - 展示提交结果
 */
export default function BatchGeneration({ disabled, assetTableId }: BatchGenerationProps) {
  const { t } = useI18n();
  const [batchStatus, setBatchStatus] = useState<BatchStatus>({
    status: 'idle',
    results: [],
    totalCount: 0,
    successCount: 0,
    errorCount: 0,
  });
  const { state } = useSelection();
  const [availableTaskCount, setAvailableTaskCount] = useState<number>(0);
  const [recordIdsAvailable, setRecordIdsAvailable] = useState<string[]>([]);
  const [isLoadingCount, setIsLoadingCount] = useState<boolean>(true);

  const { getRecord, getFieldList, getTable, updateRecord } = useTable();

  /**
   * 统计可提交任务数量
   */
  const fetchAvailableTaskCount = useCallback(async () => {
    setIsLoadingCount(true);
    try {
      // 获取当前活动表
      const table = await bitable.base.getActiveTable();

      // 获取字段元数据
      const fieldMetaList = await table.getFieldMetaList();

      // 查找 prompt 和状态字段
      const promptField = fieldMetaList.find(f => f.name === 'prompt' || f.name.toLowerCase().includes('prompt'));
      const statusField = fieldMetaList.find(f => f.name === '状态' || f.name === 'status' || f.name.toLowerCase().includes('status'));

      if (!promptField) {
        console.warn('BatchGeneration: 未找到 prompt 字段');
        setAvailableTaskCount(0);
        return;
      }

      // 获取所有记录
      const recordsResponse = await table.getRecordsByPage({ pageSize: 100 });
      const records = recordsResponse.records;
      const recordIdsAvailable = [];

      // 过滤可提交的记录
      let count = 0;
      for (const record of records) {
        // 检查 prompt 字段是否不为空
        const promptValue = record.fields[promptField.id];

        const promptText = formatCellValue(promptValue);

        if (!promptText || promptText.trim() === '') {
          continue;
        }

        // 检查状态字段
        if (statusField) {
          const statusValue = record.fields[statusField.id];
          const statusText = formatCellValue(statusValue);

          // 如果状态是「生成中」或「生成成功」，跳过
          if (statusText === '生成中' || statusText === '生成成功' ||
            statusText === 'generating' || statusText === 'success') {
            continue;
          }
        }

        recordIdsAvailable.push(record.recordId);
        count++;
      }

      setAvailableTaskCount(count);
      setRecordIdsAvailable(recordIdsAvailable);
    } catch (error) {
      console.error('BatchGeneration: 获取可提交任务数量失败', error);
      setAvailableTaskCount(0);
      setRecordIdsAvailable([]);
    } finally {
      setIsLoadingCount(false);
    }
  }, []);

  // 组件挂载时统计可提交任务数量
  useEffect(() => {
    fetchAvailableTaskCount();
  }, [fetchAvailableTaskCount]);

  /**
   * 提交批量生成任务
   */
  const handleSubmitBatch = useCallback(async () => {
    setBatchStatus({
      status: 'loading',
      results: [],
      totalCount: 0,
      successCount: 0,
      errorCount: 0,
    });

    try {
      // 构建 segmentInfos 参数
      const segmentInfos = [];
      const updateRecordIds: { recordId: string, id: number }[] = [];
      const fieldMetaList = await getFieldList();

      // 查找相关字段
      const idField = fieldMetaList.find(f => f.name === PRODUCTION_TABLE_ID_FIELD_NAME);
      const promptField = fieldMetaList.find(f => f.name === PRODUCTION_TABLE_PROMPT_FIELD_NAME);
      const durationField = fieldMetaList.find(f => f.name === PRODUCTION_TABLE_DURATION_FIELD_NAME);
      const ratioField = fieldMetaList.find(f => f.name === PRODUCTION_TABLE_RATIO_FIELD_NAME);
      const resolutionField = fieldMetaList.find(f => f.name === PRODUCTION_TABLE_RESOLUTION_FIELD_NAME);
      const modeChField = fieldMetaList.find(f => f.name === PRODUCTION_TABLE_MODE_CH_FIELD_NAME);
      const uploadField = fieldMetaList.find(f => f.name === PRODUCTION_TABLE_UPLOAD_FIELD_NAME);
      const assetImageField = fieldMetaList.find(f => f.name === PRODUCTION_TABLE_ASSET_IMAGE_FIELD_NAME);



      // 根据 recordIdsAvailable 构建参数
      for (let i = 0; i < recordIdsAvailable.length; i++) {
        const recordId = recordIdsAvailable[i];

        try {
          const record = await getRecord(recordId);

          if (!record) {
            continue;
          }

          // 获取各字段的值
          const idValue = idField ? formatCellValue(record.fields[idField.id]) : '';
          const promptValue = promptField ? formatCellValue(record.fields[promptField.id]) : '';
          const durationValue = durationField ? parseInt(formatCellValue(record.fields[durationField.id]) || '5') : 5;
          const ratioValue = ratioField ? formatCellValue(record.fields[ratioField.id]) || '9:16' : '9:16';
          const resolutionValue = resolutionField ? formatCellValue(record.fields[resolutionField.id]) || '720p' : '720p';
          const modeChValue = modeChField ? formatCellValue(record.fields[modeChField.id]) || '首帧' : '首帧';
          const uploadValue = uploadField ? (record.fields[uploadField.id] || []) as IOpenAttachment[] : [];
          const assetImageValue = assetImageField ? (record.fields[assetImageField.id] || []) as IOpenAttachment[] : [];

          const nameMediaMap: Record<string, Media> = {};

          for (const attachment of uploadValue) {
            if (attachment.name) {
              nameMediaMap[attachment.name] = new Media({
                fileToken: attachment.token,
                fileType: attachment.type,
                fileSize: attachment.size.toString(),
              });
            }
          }

          if (assetTableId) {
            const assetTable = await getTable(assetTableId);
            const fieldMetaList = await assetTable?.getFieldMetaList();
            const recordsResponse = await assetTable.getRecordsByPage({ pageSize: 100 });
            const records = recordsResponse.records;

            const assetNameField = fieldMetaList?.find(f => f.name === ASSET_TABLE_NAME_FIELD_NAME);
            const assetAttachmentField = fieldMetaList?.find(f => f.name === ASSET_TABLE_ATTACHMENT_FIELD_NAME);

            for (const attachment of assetImageValue) {
              const targetRecord = records.find(r => {
                return (r.fields[assetAttachmentField?.id || ''] as IOpenAttachment[])?.[0].name === attachment.name;
              });
              if (!targetRecord?.fields[assetNameField?.id || '']) {
                continue;
              }
              const assetName = formatCellValue(targetRecord?.fields[assetNameField?.id || '']);

              if (assetName) {
                nameMediaMap[assetName] = new Media({
                  fileToken: attachment.token,
                  fileType: attachment.type,
                  fileSize: attachment.size.toString(),
                });
              }

            }

          }

          const segmentInfo = {
            id: parseInt(idValue),
            prompt: promptValue,
            duration: durationValue,
            model: 'doubao-seedance-2-0',
            rowId: recordId,
            quality: '',
            traceId: '', // 由服务端生成
            ratio: ratioValue,
            resolution: resolutionValue,
            modeCh: modeChValue,
            enableSearch: false, // 默认不开启联网搜索
            generateAudio: true, // 默认带声音
            userUploadFileTokens: '', // 暂时留空
            extractImgIds: '', // 暂时留空
            extendVideoIds: '', // 暂时留空
            nameMediaMap,
          };

          updateRecordIds.push({
            recordId,
            id: parseInt(idValue),
          });
          segmentInfos.push(segmentInfo);
        } catch (error) {
          console.error(`BatchGeneration: 获取记录 ${recordId} 失败`, error);
        }
      }

      // 调用 feishuCallback 接口进行批量生成
      const resp = await outerClient.feishuCallback({
        segmentInfos,
        tableId: state.selectionInfo.tableId || '',
        tableToken: state.tableToken || '',
        shotifyTableId: assetTableId || '',
        enableAtMedia: true,
      });

      // 解析响应结果
      const results: TaskResult[] = (resp.shotAsyncReses || []).map((item, index) => ({
        rowId: index + 1,
        taskId: item.taskId || undefined,
        status: item.taskId ? 'success' : 'error',
        message: item.taskId ? t('batchGen.taskSubmitted') : (item.reason || t('operation.submitFailed', { error: 'unknown' })),
        traceId: item.traceId || undefined,
      }));

      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      setBatchStatus({
        status: 'completed',
        results,
        totalCount: results.length,
        successCount,
        errorCount,
      });

      if (successCount > 0) {
        message.success(t('batchGen.submitSuccessToast', { count: successCount }));
        // 将状态回写到表格中
        try {
          // 获取状态字段
          const fieldMetaList = await getFieldList();

          const statusField = fieldMetaList.find(f => f.name === PRODUCTION_TABLE_STATUS_FIELD_NAME);
          const options = (statusField?.property as unknown as { options: ISelectFieldOption[] })?.options;

          const waitingOption = options?.find(o => o.name === '生成中') || undefined;

          if (statusField) {
            // 获取成功提交的 recordId 列表
            const successfulRecordIds = resp.shotAsyncReses
              .filter(result => Boolean(result.taskId))
              .map((result) => updateRecordIds.find(r => r.id === result.id)?.recordId)
              .filter(Boolean);

            // 批量更新状态为"生成中"
            const updatePromises = successfulRecordIds.map(async (recordId) => {
              if (recordId) {
                return updateRecord(recordId, {
                  [statusField.id]: {
                    id: waitingOption?.id || '',
                    text: waitingOption?.name || '',
                  } as IOpenCellValue
                })
              }
              return Promise.resolve();
            });

            await Promise.allSettled(updatePromises);
          }
        } catch (error) {
          // console.error('BatchGeneration: 状态回写失败', error);
        }
      }
      if (errorCount > 0) {
        message.warning(t('batchGen.partialFailedToast', { count: errorCount }));
      }

      // 提交成功后重新统计可提交任务数量
      fetchAvailableTaskCount();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      message.error(t('batchGen.submitFailed', { error: errorMsg }));
      setBatchStatus({
        status: 'completed',
        results: [{
          rowId: 0,
          status: 'error',
          message: errorMsg,
        }],
        totalCount: 0,
        successCount: 0,
        errorCount: 1,
      });
    }
  }, [t, fetchAvailableTaskCount, recordIdsAvailable, assetTableId, state.selectionInfo.tableId, state.tableToken]);

  /**
   * 重置状态
   */
  const handleReset = useCallback(() => {
    setBatchStatus({
      status: 'idle',
      results: [],
      totalCount: 0,
      successCount: 0,
      errorCount: 0,
    });
    // 重置后重新统计可提交任务数量
    fetchAvailableTaskCount();
  }, [fetchAvailableTaskCount]);

  // 结果表格列定义
  const columns = [
    {
      title: t('batchGen.rowId'),
      dataIndex: 'rowId',
      key: 'rowId',
      width: 60,
    },
    {
      title: t('batchGen.status'),
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const config = {
          pending: { icon: <LoadingOutlined spin />, color: 'processing', text: t('cell.processing') },
          success: { icon: <CheckCircleOutlined />, color: 'success', text: t('batchGen.success') },
          error: { icon: <CloseCircleOutlined />, color: 'error', text: t('batchGen.fail') },
        };
        const c = config[status as keyof typeof config] || config.error;
        return <Tag icon={c.icon} color={c.color}>{c.text}</Tag>;
      },
    },
    {
      title: 'Task ID',
      dataIndex: 'taskId',
      key: 'taskId',
      ellipsis: true,
      render: (taskId?: string) => taskId ? <Text code copyable={{ text: taskId }}>{taskId}</Text> : '-',
    },
    {
      title: t('batchGen.message'),
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
  ];

  if (disabled) {
    return (
      <Alert
        message={t('operation.pleaseConfigureToken')}
        type="warning"
        showIcon
      />
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {/* 操作说明 */}
      <Alert
        description={
          <Space direction="vertical" style={{ width: '100%' }}>
            {isLoadingCount ? (
              <Space>
                <Spin size="small" />
                <Text type="secondary">{t('batchGen.loadingTaskCount')}</Text>
              </Space>
            ) : (
              <Text strong>
                {t('batchGen.availableTaskCount', { count: availableTaskCount })}
              </Text>
            )}
          </Space>
        }
        type="info"
        showIcon
      />

      {/* 提交按钮 */}
      <Button
        type="primary"
        icon={<ThunderboltOutlined />}
        loading={batchStatus.status === 'loading'}
        onClick={handleSubmitBatch}
        disabled={availableTaskCount === 0}
        block
      >
        {t('batchGen.submitBatchTask')}
      </Button>

      {/* 结果统计 */}
      {batchStatus.status === 'completed' && batchStatus.totalCount > 0 && (
        <Card size="small" title={t('batchGen.submitResult')}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions size="small" column={3}>
              <Descriptions.Item label={t('batchGen.total')}>
                <Text strong>{batchStatus.totalCount}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('batchGen.success')}>
                <Text type="success" strong>{batchStatus.successCount}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('batchGen.fail')}>
                <Text type="danger" strong>{batchStatus.errorCount}</Text>
              </Descriptions.Item>
            </Descriptions>

            <Table
              dataSource={batchStatus.results}
              columns={columns}
              rowKey="rowId"
              size="small"
              pagination={false}
              scroll={{ y: 200 }}
            />

            <Button
              type="link"
              icon={<ReloadOutlined />}
              onClick={handleReset}
            >
              {t('cell.reset')}
            </Button>
          </Space>
        </Card>
      )}

      {/* 错误提示（无结果时） */}
      {batchStatus.status === 'completed' && batchStatus.totalCount === 0 && batchStatus.errorCount > 0 && (
        <Alert
          message={t('operation.submitFailed', { error: '' })}
          description={batchStatus.results[0]?.message || 'Unknown error'}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={handleReset}>
              {t('batchGen.retry')}
            </Button>
          }
        />
      )}
    </Space>
  );
}
