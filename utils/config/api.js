/**
 * api.js - API 服务器与基础 URL 配置 / API server list and base-URL configuration
 *
 * 集中维护主备 API/Web 服务器列表与登录专用服务器列表,提供当前服务器索引的
 * 读取、轮询切换与重置逻辑,被 utils/request 与多个 Page 间接使用。 / Centralized
 * primary/backup API & Web server lists plus a login-only server list. Exposes
 * index read/failover/reset helpers used by utils/request and pages.
 *
 * 功能模块 / Modules:
 * - API_SERVERS: 主备 API/Web 服务器列表 / Primary/backup API & Web server list
 * - LOGIN_API_SERVERS: 可调用微信 API 的登录服务器 / Login-only servers
 * - getApiBaseUrl() / getWebBaseUrl(): 获取当前 baseUrl / Get current base URL
 * - getLoginApiBaseUrl(): 获取登录服务器 URL / Get login server URL
 * - switchToNextServer(): 轮询切换到下一台 / Round-robin switch
 * - resetServerIndex(): 清空索引,从头开始 / Clear index to restart from primary
 *
 * 输入 / Inputs:
 * - 无显式入参,运行时从 wx.getStorageSync('apiServerIndex') 读取 / None, reads apiServerIndex at runtime
 *
 * 输出 / Outputs:
 * - string - 当前选中的 apiUrl / webUrl / Current apiUrl / webUrl
 *
 * 数据流 / Data Flow:
 * 1. 启动时本地无索引则默认使用 0(主服务器) / No stored index → defaults to 0
 * 2. request 层失败时 switchToNextServer 持久化新索引 / Persist new index on failure
 * 3. 任务开始前 resetServerIndex 清空 / Clear index at task start
 *
 * 相关文件 / Related Files:
 * - 调用 / Calls: wx.getStorageSync、wx.setStorageSync、wx.removeStorageSync
 * - 被调用 / Called by: utils/request.js(主备切换、URL 拼接) / utils/request.js (failover & URL build)
 *
 * 使用示例 / Usage Example:
 *     const { getApiBaseUrl, switchToNextServer } = require('./config/api');
 *     const url = `${getApiBaseUrl()}/api/v1/wx-submit-task`;
 *     switchToNextServer();
 *
 * 版本 / Version: 1.0
 */
// utils/config/api.js
// API 服务器配置

const API_SERVERS = [
  {
    name: '主服务器',
    apiUrl: 'https://cmb.bnu.edu.cn/rgcnformer',
    webUrl: 'https://cmb.bnu.edu.cn/rgcnformer'
  },
  {
    name: '备份服务器',
    apiUrl: 'https://rgcnformer.dawdawdawdawfafaawf.xyz',
    webUrl: 'https://rgcnformer.dawdawdawdawfafaawf.xyz'
  }
];

// 登录专用服务器列表（只有能访问微信API的服务器）
const LOGIN_API_SERVERS = [
  {
    name: '登录服务器',
    apiUrl: 'https://rgcnformer.dawdawdawdawfafaawf.xyz',
    webUrl: 'https://rgcnformer.dawdawdawdawfafaawf.xyz'
  }
];

// 获取登录服务器的 API 基础 URL
function getLoginApiBaseUrl() {
  return LOGIN_API_SERVERS[0].apiUrl;
}

// 获取当前使用的服务器索引（本地存储）
function getCurrentServerIndex() {
  return wx.getStorageSync('apiServerIndex') || 0;
}

// 切换到下一个服务器
function switchToNextServer() {
  const currentIndex = getCurrentServerIndex();
  const nextIndex = (currentIndex + 1) % API_SERVERS.length;
  wx.setStorageSync('apiServerIndex', nextIndex);
  return nextIndex;
}

// 获取当前服务器的 API 基础 URL
function getApiBaseUrl() {
  const index = getCurrentServerIndex();
  return API_SERVERS[index].apiUrl;
}

// 获取当前服务器的 Web 基础 URL
function getWebBaseUrl() {
  const index = getCurrentServerIndex();
  return API_SERVERS[index].webUrl;
}

// 重置服务器索引（用于新的任务，从头开始）
function resetServerIndex() {
  wx.removeStorageSync('apiServerIndex');
}

module.exports = {
  API_SERVERS,
  LOGIN_API_SERVERS,
  getCurrentServerIndex,
  switchToNextServer,
  getApiBaseUrl,
  getWebBaseUrl,
  getLoginApiBaseUrl,
  resetServerIndex
};
