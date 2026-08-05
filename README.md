<p align="center">
  <img src="src/assets/icon128.png" alt="Curator Bookmark" width="128" height="128">
</p>



<h1 align="center">Curator Bookmark-属于你书签的everything</h1>



<p align="center">

  本地优先的 Chrome 书签搜索、整理、清理和新标签页扩展；AI 与远程解析为用户主动启用的可选辅助能力。
  当前为 Beta / 本地安装阶段，尚未在 Chrome Web Store 上架。

</p>



<p align="center">
  <img src="https://img.shields.io/badge/Chrome%20Manifest-V3-blue?logo=googlechrome" alt="Manifest V3">
  <img src="https://img.shields.io/badge/TypeScript-ES2022-3178c6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
  <img src="https://img.shields.io/github/v/release/sy0u1ti/curator-bookmarks" alt="GitHub Release">
</p>

https://github.com/user-attachments/assets/bf3dc67c-e283-412d-b568-bf0554e9d076



---



## 功能概览



### 🌟核心功能：书签检索--不再书签堆积在书签夹中吃灰



- 在扩展弹窗中浏览书签栏、展开文件夹、打开、编辑、移动和删除书签。


- 扩展弹窗支持模糊查询、语义查询和高级查询语句
  例如：
  - site:github.com 或site: github.com 限定站点。
  - folder:"前端资料"限定文件夹路径。
  - type:文档 限定AI 识别的内容类型。
  - 最近2周、昨天、上个月限定添加时间。
  - -youtube 或-"短视频"排除结果。

- 扩展弹窗可切换自然语言搜索；配置 AI 渠道后可用 AI 改写查询，未配置或不可用时回退到本地解析。



<p align="center">
  <img src="https://github.com/sy0u1ti/picx-images-hosting/raw/master/image.9kgsh3xs35.png" alt="popup">
</p>












### 🌟零负担新增收藏书签

- 快捷键直接收藏当前网页到 `Inbox / 待整理`。

- 可选自动分析：启用 AI 服务并授权相关 origin 后，可为新增书签生成标签、摘要和推荐文件夹；也可设置为仅生成信息、不自动移动。



### 🌟书签管理

- 死链检测

- 书签重定向更新

- 重复书签检测

- 书签文件夹管理



### 🌟AI功能

- 支持当前网页快速收藏和智能分类。

- 启用 AI 后可生成摘要、网页内容索引和标签，让后续检索更容易；未启用 AI 时本地搜索、手动整理和备份仍可使用。

- AI生成书签重命名建议，让书签内容更易识别。

- AI 可推荐书签文件夹；应用前可预览，手动整理结果默认优先。

- 支持 OpenAI 兼容的 Responses API 和 Chat Completions API。








### 🌟书签新标签页--不再需要多余新标签页插件，书签就是快捷入口！



- 接管 Chrome 新标签页，展示自选的书签文件夹。

- 支持自定义书签图标、拖拽排序、背景图片/视频/颜色、时间日期、搜索栏和图标布局；默认背景为本地纯色，精选远程图库需主动选择。

- 网页搜索可关闭；提交网页搜索时，查询会发送给所选搜索引擎，Curator 不代理、不记录该 query。

- 利用书签构建快捷入口，不再被多余新标签页捆绑。







## 安装



### 首次使用



1. 安装并加载扩展后，打开新标签页。

2. Curator 会替换 Chrome 新标签页，用于书签搜索和快捷入口。如果需要恢复 Chrome 默认新标签页，可在 Chrome 扩展管理页停用或移除 Curator。

3. 如果新标签页提示没有书签来源，点击 **打开设置**。

4. 在 **书签来源** 中选择要展示的文件夹，或点击 **新增书签来源文件夹** 创建专用文件夹。

5. 回到新标签页后，可继续调整搜索栏、网页搜索开关、背景、时间日期和图标布局。

### 隐私与权限

- 当前 manifest 只把 `http://*/*` 与 `https://*/*` 声明为 optional host permissions；链接检测、可选内容提取、用户配置 AI 服务和 Jina Reader 会在用户触发时按 origin 请求授权。Newtab 网页搜索和远程背景不是主机权限理由。
- Curator 不使用默认远程行为遥测；但用户提交网页搜索、主动选择精选远程背景、运行链接检测、启用 AI/Jina 或配置远程背景时会产生外部请求。





### 下载发行版





1. 前往 [Releases](https://github.com/sy0u1ti/curator-bookmarks/releases) 下载最新 `curator-bookmarks-*.zip`



2. 解压 zip 文件



3. 打开 `chrome://extensions/`，开启右上角 **开发者模式**



4. 点击 **加载已解压的扩展程序**，选择解压后的 `dist` 文件夹





### 从源码构建





需要 Node.js 18+。





```bash



npm install



npm run build



```





然后按上述步骤 3-4 加载 `dist` 文件夹。






## 开发





```bash



npm run dev          # Vite 开发模式



npm run typecheck    # TypeScript 类型检查



npm run build        # 构建 Chrome 扩展到 dist



npm run validate     # 类型检查 + 构建



```







## 许可





[MIT](LICENSE)
