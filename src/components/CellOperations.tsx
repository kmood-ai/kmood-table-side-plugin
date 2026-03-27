import { useState, useCallback } from 'react';
import {
  Collapse,
  Space,
  Typography,
  Alert,
  Button,
  Card,
  message,
  Tag,
  Descriptions,
} from 'antd';
import {
  AimOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { outerClient } from '../services';
import { useSelection } from '../hooks';
import type { FeishuShotifyReq } from '../../generated/shotify/outer_pb';
import type { PartialMessage } from '@bufbuild/protobuf';
import { formatCellValue } from '../utils/table';
import { useI18n } from '../i18n';

const { Text, Paragraph } = Typography;

interface CellOperationsProps {
  /** Token 未配置时传 true */
  disabled: boolean;
}

interface TaskStatus {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
  traceId?: string;
}

export default function CellOperations({ disabled }: CellOperationsProps) {
  const { t } = useI18n();
  const [taskStatus, setTaskStatus] = useState<TaskStatus>({ status: 'idle' });
  const { state: selectionState, refresh } = useSelection();
  const cellInfo = selectionState.cellValue;

  // 提交提取任务
  const handleSubmitExtract = useCallback(async () => {
    if (!cellInfo) {
      message.warning(t('cell.selectCellFirst'));
      return;
    }

    setTaskStatus({ status: 'loading', message: t('cell.submittingTask') });

    try {
      // 根据单元格类型决定提取方式
      const cellValueStr = formatCellValue(cellInfo);

      // 构建请求参数
      const req: PartialMessage<FeishuShotifyReq> = {
        feishuShotifyInfo: [
          {
            prompt: cellValueStr,
            rowId: 1,
          },
        ],
      };

      const resp = await outerClient.feishuShotify(req);

      setTaskStatus({
        status: 'success',
        message: JSON.stringify(resp),
        traceId: resp.traceId,
      });

      message.success(t('cell.submitSuccess'));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setTaskStatus({
        status: 'error',
        message: `提交失败: ${errorMsg}`,
      });
      message.error(t('operation.submitFailed', { error: errorMsg }));
    }
  }, [cellInfo, t]);

  // 重置任务状态
  const handleResetTask = useCallback(() => {
    setTaskStatus({ status: 'idle' });
  }, []);

  // 渲染任务状态卡片
  const renderTaskStatus = () => {
    if (taskStatus.status === 'idle') return null;

    const statusConfig = {
      loading: {
        icon: <LoadingOutlined spin style={{ color: '#1890ff' }} />,
        color: 'processing' as const,
        text: t('cell.processing'),
      },
      success: {
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        color: 'success' as const,
        text: t('cell.submitted'),
      },
      error: {
        icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
        color: 'error' as const,
        text: t('cell.failed'),
      },
    };

    const config = statusConfig[taskStatus.status];

    return (
      <Card size="small" style={{ marginTop: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            {config.icon}
            <Tag color={config.color}>{config.text}</Tag>
            {taskStatus.status !== 'loading' && (
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleResetTask}
              >
                {t('cell.reset')}
              </Button>
            )}
          </Space>
          {taskStatus.message && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {taskStatus.message}
            </Text>
          )}
          {taskStatus.traceId && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Trace ID: {taskStatus.traceId}
            </Text>
          )}
        </Space>
      </Card>
    );
  };

  // 面板内容
  const panelContent = disabled ? (
    <Alert
        message={t('operation.pleaseConfigureToken')}
      type="warning"
      showIcon
      style={{ margin: 0 }}
    />
  ) : (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {/* 监听状态提示 */}
      <Space>
        <Button
          type="link"
          size="small"
          icon={<ReloadOutlined />}
          onClick={refresh}
        >
          {t('cell.refresh')}
        </Button>
      </Space>

      {/* 选中单元格信息 */}
      {cellInfo ? (
        <Card size="small" title={t('cell.selectedCell')}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label={t('cell.table')}>
              <Text code>{selectionState.tableName}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('cell.field')}>
              <Space>
                <Text code>{selectionState.fieldName}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label={t('cell.content')}>
              <Paragraph
                ellipsis={{ rows: 3, expandable: true, symbol: t('cell.expand') }}
                style={{ marginBottom: 0, maxWidth: 250 }}
              >
                {formatCellValue(cellInfo)}
              </Paragraph>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ) : (
        <Alert
          message={t('cell.selectCellInTable')}
          description={t('cell.selectCellDesc')}
          type="info"
          showIcon
        />
      )}

      {/* 提交按钮 */}
      <Button
        type="primary"
        icon={<ThunderboltOutlined />}
        disabled={!cellInfo || taskStatus.status === 'loading'}
        loading={taskStatus.status === 'loading'}
        onClick={handleSubmitExtract}
        block
      >
        {t('cell.submitTask')}
      </Button>

      {/* 任务状态展示 */}
      {renderTaskStatus()}
    </Space>
  );

  const items = [
    {
      key: 'cell-extract',
      label: (
        <Space>
          <AimOutlined />
          <span>{t('cell.extractSetting')}</span>
          {cellInfo && !disabled && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              {t('cell.selected')}
            </Tag>
          )}
        </Space>
      ),
      children: panelContent,
    },
  ];

  return (
    <Collapse
      items={items}
      defaultActiveKey={['cell-extract']}
      style={{ marginBottom: 12 }}
    />
  );
}
