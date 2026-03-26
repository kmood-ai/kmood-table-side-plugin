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
import { formatCellValue } from '../utils';

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
  const [taskStatus, setTaskStatus] = useState<TaskStatus>({ status: 'idle' });
  const { state: selectionState, refresh } = useSelection();
  const cellInfo = selectionState.cellValue;

  console.log('[CellOperations cellValue], ', cellInfo);

  // 提交提取任务
  const handleSubmitExtract = useCallback(async () => {
    if (!cellInfo) {
      message.warning('请先选中一个单元格');
      return;
    }

    setTaskStatus({ status: 'loading', message: '正在提交提取任务...' });

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

      message.success('提取任务提交成功！');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      setTaskStatus({
        status: 'error',
        message: `提交失败: ${errorMsg}`,
      });
      message.error(`提取任务提交失败: ${errorMsg}`);
    }
  }, [cellInfo]);

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
        text: '处理中',
      },
      success: {
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        color: 'success' as const,
        text: '已提交',
      },
      error: {
        icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
        color: 'error' as const,
        text: '失败',
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
                重置
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
      message="请先在配置区配置 Token"
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
          刷新
        </Button>
      </Space>

      {/* 选中单元格信息 */}
      {cellInfo ? (
        <Card size="small" title="选中单元格">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="数据表">
              <Text code>{selectionState.tableName}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="字段">
              <Space>
                <Text code>{selectionState.fieldName}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="内容">
              <Paragraph
                ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                style={{ marginBottom: 0, maxWidth: 250 }}
              >
                {formatCellValue(cellInfo)}
              </Paragraph>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ) : (
        <Alert
          message="请在表格中选中一个单元格"
          description="选中单元格后，可以提取其中的内容进行处理"
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
        提交提取任务
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
          <span>提取设定</span>
          {cellInfo && !disabled && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              已选中
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
