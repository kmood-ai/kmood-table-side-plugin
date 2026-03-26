import { useState, useEffect } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  message,
  Tag,
} from 'antd';
import {
  KeyOutlined,
  SaveOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const TOKEN_STORAGE_KEY = 'kmood_token';

interface TokenConfigProps {
  onTokenChange: (token: string | null) => void;
}

/**
 * 对 token 进行脱敏展示：显示前4位和后4位，中间用 **** 代替
 */
function maskToken(token: string): string {
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}

export default function TokenConfig({ onTokenChange }: TokenConfigProps) {
  const [token, setToken] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [editing, setEditing] = useState(false);

  // 初始化：从 localStorage 读取 token
  useEffect(() => {
    const cached = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (cached) {
      setToken(cached);
      onTokenChange(cached);
    } else {
      onTokenChange(null);
    }
  }, []);

  // 保存 token
  const handleSave = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      message.warning('Token 不能为空');
      return;
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
    setToken(trimmed);
    setInputValue('');
    setEditing(false);
    onTokenChange(trimmed);
    message.success('Token 已保存');
  };

  // 清除 token
  const handleClear = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setInputValue('');
    setEditing(false);
    onTokenChange(null);
    message.info('Token 已清除');
  };

  // 进入编辑模式
  const handleEdit = () => {
    setEditing(true);
    setInputValue('');
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditing(false);
    setInputValue('');
  };

  const isConfigured = !!token;
  const showInput = !isConfigured || editing;

  return (
    <Card
      title={
        <Space>
          <KeyOutlined />
          <span>配置区</span>
          {isConfigured && !editing && (
            <Tag icon={<CheckCircleOutlined />} color="success">
              已配置
            </Tag>
          )}
        </Space>
      }
      size="small"
      style={{ marginBottom: 12 }}
    >
      {showInput ? (
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Input.Password
            placeholder="请输入 Token"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={handleSave}
            allowClear
          />
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              onClick={handleSave}
            >
              保存
            </Button>
            {editing && (
              <Button size="small" onClick={handleCancelEdit}>
                取消
              </Button>
            )}
          </Space>
        </Space>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <Text type="secondary">当前 Token：</Text>
              <Text code>{maskToken(token!)}</Text>
            </Space>
            <Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={handleEdit}
              >
                修改
              </Button>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={handleClear}
              >
                清除
              </Button>
            </Space>
          </div>
        </Space>
      )}
    </Card>
  );
}
