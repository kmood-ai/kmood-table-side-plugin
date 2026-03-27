import { useState, useCallback, useEffect } from 'react';
import { Typography, Card, Spin, Collapse, Tag, Space, Descriptions } from 'antd';
import { UserOutlined, DatabaseOutlined, TableOutlined, AppstoreOutlined, DownOutlined, CopyOutlined, CheckOutlined, IdcardOutlined } from '@ant-design/icons';
import { useSelection } from '../hooks';
import { bitable } from '@lark-base-open/js-sdk';


const { Title, Text } = Typography;

/**
 * 根据当前时间返回问候语
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return '早上好';
  } else if (hour >= 12 && hour < 14) {
    return '中午好';
  } else if (hour >= 14 && hour < 18) {
    return '下午好';
  } else {
    return '晚上好';
  }
}

/**
 * 欢迎区组件
 * 显示用户名称、基于时间的欢迎语，以及 SDK 获取的 Base/Table/View/Selection 信息
 */
function WelcomeSection() {
  const [userName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 使用全局选中状态
  const { state } = useSelection();
  const { selectionInfo, tableName, viewName, loading, } = state;

  const greeting = getGreeting();

  // 获取飞书用户 ID
  useEffect(() => {
    bitable.bridge.getUserId().then((id) => {
      if (id) setUserId(id);
    }).catch((err) => {
      console.error('获取用户 ID 失败:', err);
    });
  }, []);

  /** 复制 ID 到剪贴板 */
  const handleCopyId = useCallback(async (id: string, key: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (error) {
      console.error('复制失败:', error);
    }
  }, []);

  /** 渲染 ID 标签 */
  const renderIdTag = (id: string | null, label: string, key: string) => {
    if (!id) {
      return <Text type="secondary">未选中</Text>;
    }
    const isCopied = copiedId === key;

    return (
      <Space size={4}>
        <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 11, marginRight: 0 }}>
          {id}
        </Tag>
        <span
          onClick={(e) => {
            e.stopPropagation();
            handleCopyId(id, key);
          }}
          style={{
            cursor: 'pointer',
            color: isCopied ? '#52c41a' : '#8c8c8c',
            fontSize: 12,
            transition: 'color 0.2s',
          }}
          title={isCopied ? '已复制' : `复制 ${label} ID`}
        >
          {isCopied ? <CheckOutlined /> : <CopyOutlined />}
        </span>
      </Space>
    );
  };

  /** SDK 信息展示面板 */
  const sdkInfoPanel = (
    <div style={{ marginTop: 8 }}>
      <Descriptions
        size="small"
        column={1}
        styles={{ label: { width: 90 } }}
        items={[
          {
            key: 'baseId',
            label: (
              <Space>
                <DatabaseOutlined />
                <span>Base ID</span>
              </Space>
            ),
            children: renderIdTag(selectionInfo.baseId, 'Base', 'baseId'),
          },
          {
            key: 'tableId',
            label: (
              <Space>
                <TableOutlined />
                <span>Table ID</span>
              </Space>
            ),
            children: selectionInfo.tableId ? (
              <Space>
                {renderIdTag(selectionInfo.tableId, 'Table', 'tableId')}
                {tableName && <Text type="secondary" style={{ fontSize: 12 }}>({tableName})</Text>}
              </Space>
            ) : (
              <Text type="secondary">未选中</Text>
            ),
          },
          {
            key: 'viewId',
            label: (
              <Space>
                <AppstoreOutlined />
                <span>View ID</span>
              </Space>
            ),
            children: selectionInfo.viewId ? (
              <Space>
                {renderIdTag(selectionInfo.viewId, 'View', 'viewId')}
                {viewName && <Text type="secondary" style={{ fontSize: 12 }}>({viewName})</Text>}
              </Space>
            ) : (
              <Text type="secondary">未选中</Text>
            ),
          },
        ]}
      />
    </div>
  );

  const collapseItems = [
    {
      key: 'sdk-info',
      label: (
        <Text strong style={{ fontSize: 13 }}>
          当前上下文信息
        </Text>
      ),
      children: sdkInfoPanel,
    },
  ];

  return (
    <Card
      style={{ marginBottom: 16 }}
      styles={{ body: { padding: '16px 20px' } }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin size="small" />
          <Text type="secondary" style={{ marginLeft: 8 }}>加载中...</Text>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <UserOutlined style={{ fontSize: 24, color: '#1677ff' }} />
            <div>
              <Title level={5} style={{ margin: 0 }}>
                {greeting}{userName ? ',' : ''}{userName}{userName ? '!' : ''}
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                欢迎使用 KMood 多维表格工具
              </Text>
            </div>
          </div>
          {userId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingLeft: 36 }}>
              <IdcardOutlined style={{ color: '#8c8c8c', fontSize: 13 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>用户 ID：</Text>
              {renderIdTag(userId, '用户', 'userId')}
            </div>
          )}
          <Collapse
            ghost
            size="small"
            expandIcon={({ isActive }) => <DownOutlined rotate={isActive ? 180 : 0} />}
            items={collapseItems}
          />
        </>
      )}
    </Card>
  );
}

export default WelcomeSection;
