/**
 * request.js - 带主备自动切换的 HTTP 请求封装 / HTTP wrapper with primary/backup auto-failover
 *
 * 在 wx.request 之上做了一层封装,主服务器不可用时自动切换到备份;另提供
 * "登录专用"通道(走可访问微信 API 的服务器)。 / Wraps wx.request with
 * primary-to-backup server failover, plus a separate login-only channel for
 * servers allowed to call WeChat APIs.
 *
 * 功能模块 / Modules:
 * - requestWithFallback(path, options, maxRetries): 主备自动切换请求 / Failover request
 * - requestLogin(path, options): 登录专用请求(单一服务器) / Login-only request (single server)
 * - resetServer(): 重置服务器索引 / Reset server index for new tasks
 * - getApiBaseUrl() / getWebBaseUrl(): 透传当前 URL / Expose current URL
 *
 * 输入 / Inputs:
 * - path: string - API 路径(不含 baseUrl) / API path without baseUrl
 * - options: object - wx.request 选项(method/header/data) / wx.request options
 * - maxRetries: number|null - 最大重试次数,默认遍历所有服务器 / max retries, defaults to all servers
 *
 * 输出 / Outputs:
 * - Promise<res>: 解析 wx.request 的响应 / Promise resolving to wx.request response
 *
 * 数据流 / Data Flow:
 * 1. 从 utils/config/api 读取服务器索引与服务器列表 / Read server index & list from utils/config/api
 * 2. 调用 wx.request;200/202/404 视为成功(任务未完成但服务器正常) / 200/202/404 count as success
 * 3. 失败时 switchToNextServer 切到下一台并重试;耗尽则 reject / On failure switch & retry; reject when exhausted
 *
 * 相关文件 / Related Files:
 * - 调用 / Calls: ./config/api(主备配置)、微信 wx.request / ./config/api, wx.request
 * - 被调用 / Called by: pages/index/index.js、pages/results/results.js / pages/index/index.js, pages/results/results.js
 *
 * 使用示例 / Usage Example:
 *     const { requestWithFallback, requestLogin } = require('../../utils/request');
 *     requestWithFallback('/api/v1/wx-submit-task', { method: 'POST', data: payload })
 *       .then(res => console.log(res.data));
 *
 * 版本 / Version: 1.0
 */
// utils/request.js
// 带主备自动切换的请求封装

const { getApiBaseUrl, switchToNextServer, getWebBaseUrl, getLoginApiBaseUrl } = require('./config/api');

/**
 * 发起请求，支持主备自动切换
 * @param {string} path - API路径（不包含基础URL）
 * @param {object} options - wx.request 的其他选项
 * @param {number} maxRetries - 最大重试次数（默认遍历所有服务器）
 * @returns {Promise}
 */
function requestWithFallback(path, options = {}, maxRetries = null) {
  return new Promise((resolve, reject) => {
    const API_SERVERS = require('./config/api').API_SERVERS;
    const retryCount = maxRetries !== null ? maxRetries : API_SERVERS.length;
    let attemptIndex = 0;

    function tryRequest() {
      const currentIndex = require('./config/api').getCurrentServerIndex();
      const fullUrl = `${require('./config/api').getApiBaseUrl()}${path}`;

      console.log(`[请求] 尝试服务器 ${currentIndex + 1}/${API_SERVERS.length}: ${fullUrl}`);

      wx.request({
        url: fullUrl,
        ...options,
        success: (res) => {
          // 200、202 或 404 都视为服务器正常响应
          // 200: 成功
          // 202: 已接受（如任务提交成功）
          // 404: 资源未找到（任务未完成，不是服务器故障）
          if (res.statusCode === 200 || res.statusCode === 202 || res.statusCode === 404) {
            console.log(`[请求] 服务器 ${currentIndex + 1} 响应成功:`, res.statusCode);
            resolve(res);
          } else {
            console.warn(`[请求] 服务器 ${currentIndex + 1} 返回错误:`, res.statusCode, res.data);
            attemptNextServer();
          }
        },
        fail: (err) => {
          console.error(`[请求] 服务器 ${currentIndex + 1} 网络失败:`, err);
          attemptNextServer();
        }
      });
    }

    function attemptNextServer() {
      attemptIndex++;
      if (attemptIndex < retryCount) {
        const nextIndex = switchToNextServer();
        console.log(`[请求] 切换到服务器 ${nextIndex + 1}/${API_SERVERS.length}`);
        tryRequest();
      } else {
        reject(new Error('所有服务器均不可用'));
      }
    }

    tryRequest();
  });
}

/**
 * 重置服务器选择，用于新任务开始
 */
function resetServer() {
  const { resetServerIndex } = require('./config/api');
  resetServerIndex();
  console.log('[请求] 服务器索引已重置，将使用主服务器');
}

/**
 * 登录专用请求（使用可访问微信API的服务器）
 * @param {string} path - API路径（不包含基础URL）
 * @param {object} options - wx.request 的其他选项
 * @returns {Promise}
 */
function requestLogin(path, options = {}) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${getLoginApiBaseUrl()}${path}`;

    console.log(`[登录请求] 使用登录服务器: ${fullUrl}`);

    wx.request({
      url: fullUrl,
      ...options,
      success: (res) => {
        console.log(`[登录请求] 响应成功:`, res.statusCode);
        resolve(res);
      },
      fail: (err) => {
        console.error(`[登录请求] 网络失败:`, err);
        reject(err);
      }
    });
  });
}

module.exports = {
  requestWithFallback,
  requestLogin,
  resetServer,
  getApiBaseUrl,
  getWebBaseUrl
};
