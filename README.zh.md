# dsh-chat-search

在 DeepSeek Harness（DSH）里全文搜索历史对话，点结果直接跳到那条消息。

DSH 自带的 `Ctrl+K` 只过滤**会话标题**。这个插件搜的是**完整消息正文**，
命中后打开对应会话并定位到那条消息。

## 功能

- 跨全部工作区、全部会话的全文搜索（含已归档）
- 按会话分组展示，关键词高亮，显示所属工作区
- 点一下结果，打开会话并滚动、闪烁定位到那条消息
- 归档会话会先取消归档再打开（DSH 没有「原地打开归档会话」的接口）
- 大小写不敏感的字面子串匹配（不是正则）
- 只读、纯本地，消息正文不出本机

## 安装

```bash
dsh plugin --profile desktop add github:<你的用户名>/dsh-chat-search
```

或者从本地目录安装：

```bash
dsh plugin --profile desktop add ./dsh-chat-search
```

安装后重启 DSH。

## 使用

1. 打开右侧边栏，点「对话搜索」面板的放大镜图标
2. 输入关键词，回车
3. 点任意一条结果，直接跳过去

## 原理

消息正文不在投影缓存里，而在每个会话的
`$DSH_HOME/sessions/<工作区>/<会话ID>/session.v4.jsonl.zstd` 日志中。
服务端部分解压这些 zstd 帧序列，匹配 `user/message` 和
`assistant/message` 的文本。

浏览器部分注册 `sidebar.panellist` 插槽，点击时通过宿主 UI 服务
（`uiWorkspace.openSession`，归档会话用 `unarchiveSession`）打开会话，
再利用聊天区 DOM 锚点滚动定位到命中的消息。

## 限制

- 只搜用户和助手消息正文，不含思考过程、工具调用和工具结果
- 字面子串匹配，不支持正则、模糊或语义搜索
- 打开归档结果会把它从归档中取出

## 许可证

MIT
