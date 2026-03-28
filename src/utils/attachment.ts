import { bitable } from '@lark-base-open/js-sdk';

/**
 * 根据附件 token 获取图片 URL
 * @param fileToken 附件 token
 * @returns 图片的临时访问 URL
 */
export async function getImageUrlByToken(fileToken: string): Promise<string> {
  try {
    // 使用飞书多维表格 SDK 获取附件 URL
    const url = await bitable.base.getAttachmentUrl(fileToken);
    return url;
  } catch (error) {
    console.error('Failed to get image URL by token:', error);
    throw error;
  }
}

/**
 * 批量获取附件 URL
 * @param fileTokens 附件 token 数组
 * @returns 图片 URL 数组
 */
export async function getImageUrlsByTokens(fileTokens: string[]): Promise<string[]> {
  try {
    const urls = await Promise.all(
      fileTokens.map(token => getImageUrlByToken(token))
    );
    return urls;
  } catch (error) {
    console.error('Failed to get image URLs by tokens:', error);
    throw error;
  }
}

/**
 * 从附件对象数组中提取 URL
 * @param attachments 附件对象数组,格式如 [{ file_token: 'xxx', name: 'xxx.png' }]
 * @returns 附件信息数组,包含 token、name 和 url
 */
export async function getAttachmentUrls(
  attachments: Array<{ file_token?: string; token?: string; name?: string }>
): Promise<Array<{ token: string; name: string; url: string }>> {
  try {
    const results = await Promise.all(
      attachments.map(async (attachment) => {
        const token = attachment.file_token || attachment.token || '';
        const name = attachment.name || 'untitled';
        
        if (!token) {
          throw new Error('Attachment token is required');
        }
        
        const url = await getImageUrlByToken(token);
        return { token, name, url };
      })
    );
    return results;
  } catch (error) {
    console.error('Failed to get attachment URLs:', error);
    throw error;
  }
}
