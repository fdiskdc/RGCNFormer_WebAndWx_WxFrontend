# 微信小程序前端 / WeChat Mini-Program Frontend

## 项目背景 / Project Background

本项目是 RGCNFormer RNA 修饰分类系统的**微信小程序端**,为无法使用网页端的用户提供便捷的移动端可视化分析入口。用户可在小程序中提交 RNA 序列、调用后端模型进行推理、查看分类结果与注意力可视化。

This project is the **WeChat Mini-Program frontend** of the RGCNFormer RNA modification classification system. It provides mobile-side visualization for users who cannot access the web frontend. Users can submit RNA sequences, call the backend model for inference, and view classification results and attention visualizations.

## 项目作用 / Purpose

**核心能力** / **Core capabilities**:
- 提交 RNA 序列(最多 5 条)以触发后端推理
- Submit RNA sequences (up to 5) to trigger backend inference
- 调用后端模型接口,异步获取预测结果
- Call backend model API and asynchronously fetch predictions
- 展示 12 类 RNA 修饰的分类预测
- Display 12-class RNA modification predictions
- 渲染注意力权重可视化(局部序列视口)
- Render attention weight visualization (local sequence viewport)
- 跳转到内嵌 H5 页面查看 3D 可视化
- Navigate to embedded H5 page for 3D visualization

## 技术栈 / Tech Stack

- 微信小程序原生开发(无框架)/ WeChat Mini-Program native development (no framework)
- JavaScript (ES6+)
- WXML + WXSS(模板/样式)/ WXML + WXSS (templates & styles)
- CommonJS 模块化(`require` / `module.exports`)
- 微信云开发(`.cloudbase/`,可选)/ WeChat CloudBase (`.cloudbase/`, optional)

## 目录结构 / Directory Layout

```
Cluster_WebAndWx_WxFrontend/
├── app.js                 # 小程序入口,全局生命周期与 globalData
├── app.json               # 全局配置(页面路由、窗口样式)
├── app.wxss               # 全局样式
├── project.config.json    # 微信开发者工具项目配置
├── project.private.config.json  # 私有配置(本地)
├── sitemap.json           # 站内搜索配置
├── pages/
│   ├── index/             # 首页:序列输入与提交
│   │   ├── index.js
│   │   ├── index.wxml
│   │   └── index.wxss
│   ├── results/           # 结果页:模型预测与注意力可视化
│   │   ├── results.js
│   │   ├── results.wxml
│   │   └── results.wxss
│   ├── logs/              # 启动日志页
│   │   ├── logs.js
│   │   ├── logs.wxml
│   │   └── logs.wxss
│   └── webview/           # 内嵌 H5 容器(3D 可视化等富交互)
│       ├── index.js
│       ├── index.wxml
│       └── index.wxss
└── utils/
    ├── config/
    │   └── api.js         # API 端点配置(主备服务器)
    ├── request.js         # HTTP 请求封装(主备自动切换)
    ├── rnaExamples.js     # RNA 序列示例库
    └── util.js            # 通用工具(时间格式化等)
```

## 启动方式 / Getting Started

### 环境要求 / Prerequisites

- 微信开发者工具(最新版)/ WeChat DevTools (latest version)
- 已注册的微信小程序 AppID(测试可使用"测试号")/ Registered WeChat AppID (or "test account" for trial)
- 后端服务 `Cluster_WebAndWx_backend` 已运行 / Backend `Cluster_WebAndWx_backend` running

### 打开项目 / Open the Project

1. 启动微信开发者工具 / Launch WeChat DevTools
2. 选择"导入项目" / Click "Import Project"
3. 项目目录选择 `Cluster_WebAndWx_WxFrontend/`
4. 选择项目目录 / Select directory
5. 填入 AppID(测试可勾选"测试号")/ Enter AppID (or select "test account")
6. 点击"导入" / Click "Import"

### 配置后端地址 / Configure Backend URL

编辑 `utils/config/api.js`:

```javascript
const API_SERVERS = [
  'https://your-primary-backend.com',   // 主服务器 / primary
  'https://your-backup-backend.com'     // 备份服务器 / backup
];
const WEB_SERVERS = [
  'https://your-web-frontend.com'       // 内嵌 H5 来源
];
```

开发期可在微信开发者工具中勾选"不校验合法域名"(仅限开发)。/ During development, you may enable "do not validate legal domain" in DevTools (dev only).

### 真机预览 / Preview on Device

