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
