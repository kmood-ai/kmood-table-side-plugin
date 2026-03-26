import { useState, useEffect } from 'react';
import { Select, message } from 'antd';
import { bitable } from '@lark-base-open/js-sdk';

interface TableOption {
  label: string;
  value: string;
}

interface TableSelectorProps {
  value?: string;
  onChange?: (tableId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function TableSelector({
  value,
  onChange,
  disabled = false,
  placeholder = '请选择数据表',
}: TableSelectorProps) {
  const [options, setOptions] = useState<TableOption[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const tableList = await bitable.base.getTableList();
      const opts: TableOption[] = [];

      for (const table of tableList) {
        const name = await table.getName();
        opts.push({
          label: name,
          value: table.id,
        });
      }

      setOptions(opts);
    } catch (err) {
      console.error('获取数据表列表失败:', err);
      message.error('获取数据表列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!disabled) {
      fetchTables();
    }
  }, [disabled]);

  return (
    <Select
      style={{ width: '100%' }}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      options={options}
      loading={loading}
      disabled={disabled}
      showSearch
      filterOption={(input, option) =>
        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
      }
    />
  );
}
