# RealDrama Subscription

这是 RealDrama 客户端使用的可独立更新订阅包仓库。本文仅说明目录、包格式、构建与兼容机制；实际条目以订阅目录及其校验结果为准。

## 订阅地址

- 订阅目录：[subscription.json](https://raw.githubusercontent.com/Chengeeker/RealDrama-Subscription/main/subscription.json)
- 单个订阅包模板：`https://raw.githubusercontent.com/Chengeeker/RealDrama-Subscription/main/sources/<source-id>.json`

在客户端的“站源管理 → 站源订阅”中导入目录链接，可浏览并选择目录中的包；也可以按包路径直接导入单个 JSON。

## 仓库结构

- `subscription.json`：订阅目录，记录包元数据、兼容协议、能力声明、状态、下载路径和 SHA-256。
- `sources/*.json`：可独立导入和更新的订阅包；组合包可包含多个可分别启用的子项。
- `programs/*.js`：订阅程序和共享 SDK。
- `build_catalog.py`：读取程序与定义，生成订阅包及目录校验值。

## 构建与更新

需要 Python 3。在仓库根目录运行：

```powershell
py -3 build_catalog.py
```

修改程序后重新生成目录和包，并递增对应包的版本号。目录和包中的 SHA-256 会随生成结果更新。稳定的包 ID 用于匹配客户端中的设置、资料和更新记录，发布后不应随意更改。

## 运行协议

- 单包与组合包通过 `schema`、`api` 和 `engine` 声明数据格式及运行接口；组合包使用 `children` 描述子项。
- 程序入口为 `sourceExecute(action, input, state)`。网络请求以受限请求描述交给客户端原生网络层执行。
- 包通过 `capabilities` 声明可执行的操作，通过 `domains` 与 `credentialDomains` 限定普通请求和凭据请求的目标域名。
- 可选 `browserCredentialDomains` 必须是 `credentialDomains` 的子集，并且仅在 `browser: true` 时生效；客户端只在列出的域名上将订阅凭据与浏览器兼容请求配合使用，每个来源隔离自己的 Cookie 会话。使用此能力的订阅要求客户端 `1.1.4+2224` 或更新版本。
- 程序运行在客户端受限环境中，不直接访问本地文件、网络套接字或凭据存储。新协议能力需要客户端版本支持。

## 完整性与安全

客户端会校验包的 SHA-256，并限制请求次数、执行时间和并发。摘要只能检查下载内容是否与目录记录一致，不能证明发布者身份；请只导入可信来源。客户端兼容性、账号授权、上游可用性和实际播放效果应分别验证。

Cookie、令牌、签名文件及个人配置不得提交到仓库。凭据由客户端安全存储，并仅按包声明和客户端策略使用。

## 状态说明

订阅目录或包中的 `draft` 表示开发快照。通过生成、摘要或静态检查不等于已完成真实账号、上游接口和设备端验收。
