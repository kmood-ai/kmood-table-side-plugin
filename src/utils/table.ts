import type { IOpenCellValue } from "@lark-base-open/js-sdk";

/**
 * 格式化单元格值为可读字符串
 */
export function formatCellValue(
  value: IOpenCellValue,
  keepEmpty: boolean = true
): string {
  if (value === null || value === undefined) {
    return keepEmpty ? "" : "空";
  }
  if (typeof value === "string") {
    return value || (keepEmpty ? "" : "空字符串");
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    // 处理多选、人员、附件等数组类型
    if (value.length === 0) return keepEmpty ? "" : "空";
    // 尝试提取常见字段
    const texts = value.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        // 文本字段 [{type: 'text', text: '...'}]
        if ("text" in item && item.text) return String(item.text);
        // 人员字段 [{id: '...', name: '...'}]
        if ("name" in item && item.name) return String(item.name);
        // 链接字段 [{type: 'url', link: '...', text: '...'}]
        if ("link" in item)
          return "text" in item && item.text
            ? String(item.text)
            : String(item.link);
      }
      return JSON.stringify(item);
    });
    return texts.join(", ");
  }
  if (typeof value === "object") {
    // 时间戳类型 {timestamp: number}
    if ("timestamp" in value && typeof value.timestamp === "number") {
      return new Date(value.timestamp).toLocaleString("zh-CN");
    }
    // 单选类型 {text: string, id?: string}
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    // 电话类型 {phoneNumber: string}
    if ("phoneNumber" in value && typeof value.phoneNumber === "string") {
      return value.phoneNumber;
    }
    // 链接类型 {link: string, text?: string}
    if ("link" in value) {
      return "text" in value && value.text
        ? String(value.text)
        : String(value.link);
    }
    // 地理位置类型 {address: string, ...}
    if ("address" in value && typeof value.address === "string") {
      return value.address;
    }

    if ("value" in value && typeof value.value === "string") {
      return value.value;
    }
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
