/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { bitable } from '@lark-base-open/js-sdk';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import jaJP from 'antd/locale/ja_JP';
import type { Locale } from 'antd/es/locale';
import zhCNMessages from './locales/zh-CN.json';
import enUSMessages from './locales/en-US.json';
import jaJPMessages from './locales/ja-JP.json';

export type AppLanguage = 'zh-CN' | 'en-US' | 'ja-JP';

type MessageKey = string;

type MessageDict = Record<MessageKey, string>;
// eslint-disable-next-line no-unused-vars
type TranslateFn = (...args: [MessageKey, Record<string, string | number>?]) => string;

const messages: Record<AppLanguage, MessageDict> = {
  'zh-CN': zhCNMessages as MessageDict,
  'en-US': enUSMessages as MessageDict,
  'ja-JP': jaJPMessages as MessageDict,
};

type I18nContextValue = {
  language: AppLanguage;
  t: TranslateFn;
};

const I18nContext = createContext<I18nContextValue>({
  language: 'zh-CN',
  t: () => '',
});

function formatMessage(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce((acc, [k, v]) => {
    return acc.replaceAll(`{${k}}`, String(v));
  }, template);
}

export function mapBridgeLanguage(rawLanguage?: string): AppLanguage {
  const normalized = (rawLanguage || '').trim().replace('_', '-').toLowerCase();
  if (normalized.startsWith('zh')) return 'zh-CN';
  if (normalized.startsWith('ja')) return 'ja-JP';
  return 'en-US';
}

export function getAntdLocale(language: AppLanguage): Locale {
  if (language === 'en-US') return enUS;
  if (language === 'ja-JP') return jaJP;
  return zhCN;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>('zh-CN');

  useEffect(() => {
    bitable.bridge
      .getLanguage()
      .then((lang) => {
        setLanguage(mapBridgeLanguage(lang));
      })
      .catch(() => {
        setLanguage('zh-CN');
      });
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: MessageKey, params?: Record<string, string | number>) => {
      const template = messages[language][key] || messages['zh-CN'][key] || key;
      return formatMessage(template, params);
    };
    return { language, t };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
