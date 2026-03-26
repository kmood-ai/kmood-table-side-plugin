/**
 * 格式化单元格值为可读字符串
 */
export function formatCellValue(value: any): string {
  if (value === null || value === undefined) {
    return "空";
  }
  if (typeof value === "string") {
    return value || "空字符串";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    // 处理多选、人员、附件等数组类型
    if (value.length === 0) return "空";
    // 尝试提取常见字段
    const texts = value.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        // 文本字段 [{type: 'text', text: '...'}]
        if (item.text) return item.text;
        // 人员字段 [{id: '...', name: '...'}]
        if (item.name) return item.name;
        // 附件字段 [{name: '...', url: '...'}]
        if (item.name && item.url) return item.name;
        // 链接字段 [{type: 'url', link: '...', text: '...'}]
        if (item.link) return item.text || item.link;
      }
      return JSON.stringify(item);
    });
    return texts.join(", ");
  }
  if (typeof value === "object") {
    // 日期类型等
    if (value.dateTime) {
      return new Date(value.dateTime).toLocaleString("zh-CN");
    }
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
