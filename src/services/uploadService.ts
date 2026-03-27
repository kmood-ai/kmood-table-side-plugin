import { FileInfo, UploadType } from "../../generated/upload/common_pb.js";
import { BASE_URL, TOKEN_STORAGE_KEY } from "../constant.js";
import type { UploadFilesResp } from "../../generated/upload/upload_pb.js";
import { toBase64 } from "./index.js";

export type UploadResult = FileInfo;

/**
 * 上传文件s
 * @param files 文件
 * @param uploadType 文件类型
 * @param options 上传参数
 */
export async function customUploadFiles(
  files: File[],
  uploadType = UploadType.IMAGE,
  options?: {
    needCensor?: boolean;
    params?: Record<string, string>;
    abortController?: AbortController;
  }
): Promise<UploadFilesResp> {
  if (uploadType === UploadType.UNKOWN) {
    return Promise.reject(new Error("未知场景"));
  }

  if (!files.length) {
    return Promise.reject(new Error("无内容"));
  }

  const formData = new FormData();
  let path = BASE_URL + `/api/step.ipimage.upload.Upload/FeishuUploadFiles`;

  files.forEach((file) => {
    formData.append("files", file);
  });

  formData.append("uploadType", uploadType.toString());
  formData.append("mimeType", files[0].type);

  if (options?.needCensor !== undefined) {
    formData.append("needCensore", String(options.needCensor));
  }

  if (options?.params) {
    const queryString = new URLSearchParams(options.params).toString();
    path += `?${queryString}`;
  }

  // 从 localStorage 读取用户配置的 token
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) {
    throw new Error("Token 未配置，请先在配置区设置 Token");
  }

  const transInfo = JSON.stringify({
    UID: token,
    Logined: toBase64("true"),
  });

  const response = await fetch(path, {
    method: "POST",
    body: formData,
    signal: options?.abortController?.signal,
    headers: {
      "trpc-trans-info": transInfo,
    },
  });

  const responseJson = await response.json().catch(() => {
    // apmClient.reportError('parse_uploadFile_fail', {
    //   response,
    //   error
    // });
  });
  if (response.status !== 200) {
    // if (responseJson && responseJson.code === PassportErrorCode.TOKEN_EXPIRED) {
    //   await refreshToken();
    // }
    // apmClient.reportError('request_uploadFile_fail', {
    //   uploadType,
    //   responseJson
    // });

    throw new Error(responseJson);
  }

  return responseJson;
}
export { UploadType };
