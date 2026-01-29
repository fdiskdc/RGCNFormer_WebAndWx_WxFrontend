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
