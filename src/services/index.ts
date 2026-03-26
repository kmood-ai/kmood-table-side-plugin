import { createConnectTransport } from "@connectrpc/connect-web";
import { createClient, type Interceptor } from "@connectrpc/connect";
import { BASE_URL } from "../constant.js";
import { Outer } from "../../generated/shotify/outer_connect.js";

/**
 * 将字符串进行 Base64 编码
 */
export function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Header 拦截器：往每个请求的 header 中注入 trpc-trans-info
 * 结构为 {"UID":"<userId_base64>","Logined":"<base64('true')>"}
 */
const authInterceptor: Interceptor = (next) => async (req) => {
  // const userId = await bitable.bridge.getUserId();
  // if (!userId) {
  //   throw new Error('用户未登录，无法执行操作');
  // }

  // 从 localStorage 读取用户配置的 token
  const token = localStorage.getItem("kmood_token");
  if (!token) {
    throw new Error("Token 未配置，请先在配置区设置 Token");
  }

  const transInfo = JSON.stringify({
    UID: token,
    Logined: toBase64("true"),
  });

  req.header.set("trpc-trans-info", transInfo);
  return next(req);
};

// Connect 传输配置，指向远端上传服务
const transport = createConnectTransport({
  baseUrl: BASE_URL + "/api", // 通过 vite proxy 转发，避免跨域
  interceptors: [authInterceptor],
});

// 创建 Upload 服务客户端
export const outerClient = createClient(Outer, transport);
