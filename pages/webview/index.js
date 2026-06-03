/**
 * webview/index.js - 内嵌 H5 的 web-view 容器 / H5 web-view container
 *
 * 接收一个 URL 参数并通过微信原生 <web-view> 加载外部 H5 页面(用于展示 3D 可视化
 * 等富交互内容),同时暴露 onMessage 用于接收 web-view 消息。 / Receives a URL
 * parameter and loads external H5 content via the native <web-view> (used for
 * 3D visualization and other rich interactions), and exposes onMessage to
 * receive postMessage events from the web-view.
 *
 * 功能模块 / Modules:
 * - onLoad(options): 解析 URL 并设置 data.url / Parse URL and set data.url
 * - onMessage(e): 接收并打印 web-view postMessage / Receive and log postMessage
 *
 * 输入 / Inputs:
 * - options.url: string - 上一页传入的目标 H5 URL(URL-encoded) / target H5 URL from previous page
 *
 * 输出 / Outputs:
 * - 页面渲染 / 加载远程 H5 内容 / page render / load remote H5 content
 *
 * 数据流 / Data Flow:
 * 1. onLoad 取出 options.url 并 decodeURIComponent / Decode the URL in onLoad
 * 2. setData 写入 data.url,触发 <web-view src="{{url}}"> 加载 / setData triggers <web-view> load
 * 3. 来自 H5 的 postMessage 由 onMessage 接收并打印 / postMessage from H5 is logged in onMessage
 *
 * 相关文件 / Related Files:
 * - 调用 / Calls: 微信原生 <web-view>(在同名 .wxml 中) / WeChat native <web-view> (in the same-named .wxml)
 * - 被调用 / Called by: pages/results/results.js(navigateToWebView) / pages/results/results.js
 *
 * 使用示例 / Usage Example:
 *     // pages/results/results.js 中:
 *     wx.navigateTo({ url: '/pages/webview/index?url=' + encodeURIComponent(webAppUrl) });
 *
 * 版本 / Version: 1.0
 */
// webview/index.js
Page({
  data: {
    url: '',
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const { url } = options;
    if (url) {
      this.setData({
        url: decodeURIComponent(url),
      });
    } else {
      wx.showToast({
        title: '缺少URL参数',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * 接收webview传递的消息
   */
  onMessage(e) {
    console.log('收到webview消息:', e.detail.data);
  },
});
