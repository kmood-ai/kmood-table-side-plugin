import { bitable, type IOpenAttachment } from "@lark-base-open/js-sdk";
import type { CellPosition } from "../types";

/**
 * 根据附件 token 获取图片 URL
 * @param fileToken 附件 token
 * @returns 图片的临时访问 URL
 */
export async function getImageUrlsByTokens(
  fileTokens: string[],
  { fieldId, recordId, tableId }: CellPosition
): Promise<string[]> {
  try {
    // 使用飞书多维表格 SDK 获取附件 URL
    const table = await bitable.base.getTableById(tableId);
    const urls = await table.getCellAttachmentUrls(
      fileTokens,
      fieldId,
      recordId
    );
    return urls;
  } catch (error) {
    console.error("Failed to get image URL by token:", error);
    throw error;
  }
}

/**
 * 从附件对象数组中提取 URL
 * @param attachments 附件对象数组,格式如 [{ file_token: 'xxx', name: 'xxx.png' }]
 * @returns 附件信息数组,包含 token、name 和 url
 */
export async function getAttachmentUrls(
  attachments: IOpenAttachment[],
  cellPosition: CellPosition
): Promise<string[]> {
  try {
    const tokens = attachments.map((attachment) => attachment.token || "");
    const urls = await getImageUrlsByTokens(tokens, cellPosition);
    return urls;
  } catch (error) {
    console.error("Failed to get attachment URLs:", error);
    throw error;
  }
}