1. 点击"预览"扫描二维码 / Click "Preview" and scan QR code
2. 真机调试:点击"真机调试"获取调试二维码 / Real-device debug: click "Real Device Debug"
3. 注意手机需开启"开发者模式" / Phone must have "Developer Mode" enabled

## 关键文件说明 / Key Files

| 文件 / File | 作用 / Purpose |
|---|---|
| `app.js` | 小程序入口,注册生命周期(onLaunch/onShow/onHide),维护 `globalData.userInfo`,记录启动时间戳 / Entry, registers lifecycle, maintains globalData, records launch timestamps |
| `app.json` | 全局配置:页面路由列表、窗口标题与背景色、tabBar / Global config: pages list, window style, tabBar |
| `pages/index/index.js` | 首页逻辑:序列输入(最多 5 条)、校验(长度 ≥ 51 且仅含 ATCGUN)、提交、进度轮询、跳转 results / Home logic: sequence input, validation, submit, progress poll, navigate to results |
| `pages/results/results.js` | 结果页逻辑:加载批量结果、按 A/C/G/U 分组展示分类树、按修饰类型过滤注意力权重、视口渲染 / Results logic: load batch results, render classification tree, filter attention by mod type, render viewport |
| `pages/webview/index.js` | 内嵌 H5 容器:接收 URL 参数,通过 `<web-view>` 加载外部 H5(3D 可视化),监听 `onMessage` / H5 container: receive URL, load via web-view, listen to postMessage |
| `pages/logs/logs.js` | 启动日志页:从本地存储读取时间戳列表,格式化后展示 / Logs page: read timestamps from storage, format and display |
| `utils/request.js` | HTTP 请求封装:`requestWithFallback`(主备自动切换)、`requestLogin`(登录专用)、`resetServer` / HTTP wrapper with primary/backup failover and login-only channel |
| `utils/config/api.js` | API 服务器配置:主备 API/Web 服务器列表、登录服务器列表、轮询切换/重置逻辑 / API server config: primary/backup list, login servers, round-robin switch/reset |
| `utils/rnaExamples.js` | RNA 序列示例库:硬编码的 ACGTN 序列数组,首页随机选用 / RNA example library: hard-coded ACGTN sequences, picked randomly on home page |
| `utils/util.js` | 通用工具:`formatTime`(YYYY/MM/DD hh:mm:ss)、`formatNumber`(补零)/ Generic utils: date formatting, number padding |

## 与后端的对接 / Backend Integration

```
小程序 → utils/request.js → utils/config/api.js (主备URL)
       ↓
   wx.request (HTTP)
       ↓
Cluster_WebAndWx_backend/server.py
       ↓
  异步任务 → 返回 batchJobId
       ↓
  前端轮询 /api/v1/wx-get-result?jobId=xxx
       ↓
  pages/results/results.js 渲染结果
```

**主要 API 端点** / **Main API endpoints**:
- `POST /api/v1/wx-submit-task` - 提交推理任务(返回 batchJobId)/ Submit task (returns batchJobId)
- `GET  /api/v1/wx-get-result?jobId=xxx` - 轮询任务结果 / Poll task result
- `POST /api/v1/wx-login` - 微信登录(走专门的登录服务器)/ WeChat login (via login-only server)

## 与其他项目的关系 / Relation to Other Projects

- **Cluster_WebAndWx_backend** - 提供 HTTP API,小程序通过 `utils/request.js` 调用 / Provides HTTP API called via `utils/request.js`
- **RGCNFormer_WebAndWx_WebFrontend** - 网页端,本项目是其微信版(功能类似,UI 精简)/ Web counterpart of this mini-program
- **rgcnformer_sum** - 模型训练与导出,本小程序不直接调用 / Model training & export; not called directly by this project

## 注意事项 / Notes

- 小程序仅在主线程调用 `wx.request`,回调中通过 `setData` 更新页面 / Only call `wx.request` on main thread; update UI via `setData` in callbacks
- 主备服务器切换在开发期可手动测试:`utils/request.js` 中可临时抛出错误触发切换 / Test failover manually in dev by throwing errors in request.js
- 微信小程序对 ES6+ 语法支持有限,避免使用 async/await 高级特性 / WeChat Mini-Program has limited ES6+ support; avoid advanced async patterns
- 提交序列长度需 ≥ 51 且仅含 A/C/G/U/T/N,提交前会校验 / Sequence length ≥ 51, chars limited to ATCGUN (validated before submit)
