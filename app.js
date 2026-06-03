/**
 * app.js - 小程序入口与全局生命周期 / Mini-Program entry & global lifecycle
 *
 * 微信小程序入口文件,负责在启动/显示/隐藏时执行全局初始化,并通过 globalData
 * 暴露跨页面共享状态(目前为 userInfo 与启动时间戳)。 / WeChat Mini-Program
 * entry. Runs global init on launch/show/hide, and exposes cross-page shared
 * state via globalData (user info, launch timestamps).
 *
 * 功能模块 / Modules:
 * - App({}): 注册小程序实例,绑定生命周期回调 / Registers the app, binds lifecycle
 * - onLaunch: 启动初始化(本地存储 + wx.login) / Launch init (storage + wx.login)
 * - globalData: 跨页面共享状态 / Cross-page shared state
 *
 * 输入 / Inputs:
 * - 无显式入参,通过 wx.* API 与本地存储运行时获取 / None, via wx.* APIs and local storage at runtime
 *
 * 输出 / Outputs:
 * - 页面渲染 / 本地存储副作用(写入 logs 列表) / page render / local-storage side effects (logs list)
 *
 * 数据流 / Data Flow:
 * 1. 启动时读取本地 logs,在头部插入当前时间戳 / On launch, prepend current timestamp to local logs
 * 2. 调用 wx.login 获取 code,供后端换 openId / sessionKey / Call wx.login for backend code exchange
 * 3. globalData 暴露 userInfo 等字段,各 Page 通过 getApp() 访问 / globalData exposes fields; pages use getApp()
 *
 * 相关文件 / Related Files:
 * - 调用 / Calls: 无显式 require,依赖微信全局 wx / No explicit requires; depends on wx
 * - 被调用 / Called by: 微信小程序框架;各 Page 通过 getApp() 访问 / WeChat framework; pages via getApp()
 *
 * 使用示例 / Usage Example:
 *     // pages/index/index.js
 *     const app = getApp();
 *     console.log(app.globalData.userInfo);
 *
 * 作者 / Author: 项目组 / Project Team
 * 版本 / Version: 1.0
 */
// app.js
App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      }
    })
  },
  globalData: {
    userInfo: null
  }
})
