// API 基础地址：优先从环境变量 VITE_API_BASE_URL 读取，默认生产环境
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://kmood.cn";
