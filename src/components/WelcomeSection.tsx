import { useState, useCallback, useEffect } from 'react';
import { Typography, Card, Spin, Collapse, Tag, Space, Descriptions, Alert, Input, Button, message } from 'antd';
import { UserOutlined, DatabaseOutlined, TableOutlined, AppstoreOutlined, DownOutlined, CopyOutlined, CheckOutlined, IdcardOutlined, KeyOutlined, SaveOutlined, DeleteOutlined, EditOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { useSelection } from '../hooks';
import { bitable } from '@lark-base-open/js-sdk';
import { getTokenByBaseId } from '../services/tokenService';
import { TOKEN_STORAGE_KEY } from '../constant';
import { useI18n } from '../i18n';


const { Title, Text } = Typography;

const ENABLE_COPY = false;

interface WelcomeSectionProps {
  onTokenChange: (token: string | null) => void;
}

/**
 * 根据当前时间返回问候语
 */
function getGreeting(t: ReturnType<typeof useI18n>['t']): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return t('welcome.goodMorning');
  } else if (hour >= 12 && hour < 14) {
    return t('welcome.goodNoon');
  } else if (hour >= 14 && hour < 18) {
    return t('welcome.goodAfternoon');
  } else {
    return t('welcome.goodEvening');
  }
}

/**
 * 对 token 进行脱敏展示：显示前4位和后4位，中间用 **** 代替
 */
function maskToken(token: string): string {
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}

/**
 * 欢迎区组件
 * 显示用户名称、基于时间的欢迎语，以及 SDK 获取的 Base/Table/View/Selection 信息
 * 合并了原配置区的 Token 配置功能
 */
