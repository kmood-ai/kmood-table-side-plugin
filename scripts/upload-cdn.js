import { TosClient } from '@volcengine/tos-sdk';
import fs from 'node:fs';
import mime from 'mime';
import { execSync } from 'node:child_process';
import prompts from 'prompts';
import dotenv from 'dotenv';

// 加载 .env 配置文件
dotenv.config();

const env = process.env.TOS_ENV
// 拿来即用
console.log('部署目标：', env);

if (env === 'prod') {
  const hasUncommittedChanges =
    execSync('git status --porcelain').toString().trim() !== '';
  if (hasUncommittedChanges) {
    console.log('⛔️ 存在未提交的内容，请先提交后再进行部署。');
    process.exit(0);
  }
  console.log(`keyId: ${process.env.TOS_ACCESS_KEY_ID}, keySecret: ${process.env.TOS_ACCESS_KEY_SECRET}`)
  const response = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: '确定要部署到生产环境吗？',
  });

  if (!response.confirm) {
    process.exit(0);
  }
}


const tosClient = new TosClient({
  accessKeyId: process.env.TOS_ACCESS_KEY_ID,
  accessKeySecret: process.env.TOS_ACCESS_KEY_SECRET,
  region: process.env.TOS_REGION,
  endpoint: process.env.TOS_ENDPOINT,
  bucket: process.env.TOS_BUCKET
});

const files = new Set();

// 带 hash 的文件，缓存 10 天
const hashFileMaxAge = 3600 * 24 * 10
const maxAgeMap = {
  // html 文件，缓存 30s
  html: 30,
  css: hashFileMaxAge,
  js: hashFileMaxAge,
  webp: hashFileMaxAge,
  woff2: hashFileMaxAge,
  json: hashFileMaxAge,
  mp4: hashFileMaxAge,
  svg: hashFileMaxAge,
  gz: hashFileMaxAge,
  // 其他文件，缓存 3 分钟
  default: 180,
};

const tosname = process.env.TOS_FILE_PUBLIC_PATH || ''
console.log('!!tosname', tosname);

for (const file of await fs.promises.readdir('dist', { recursive: true })) {
  const path = 'dist/' + file;
  const stat = await fs.promises.stat(path);
  if (!stat.isFile()) {
    continue;
  }

  const ext = file.split('.').pop();
  const maxAge = maxAgeMap[ext] || maxAgeMap.default;

  const headers = {
    'cache-control': `public, max-age=${maxAge}`,
    'content-type': mime.getType(file),
    'age': maxAge
  };
  console.log('uploading 🫡 ', file, maxAge);
  files.add(file);
  await tosClient.putObject({
    key: tosname+file,
    body: await fs.promises.readFile(path),
    headers
  });
}


// let token = undefined;
// for (; ;) {
//   const objs = await tosClient.listObjectsType2({
//     ...(token ? { continuationToken: token } : {})
//   });
//   const deleteObjects = [];
//   for (const o of objs.data.Contents) {
//     if (files.has(o.Key)) {
//       continue;
//     }
//     if (o.Key.includes('monkey') || o.Key.includes('waic') || o.Key.includes('MP_verify') || o.Key.includes('android')) {
//       continue;
//     }
//     deleteObjects.push({ key: o.Key, versionId: o.VersionId });
//     console.log('deleting 🤕 ', o.Key);
//   }
//   if (deleteObjects.length > 0) {
//     await tosClient.deleteMultiObjects({
//       objects: deleteObjects
//     });
//   }

//   token = objs.data.NextContinuationToken;
//   if (!token) {
//     break;
//   }
// }

console.log('done 🫨 ');
