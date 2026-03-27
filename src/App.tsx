import { useState } from 'react';
import { Divider } from 'antd';
import WelcomeSection from './components/WelcomeSection';
import OperationArea from './components/OperationArea';

function App() {
  const [token, setToken] = useState<string | null>(null);

  const isConfigured = !!token;

  return (
    <div style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}>
      {/* ① 欢迎区（合并了配置区，含问候语 + 上下文信息 + Token 配置） */}
      <WelcomeSection onTokenChange={setToken} />

      {/* ② 操作区（根据表类型自动展示不同 Tab） */}
      <OperationArea disabled={!isConfigured} />

      <Divider />
    </div>
  );
}

export default App;
