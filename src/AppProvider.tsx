import { ConfigProvider } from 'antd';
import App from './App';
import { SelectionProvider } from './contexts/SelectionProvider';
import { getAntdLocale, useI18n } from './i18n';

export default function AppProvider() {
  const { language } = useI18n();

  return (
    <ConfigProvider locale={getAntdLocale(language)}>
      <SelectionProvider>
        <App />
      </SelectionProvider>
    </ConfigProvider>
  );
}
