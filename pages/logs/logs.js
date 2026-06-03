/**
 * logs.js - 启动日志页 / Startup logs page
 *
 * 读取本地缓存的启动时间戳列表,通过 utils/util.formatTime 格式化为可读字符串
 * 后展示给用户。 / Reads the locally cached launch-timestamp list and renders it
 * as readable strings via utils/util.formatTime.
 *
 * 功能模块 / Modules:
 * - onLoad: 读取本地 logs 并格式化 / Read local logs and format them
 *
 * 输入 / Inputs:
 * - 无,运行时通过 wx.getStorageSync('logs') 获取 / None, via wx.getStorageSync('logs')
 *
 * 输出 / Outputs:
 * - 页面渲染(时间字符串列表) / page render (formatted time string list)
 *
 * 数据流 / Data Flow:
 * 1. wx.getStorageSync('logs') 取出时间戳数组 / Fetch timestamp array
 * 2. 用 util.formatTime 把每个时间戳转成可读字符串 / Format each via util.formatTime
 * 3. setData 触发页面渲染 / setData triggers render
 *
 * 相关文件 / Related Files:
 * - 调用 / Calls: ../../utils/util.js(util.formatTime) / ../../utils/util.js
 * - 被调用 / Called by: 微信小程序框架(用户从"关于/日志"入口进入) / WeChat framework
 *
 * 使用示例 / Usage Example:
 *     // 该文件由微信框架加载 / Loaded by WeChat framework
 *     // 写入方: app.js 的 onLaunch 中 wx.setStorageSync('logs', logs)
 *
 * 版本 / Version: 1.0
 */
// logs.js
const util = require('../../utils/util.js')

Page({
  data: {
    logs: []
  },
  onLoad() {
    this.setData({
      logs: (wx.getStorageSync('logs') || []).map(log => {
        return {
          date: util.formatTime(new Date(log)),
          timeStamp: log
        }
      })
    })
  }
})
