# obsidian-bookmark

黑曜书签 — Chrome 本地书签管理扩展

## 功能简介

- **本地书签浏览**：弹窗中搜索、筛选、编辑、移动、删除书签，支持键盘导航。
- **可用性检测**：批量检查 http/https 书签是否可访问，区分可用 / 跳转 / 失败。
- **重定向更新**：把检测到的跳转 URL 同步回书签。
- **重复书签清理**：按 URL 归类并批量删除。
- **AI 智能命名**：调用任意 OpenAI 兼容接口，批量生成书签标题建议。


所有数据仅保存在本地，访问网站的权限只在你主动发起检测或调用 AI 接口时按需请求。

## 构建方法

### 1. 下载源码
在 GitHub 页面点击 **Code → Download ZIP**，下载并解压项目。

### 2. 安装 Node.js
建议安装 **Node.js 18+**。

检查是否安装成功：

```bash
node -v
npm -v
```

### 3. 进入项目目录

```bash
cd obsidian-bookmark
```

### 4. 安装依赖

```bash
npm install
```

### 5. 构建项目

```bash
npm run build
```

构建完成后会生成 `dist` 文件夹。

## 在 Chrome 中加载扩展

1. 打开 `chrome://extensions/`
2. 打开右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择项目根目录下的 `dist` 文件夹

## 开发模式

```bash
npm run dev
```
