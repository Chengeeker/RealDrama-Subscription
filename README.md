# RealDrama 站源订阅

独立维护 RealDrama 的站源程序、分类、目录和媒体解析逻辑。

> 当前为迁移草稿：11 个订阅包含 16 个子源，尚未完成运行验证。请勿将此状态当作可用发行版。

## 导入地址

- 仓库目录：`https://raw.githubusercontent.com/Chengeeker/RealDrama-Subscription/main/subscription.json`
- 单独站源：`https://raw.githubusercontent.com/Chengeeker/RealDrama-Subscription/main/sources/<站源ID>.json`

此目录提供开发快照，导入不代表通过验收。客户端可以预览目录、选择导入站源、检查程序版本和回退上一版。程序更新与同步站源视频目录是两个操作。

## 文件结构

- `subscription.json`：站源列表、版本、权限和包 SHA-256。
- `sources/*.json`：可单独导入的站源包。
- `programs/sdk.js`：共享解析与请求辅助。
- `programs/*.js`：站源程序。
- `build_catalog.py`：将 SDK 和站源程序组合成包并生成目录。

修改程序后运行 `python build_catalog.py`。发布更新还需要递增相应站源版本；每个 source 定义可单独设置 `version="0.1.1"`，未指定时初始版本为 0.1.0。客户端同时比较版本和包摘要，避免同名版本掩盖程序变更。

## 运行协议

单源 schema/api 版本为 1；组合订阅 schema 为 1、api 为 2，engine 为 `javascript-generator-v1`。程序实现 `sourceExecute(action,input,state)`，共享 SDK 暴露 `execute`。HTTP 请求通过 generator 交给客户端原生网络层，程序不能直接访问网络、文件或账号 Cookie。分类、目录、详情、媒体、作者和评论等操作按每个包声明的能力提供。

凭据只保存在客户端安全存储。请勿向此仓库提交 Cookie、登录令牌、签名文件或个人资料。账号凭据只会用于包声明并经客户端审核的域名，媒体 CDN 不接收整个账号 Cookie。

## 更新与兼容

固定站源 ID 用于保留目录、观看记录和配置。SHA-256 校验下载完整性，不能代替作者身份验证。客户端保存最后可用程序及上一版；更新失败应继续使用旧版。

只导入可信仓库。程序运行器设有大小、请求次数、时间及并发限制，但没有硬性堆内存配额，不能保证任意不可信程序的安全性。新运行 API 需要更新客户端；普通站点接口和解析更新可只更新订阅包。

## 当前验收范围

尚未进行静态检查、原生编译、真实账号请求或设备播放验收。不同站点的风控、登录、地区限制和媒体格式仍需逐个核查。程序能力声明不能视为实播成功。


## 组合订阅

- 抖音：sources/douyin.json，包括 douyin、douyin-live、douyin-series、douyin-theater，统一 Cookie。
- 黄果：sources/huangguo.json，包括 huangguoai、huangguo-video、cloudfront。
- children 声明子项元数据。子项默认继承父包 program，可通过自己的 program 覆盖；每项独立声明 domains、capabilities、kind 等权限和行为。父包域名必须覆盖子项域名。
- 客户端 0.11.0 起支持组合订阅。旧客户端会拒绝 API 2 并提示升级，已安装旧包继续保留。组合包版本为 0.2.0，整组更新、整组回退。
- 直播、短剧、放映厅及黄果旧单源文件保留；原 douyin.json 链接升级为抖音组合包。仓库目录仅列组合项，不重复展示子源。迁移旧拆分订阅时在完整校验和本地保存成功后替换注册表，保留原子源 ID、用户配置与历史。

当前组合导入、迁移、回退和设备播放尚未集中验收，均为开发快照。
