import { useState, useCallback } from 'react';
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
} from 'antd';
import {
  ThunderboltOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { outerClient } from '../services';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface BatchGenerationProps {
  /** Token 未配置时传 true */
  disabled: boolean;
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
export default function BatchGeneration({ disabled }: BatchGenerationProps) {
  const { t } = useI18n();
  const [batchStatus, setBatchStatus] = useState<BatchStatus>({
    status: 'idle',
    results: [],
    totalCount: 0,
    successCount: 0,
    errorCount: 0,
  });

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
      // 调用 feishuCallback 接口进行批量生成
      const resp = await outerClient.feishuCallback({});
      
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
      }
      if (errorCount > 0) {
        message.warning(t('batchGen.partialFailedToast', { count: errorCount }));
      }
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
  }, [t]);

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
  }, []);

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
        message={t('batchGen.batchFeature')}
        description={t('batchGen.batchFeatureDesc')}
        type="info"
        showIcon
      />

      {/* 提交按钮 */}
      <Button
        type="primary"
        icon={<ThunderboltOutlined />}
        loading={batchStatus.status === 'loading'}
        onClick={handleSubmitBatch}
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
