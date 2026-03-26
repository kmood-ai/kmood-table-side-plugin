import { useState, useCallback } from 'react';
import { Divider, Typography, message } from 'antd';
import WelcomeSection from './components/WelcomeSection';
import TokenConfig from './components/TokenConfig';
import CellOperations from './components/CellOperations';
import BatchUploadPanel from './components/BatchUploadPanel';
import { outerClient } from './services';

const { Title } = Typography;

function App() {
  const [token, setToken] = useState<string | null>(null);

  const isConfigured = !!token;

  const onSubmitBatchPrompt = useCallback(async () => {
    try {
      await outerClient.feishuSplitShot({});
      message.success('批量 Prompt 提交成功，正在处理中，需要大约 30s 能看到结果');
    } catch (error) {
      message.error(`提交失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, []);

  const onSubmitBatchAssets = useCallback(async () => {
    try {
      await outerClient.feishuCreateUasset({});
      message.success('批量资产提交成功，正在处理中，需要大约 30s 能看到结果');
    } catch (error) {
      message.error(`提交失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, []);

  return (
    <div style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}>
      {/* ① 欢迎区 */}
      <WelcomeSection />

      {/* ② 配置区 */}
      <TokenConfig onTokenChange={setToken} />

      {/* ③ 单元格操作区 */}
      <Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>单元格操作区</Title>
      <CellOperations disabled={!isConfigured} />

      {/* ④ 表格操作区 */}
      <Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>表格操作区</Title>
      
      {/* 批量上传资产区 */}
      <BatchUploadPanel
        title="批量上传资产"
        uploadType="asset"
        disabled={!isConfigured}
        onSubmit={onSubmitBatchAssets}
      />

      {/* 批量上传 Prompt 区 */}
      <BatchUploadPanel
        title="批量上传 Prompt"
        uploadType="prompt"
        disabled={!isConfigured}
        onSubmit={onSubmitBatchPrompt}
      />

      <Divider />
    </div>
  );
}

export default App;
