import { useState } from 'react';
import { Card, Space, Button } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';

interface CollapsibleSectionProps {
  /** 标题 */
  title: string;
  /** 内容 */
  children: React.ReactNode;
  /** 默认是否展开 */
  defaultExpanded?: boolean;
  /** 样式 */
  style?: React.CSSProperties;
}

/**
 * 通用折叠组件
 * 支持传入 title 和 children，展开时展示 children，收起时只展示 title
 */
export default function CollapsibleSection({ 
  title, 
  children, 
  defaultExpanded = false,
  style 
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  return (
    <Card
      size="small"
      style={style}
      title={
        <Space>
          <span>{title}</span>
          <Button 
            type="text" 
            size="small" 
            icon={expanded ? <UpOutlined /> : <DownOutlined />}
            onClick={toggleExpanded}
          />
        </Space>
      }
      styles={{
        header: { 
          padding: '8px 12px',
          minHeight: 'auto',
          borderBottom: expanded ? undefined : 'none'
        },
        body: { 
          padding: expanded ? '12px' : 0,
          display: expanded ? 'block' : 'none'
        },
      }}
    >
      {expanded && children}
    </Card>
  );
}