function WelcomeSection({ onTokenChange }: WelcomeSectionProps) {
  const { t } = useI18n();
  const [userName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Token 相关状态
  const [token, setToken] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenLoadingTip, setTokenLoadingTip] = useState('');

  // 使用全局选中状态
  const { state } = useSelection();
  const { selectionInfo, tableName, tableToken, viewName, loading, } = state;
  const baseId = selectionInfo.baseId;

  const greeting = getGreeting(t);
  const isConfigured = !!token;

  // 获取飞书用户 ID
  useEffect(() => {
    bitable.bridge.getUserId().then((id) => {
      if (id) setUserId(id);
    }).catch((err) => {
      console.error(t('welcome.fetchUserIdFailed'), err);
    });
  }, [t]);

  /**
   * 从后端映射表查询 Token
   */
  const fetchTokenFromMapping = useCallback(async (currentBaseId: string) => {
    setTokenLoading(true);
    setTokenLoadingTip(t('welcome.loadingTokenFromMapping'));

    try {
      const result = await getTokenByBaseId(currentBaseId);
      if (result.success && result.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
        setToken(result.token);
        onTokenChange(result.token);
      } else {
        onTokenChange(null);
      }
    } catch (error) {
      console.error(t('welcome.fetchTokenFailed'), error);
      onTokenChange(null);
    } finally {
      setTokenLoading(false);
      setTokenLoadingTip('');
    }
  }, [onTokenChange, t]);

  // 初始化：从 localStorage 读取 token，若无则查询映射表
  useEffect(() => {
    const cached = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (baseId) {
      fetchTokenFromMapping(baseId);
    } else if (cached) {
      setToken(cached);
      onTokenChange(cached);
    } else {
      onTokenChange(null);
    }
  }, [baseId]);

  // 保存 token（双向同步：localStorage + 后端映射表）
  const handleSaveToken = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      message.warning(t('welcome.tokenEmpty'));
      return;
    }

    setTokenLoading(true);
    setTokenLoadingTip(t('welcome.saving'));

    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
      setToken(trimmed);
      setInputValue('');
      setEditing(false);
      onTokenChange(trimmed);
    } catch (error) {
      message.error(t('welcome.saveFailed', { error: error instanceof Error ? error.message : 'Unknown error' }));
    } finally {
      setTokenLoading(false);
      setTokenLoadingTip('');
    }
  };

  // 清除 token
  const handleClearToken = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setInputValue('');
    setEditing(false);
    onTokenChange(null);
    message.info(t('welcome.tokenCleared'));
  };

  // 进入编辑模式
  const handleEditToken = () => {
    setEditing(true);
    setInputValue('');
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditing(false);
    setInputValue('');
  };

  /** 复制 ID 到剪贴板 */
  const handleCopyId = useCallback(async (id: string, key: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (error) {
      console.error(t('welcome.copyFailed'), error);
    }
  }, [t]);

  /** 渲染 ID 标签 */
  const renderIdTag = (id: string | null, label: string, key: string) => {
    if (!id) {
      return <Text type="secondary">{t('welcome.unselected')}</Text>;
    }
    const isCopied = copiedId === key;

    return (
      <Space size={4}>
        <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 11, marginRight: 0 }}>
          {id}
        </Tag>
        {ENABLE_COPY ? <span
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
          title={isCopied ? t('welcome.copied') : t('welcome.copyId', { label })}
        >
          {isCopied ? <CheckOutlined /> : <CopyOutlined />}
        </span> : null}
      </Space>
    );
  };

  const showTokenInput = !isConfigured || editing;

  /** Token 配置模块 */
  const tokenConfigPanel = (
    <div style={{ marginTop: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <KeyOutlined style={{ color: '#1677ff' }} />
        <Text strong style={{ fontSize: 13 }}>{t('welcome.tokenConfig')}</Text>
        {tokenLoading && <SyncOutlined spin style={{ color: '#1890ff' }} />}
        {isConfigured && !editing && !tokenLoading && (
          <Tag icon={<CheckCircleOutlined />} color="success" style={{ marginLeft: 4 }}>
            {t('welcome.configured')}
          </Tag>
        )}
      </div>
      <Spin spinning={tokenLoading} tip={tokenLoadingTip}>
        {showTokenInput ? (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Input.Password
              placeholder={t('welcome.enterToken')}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={handleSaveToken}
              allowClear
              disabled={tokenLoading}
            />
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                onClick={handleSaveToken}
                loading={tokenLoading}
              >
                {t('welcome.save')}
              </Button>
              {editing && (
                <Button size="small" onClick={handleCancelEdit} disabled={tokenLoading}>
                  {t('welcome.cancel')}
                </Button>
              )}
            </Space>
          </Space>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <Text type="secondary">{t('welcome.currentToken')}</Text>
              <Text code>{maskToken(token!)}</Text>
            </Space>
            <Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={handleEditToken}
              >
                {t('welcome.edit')}
              </Button>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={handleClearToken}
              >
                {t('welcome.clear')}
              </Button>
            </Space>
          </div>
        )}
      </Spin>
    </div>
  );

  /** SDK 信息展示面板 */
  const sdkInfoPanel = (
    <div style={{ marginTop: 8 }}>
      <Descriptions
        size="small"
        column={1}
        styles={{ label: { width: 120 } }}
        items={[
          {
            key: 'userId',
            label: (
              <Space>
                <IdcardOutlined />
                <span>User ID</span>
              </Space>
            ),
            children: userId ? (
              renderIdTag(userId, 'User', 'userId')
            ) : (
              <Text type="secondary">{t('welcome.notLoggedIn')}</Text>
            ),
          },
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
            key: 'appToken',
            label: (
              <Space>
                <DatabaseOutlined />
                <span>App Token</span>
              </Space>
            ),
            children: renderIdTag(tableToken, 'App Token', 'tableToken'),
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
              <Text type="secondary">{t('welcome.unselected')}</Text>
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
              <Text type="secondary">{t('welcome.unselected')}</Text>
            ),
          },
        ]}
      />
      {/* Token 配置模块嵌入到上下文信息中 */}
      {tokenConfigPanel}
    </div>
  );

  const collapseItems = [
    {
      key: 'sdk-info',
      label: (
        <Text strong style={{ fontSize: 13 }}>
          {t('welcome.contextInfo')}
        </Text>
      ),
      children: sdkInfoPanel,
    },
  ];

  return (
    <>
      {/* Token 未配置时，在欢迎区上方显示警告 */}
      {!isConfigured && !tokenLoading && (
        <Alert
          message={t('welcome.tokenNotConfigured')}
          description={t('welcome.configureTokenDesc')}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Card
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin size="small" />
            <Text type="secondary" style={{ marginLeft: 8 }}>{t('welcome.loading')}</Text>
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
                  {t('welcome.subtitle')}
                </Text>
              </div>
            </div>
            <Collapse
              ghost
              size="small"
              expandIcon={({ isActive }) => <DownOutlined rotate={isActive ? 180 : 0} />}
              items={collapseItems}
              // 默认收起：不设置 defaultActiveKey 或设为空数组
              defaultActiveKey={[]}
            />
          </>
        )}
      </Card>
    </>
  );
}

export default WelcomeSection;
