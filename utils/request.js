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
