import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  Input,
  message,
  Tabs,
  List,
  Card,
  Space,
  Typography,
  Image,
  Spin,
} from 'antd';
import {
  FileTextOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { useI18n } from '../i18n';
import type { IOpenAttachment } from '@lark-base-open/js-sdk';
import type { CellPosition } from '../types';
import { getAttachmentUrls } from '../utils';

const { Text } = Typography;

export type SuggestionType = IOpenAttachment & {
  source: 'local' | 'asset';
  thumbnailUrl?: string;
  cellPosition?: CellPosition;
  displayName: string;
}

interface EditingModalProps {
  /** 是否显示弹窗 */
  visible: boolean;
  /** 编辑的初始值 */
  value: string;
  /** 建议列表 */
  suggestions: SuggestionType[][];
  /** 关闭弹窗回调 */
  onCancel: () => void;
  /** 保存回调 */
  onSave: (value: string, selectedSuggestions: SuggestionType[]) => Promise<void>;
}

/**
 * EditingModal 组件
 * 
 * 功能：
 * - 支持编辑文本内容
 * - 支持 @ 和 【 触发联想
 * - 显示本地文件和资产表建议
 * - 编辑保存功能
 */
export default function EditingModal({
  visible,
  value,
  suggestions,
  onCancel,
  onSave,
}: EditingModalProps) {
  const { t } = useI18n();

  // 编辑状态
  const [editingValue, setEditingValue] = useState<string>(value);
  // 更新后的 suggestions 列表（包含异步获取的缩略图）
  const [updatedSuggestions, setUpdatedSuggestions] = useState<SuggestionType[][]>(suggestions);
  // 加载状态
  const [loadingThumbnails, setLoadingThumbnails] = useState<boolean>(false);


  // 联想面板状态
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [suggestionKeyword, setSuggestionKeyword] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<string>('all');
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const textAreaRef = useRef<any>(null);

  /**
   * 处理输入变化，检测触发字符
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const inputValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    setEditingValue(inputValue);
    setCursorPosition(cursorPos);

    // 检测最近的触发字符 '@' 或 '【'
    const textBeforeCursor = inputValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const lastBracketIndex = textBeforeCursor.lastIndexOf('【');
    const triggerIndex = Math.max(lastAtIndex, lastBracketIndex);

    if (triggerIndex !== -1) {
      // 提取关键词（触发字符之后到光标之间的文本）
      const keyword = textBeforeCursor.substring(triggerIndex + 1);

      // 如果关键词中没有空格或右括号，显示联想面板
      if (!keyword.includes(' ') && !keyword.includes('】')) {
        setSuggestionKeyword(keyword);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  /**
   * 过滤建议列表
   */
  const getFilteredSuggestions = () => {
    const list = currentTab === 'all'
      ? updatedSuggestions.flat()
      : currentTab === 'local'
        ? updatedSuggestions[0] || []
        : updatedSuggestions[1] || [];

    if (!suggestionKeyword) {
      return list;
    }

    return list.filter(item =>
      item.displayName.toLowerCase().includes(suggestionKeyword.toLowerCase())
    );
  };

  /**
   * 处理选择联想项
   */
  const handleSelectSuggestion = (item: SuggestionType) => {
    const textBeforeCursor = editingValue.substring(0, cursorPosition);
    const textAfterCursor = editingValue.substring(cursorPosition);

    // 找到最近的触发字符位置
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const lastBracketIndex = textBeforeCursor.lastIndexOf('【');
    const triggerIndex = Math.max(lastAtIndex, lastBracketIndex);

    // 替换触发字符和关键词为完整的标签
    const newTextBefore = textBeforeCursor.substring(0, triggerIndex);
    const insertText = `【${item.displayName}】`;
    const newValue = newTextBefore + insertText + textAfterCursor;

    setEditingValue(newValue);
    setShowSuggestions(false);

    // 将光标移动到插入内容之后
    setTimeout(() => {
      if (textAreaRef?.current) {
        const newCursorPos = newTextBefore.length + insertText.length;
        textAreaRef.current.focus();
        textAreaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  /**
   * 处理保存
   */
  const handleSave = async () => {
    try {
      // 使用正则表达式匹配【】内容
      const bracketRegex = /【([^】]+)】/g;
      const matches = [...editingValue.matchAll(bracketRegex)];
      const bracketContents = matches.map(match => match[1]);

      // 在 suggestions 中查找对应项
      const selectedSuggestions: SuggestionType[] = [];
      const allSuggestions = updatedSuggestions.flat();

      bracketContents.forEach(content => {
        const found = allSuggestions.find(suggestion => suggestion.displayName === content);
        if (found) {
          // 去重：检查是否已存在相同的 suggestion
          const exists = selectedSuggestions.some(s =>
            s.displayName === found.displayName && s.source === found.source
          );
          if (!exists) {
            selectedSuggestions.push(found);
          }
        }
      });

      await onSave(editingValue, selectedSuggestions);
      message.success(t('record.updateSuccess'));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      message.error(t('record.updateFailed') + ': ' + errorMsg);
      console.error('EditingModal: 保存失败', err);
    }
  };

  /**
   * 处理关闭
   */
  const handleCancel = () => {
    setEditingValue(value);
    setShowSuggestions(false);
    setSuggestionKeyword('');
    onCancel();
  };

  /**
   * 渲染建议项
   */
  const renderSuggestionItem = (item: SuggestionType) => (
    <List.Item
      style={{ cursor: 'pointer', padding: '8px 12px' }}
      onClick={() => handleSelectSuggestion(item)}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#f0f0f0';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <Space>
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={item.displayName}
            width={24}
            height={24}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            preview={false}
          />
        ) : item.source === 'asset' && loadingThumbnails ? (
          <Spin size="small" />
        ) : (
          item.source === 'asset' ? <PictureOutlined /> : <FileTextOutlined />
        )}
        <Text>{item.displayName}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {item.source === 'local' ? '本地文件' : '资产表'}
        </Text>
      </Space>
    </List.Item>
  );

  // fetchMissingThumbnails 函数依赖
  const fetchMissingThumbnails = useCallback(async (suggestionsList: SuggestionType[][]) => {
    setLoadingThumbnails(true);

    try {
      const updatedList = await Promise.all(
        suggestionsList.map(async (group) => {
          return await Promise.all(
            group.map(async (suggestion) => {
              // 如果已有 thumbnailUrl 或不是 asset 类型，直接返回
              if (suggestion.thumbnailUrl) {
                return suggestion;
              }

              try {
                const thumbnailUrl = await getAttachmentUrls([suggestion], suggestion.cellPosition || { fieldId: '', recordId: '', tableId: '' });
                suggestion.thumbnailUrl = thumbnailUrl[0];
                return suggestion;
              } catch (error) {
                console.warn('获取缩略图失败:', error);
                return suggestion;
              }
            })
          );
        })
      );

      setUpdatedSuggestions(updatedList);
    } catch (error) {
      console.error('批量获取缩略图失败:', error);
      setUpdatedSuggestions(suggestionsList);
    } finally {
      setLoadingThumbnails(false);
    }
  }, []);

  // 当 visible 变化时，重置编辑值并获取缩略图
  useEffect(() => {
    if (visible) {
      setEditingValue(value);
      setShowSuggestions(false);
      setSuggestionKeyword('');
      setUpdatedSuggestions(suggestions);

      // 异步获取缺失的缩略图
      fetchMissingThumbnails(suggestions);
    }
  }, [visible, value, suggestions, fetchMissingThumbnails]);



  return (
    <Modal
      title={t('record.editPrompt')}
      open={visible}
      onOk={handleSave}
      onCancel={handleCancel}
      width={600}
      okText={t('record.save')}
      cancelText={t('record.cancel')}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input.TextArea
          ref={textAreaRef}
          value={editingValue}
          onChange={handleInputChange}
          rows={8}
          placeholder={t('record.enterPrompt')}
        />

        {/* 联想面板 */}
        {showSuggestions && (
          <Card
            size="small"
            title="资源联想"
            style={{
              maxHeight: 300,
              overflow: 'auto',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          >
            <Tabs
              activeKey={currentTab}
              onChange={setCurrentTab}
              size="small"
              items={[
                {
                  key: 'all',
                  label: '全部',
                  children: (
                    <List
                      size="small"
                      dataSource={getFilteredSuggestions()}
                      renderItem={renderSuggestionItem}
                    />
                  ),
                },
                {
                  key: 'local',
                  label: '本地文件',
                  children: (
                    <List
                      size="small"
                      dataSource={getFilteredSuggestions().filter(item => item.source === 'local')}
                      renderItem={renderSuggestionItem}
                    />
                  ),
                },
                {
                  key: 'asset',
                  label: '资产表',
                  children: (
                    <List
                      size="small"
                      dataSource={getFilteredSuggestions().filter(item => item.source === 'asset')}
                      renderItem={renderSuggestionItem}
                    />
                  ),
                },
              ]}
            />
          </Card>
        )}
      </Space>
    </Modal>
  );
}