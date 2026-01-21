// index.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

// API 基础配置
const API_BASE_URL = 'https://rgcnformer.dawdawdawdawfafaawf.xyz' // 请替换为实际的API域名

Page({
  data: {
    isLoggedIn: false,
    isLogging: false,
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickName: '',
    },
    rnaSequence: 'TCAGGAGTTCGAGACCAGCCTGATCAACATGACGAAACCCTATCTCTACTAAAAATACAAAAATTAGCCGGGCGTGGTGGCATGCGCCTGTAGTCTCAGCTACTTGGGAGGCTGAAGCAGGAGAATCGTTTGAACCCAGGAGGCAGAGGTTGCAGTGAGCCGAGATCGTGCCACTGCACTCCAGCCTGGGTGACACAGCGAGACTCTGTCTCAAAAAAATAAAAATAAAAAAATAAATAAATAACCTTTAATTTAGTGAGACTTCATATAGAATTGTTTTAATGTTTAATATAGACCATTTGTTTTAGGTGAATTTAACAATTTCATACTGTGATTAAGATTAATTTCTTTTTCTGACTTCTACCAGAAAGCAGGAATTATGTTTCAAATGGACAATCATTTACCAAACCTTGTTAATCTGAATGAAGATCCACAACTATCTGAGATGCTGCTATATATGATAAAAGAAGGAACAACTACAGTTGGAAAGTATAAACCAAACTCAAGCCATGATATTCAGTTATCTGGGGTGCTGATTGCTGATGATCATTGGTATGTTAATCCTCTAAAAAAAAAGAAAAGGCACCTGTTCTATATCTTGATAACATGTGGTTTCCTTCATATGGCATATTCGTTGATACTGATCGTTTGGTAGAATTCTTCAAACCCATTGTTTAGTCAGGAAAAACATACATTCTGAGTGTGTTATAAGGATGATAGGTCAGTTACTCTCAATATAAAGTACAGTGTAATGCTCTCTCTGTTTTTGTTTTGGCATACTTGATCTGTTGATTGAAGAATAATTTATTTTCTTGCAATTATAATGATGCACATGCAAGTAAACTATCTATCTTACATAACAGAATTTTTGGTTGGATTGACCAATTTAAAAATGTTACTTTATGTGAATTTTGTTCATATGAATGGAATACTTGTATATATTGTTGGAATGATAGCGTATGTAAACTTTTTTGACTCTGCATTGTGTTTCCAAGATTTGT',
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
  },

  // 轮询定时器
  pollTimer: null,

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.checkLoginStatus();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.checkLoginStatus();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 清除定时器
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');

    if (userInfo) {
      this.setData({
        isLoggedIn: true,
        userInfo: userInfo,
      });
    } else {
      this.setData({
        isLoggedIn: false,
        userInfo: {
          avatarUrl: defaultAvatarUrl,
          nickName: '',
        },
      });
    }
  },

  /**
   * 用户登录 - 使用 wx.getUserProfile 弹出授权窗口
   */
  onLoginTap() {
    // 防止重复点击
    if (this.data.isLogging) {
      return;
    }

    // 设置登录中状态
    this.setData({ isLogging: true });

    console.log('onLoginTap 被调用');
    console.log('canIUseGetUserProfile:', this.data.canIUseGetUserProfile);

    if (!this.data.canIUseGetUserProfile) {
      this.setData({ isLogging: false });
      wx.showToast({
        title: '请使用2.10.4及以上版本基础库',
        icon: 'none',
      });
      return;
    }

    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('getUserProfile 成功:', res);
        const userInfo = res.userInfo;

        // 获取登录 code，用于换取 openid
        wx.login({
          success: (loginRes) => {
            if (loginRes.code) {
              console.log('wx.login 成功，code:', loginRes.code);

              // 调用后端接口获取 openid
              this.getOpenId(loginRes.code, userInfo);
            } else {
              console.error('wx.login 获取 code 失败');
              // 即使获取 openid 失败，也保存用户信息
              this.saveUserInfo(userInfo);
            }
          },
          fail: (err) => {
            console.error('wx.login 失败:', err);
            // 即使获取 openid 失败，也保存用户信息
            this.saveUserInfo(userInfo);
          },
        });
      },
      fail: (err) => {
        console.error('getUserProfile 失败:', err);
        console.error('错误详情:', JSON.stringify(err));
        this.setData({ isLogging: false });

        // 检查是否是用户拒绝授权
        if (err.errMsg && err.errMsg.includes('getUserProfile:fail')) {
          wx.showModal({
            title: '授权失败',
            content: '您拒绝了授权，无法使用此功能',
            showCancel: false,
          });
        } else {
          wx.showToast({
            title: '授权失败，请重试',
            icon: 'none',
          });
        }
      },
    });
  },

  /**
   * 调用后端获取 openid
   */
  getOpenId(code, userInfo) {
    wx.request({
      url: `${API_BASE_URL}/api/v1/get-openid`,
      method: 'POST',
      data: {
        code: code,
      },
      success: (res) => {
        console.log('获取 openid 响应:', res);

        if (res.statusCode === 200 && res.data.openid) {
          // 保存 openid
          wx.setStorageSync('openid', res.data.openid);
          console.log('openid 保存成功:', res.data.openid);

          // 将 openid 添加到 userInfo 中
          userInfo.openid = res.data.openid;
        } else {
          console.warn('后端未返回 openid');
        }

        // 保存用户信息
        this.saveUserInfo(userInfo);
      },
      fail: (err) => {
        console.error('获取 openid 失败:', err);
        // 即使获取 openid 失败，也保存用户信息
        this.saveUserInfo(userInfo);
      },
    });
  },

  /**
   * 保存用户信息并更新页面状态
   */
  saveUserInfo(userInfo) {
    console.log('保存用户信息:', userInfo);

    // 保存用户信息到本地缓存
    wx.setStorageSync('userInfo', userInfo);

    // 更新页面状态
    this.setData({
      isLoggedIn: true,
      userInfo: userInfo,
      isLogging: false,
    });

    wx.showToast({
      title: '登录成功',
      icon: 'success',
    });
  },

  /**
   * 调用后端获取 openid
   */
  getOpenId(code, userInfo) {
    wx.request({
      url: `${API_BASE_URL}/api/v1/get-openid`,
      method: 'POST',
      data: {
        code: code,
      },
      success: (res) => {
        console.log('获取 openid 响应:', res);

        if (res.statusCode === 200 && res.data.openid) {
          // 保存 openid
          wx.setStorageSync('openid', res.data.openid);
          console.log('openid 保存成功:', res.data.openid);

          // 将 openid 添加到 userInfo 中
          userInfo.openid = res.data.openid;
        } else {
          console.warn('后端未返回 openid');
        }

        // 保存用户信息
        this.saveUserInfo(userInfo);
      },
      fail: (err) => {
        console.error('获取 openid 失败:', err);
        // 即使获取 openid 失败，也保存用户信息
        this.saveUserInfo(userInfo);
      },
    });
  },

  /**
   * 保存用户信息并更新页面状态
   */
  saveUserInfo(userInfo) {
    console.log('保存用户信息:', userInfo);

    // 保存用户信息到本地缓存
    wx.setStorageSync('userInfo', userInfo);

    // 更新页面状态
    this.setData({
      isLoggedIn: true,
      userInfo: userInfo,
      isLogging: false,
    });

    wx.showToast({
      title: '登录成功',
      icon: 'success',
    });
  },

  /**
   * 退出登录
   */
  onLogoutTap() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地缓存
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('openid');
          wx.removeStorageSync('token');

          // 更新页面状态
          this.setData({
            isLoggedIn: false,
            userInfo: {
              avatarUrl: defaultAvatarUrl,
              nickName: '',
            },
          });

          wx.showToast({
            title: '已退出登录',
            icon: 'success',
          });
        }
      },
    });
  },

  /**
   * 序列输入框输入事件
   */
  onSequenceInput(e) {
    this.setData({
      rnaSequence: e.detail.value,
    });
  },

  /**
   * 验证RNA序列合法性
   */
  validateRNASequence(sequence) {
    // 检查长度
    if (sequence.length > 1001) {
      return {
        valid: false,
        message: '序列长度不能超过1001个字符',
      };
    }

    // 检查字符是否只包含 ACGUTN
    const validPattern = /^[ACGUTN]+$/i;
    if (!validPattern.test(sequence)) {
      return {
        valid: false,
        message: '序列只能包含 A、C、G、U、T、N 字符',
      };
    }

    return { valid: true };
  },

  /**
   * 生成前端 Job ID
   */
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  },

  /**
   * 提交按钮点击事件
   */
  onSubmitTap() {
    console.log('%c========== onSubmitTap 被调用 ==========', 'color: blue; font-size: 14px; font-weight: bold;');

    // 检查登录状态
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      });
      return;
    }

    // 检查序列输入
    const sequence = this.data.rnaSequence.trim();
    if (!sequence) {
      wx.showToast({
        title: '序列不能为空',
        icon: 'none',
      });
      return;
    }

    // 验证序列合法性
    const validation = this.validateRNASequence(sequence);
    if (!validation.valid) {
      wx.showToast({
        title: validation.message,
        icon: 'none',
        duration: 2000,
      });
      return;
    }

    // 开始提交流程
    this.submitTask(sequence);
  },

  /**
   * 提交任务到后端
   */
  submitTask(rnaSequence) {
    console.log('%c========== submitTask 被调用 ==========', 'color: green; font-size: 14px; font-weight: bold;');

    // 生成前端 Job ID
    const jobId = this.generateJobId();

    // 获取用户ID（优先使用 openid）
    const openid = wx.getStorageSync('openid');
    const userId = openid || this.data.userInfo.nickName || 'anonymous';

    console.log('提交任务 - userId:', userId, 'jobId:', jobId);

    // 构造JSON数据
    const requestData = {
      userId: userId,
      jobId: jobId,
      rnaSequence: rnaSequence,
    };

    // 打印JSON到控制台（在请求之前）
    console.log('%c========================================', 'color: red; font-size: 16px; font-weight: bold;');
    console.log('%c前端发送的JSON数据', 'color: red; font-size: 16px; font-weight: bold;');
    console.log('%c========================================', 'color: red; font-size: 16px; font-weight: bold;');
    console.log('请求URL:', `${API_BASE_URL}/api/v1/submit-task`);
    console.log('userId:', userId);
    console.log('jobId:', jobId);
    console.log('rnaSequence长度:', rnaSequence.length);
    console.log('JSON字符串:', JSON.stringify(requestData, null, 2));
    console.log('JSON对象:', requestData);
    console.log('%c========================================', 'color: red; font-size: 16px; font-weight: bold;');

    wx.showLoading({
      title: '正在提交任务...',
    });

    wx.request({
      url: `${API_BASE_URL}/api/v1/submit-task`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': wx.getStorageSync('token') || '',
      },
      data: requestData,
      success: (res) => {
        wx.hideLoading();

        if (res.statusCode === 200 && res.data.jobId) {
          // 使用后端返回的 jobId，或者使用前端生成的 jobId
          const responseJobId = res.data.jobId || jobId;
          // 开始轮询任务状态
          this.startPolling(responseJobId);
        } else {
          wx.showToast({
            title: '任务提交失败',
            icon: 'none',
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('提交任务失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
        });
      },
    });
  },

  /**
   * 开始轮询任务状态
   */
  startPolling(jobId) {
    // 显示全屏等待框
    wx.showLoading({
      title: '可视化生成中...',
      mask: true,
    });

    // 清除之前的定时器（如果有）
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    // 立即查询一次
    this.checkTaskStatus(jobId);

    // 设置定时器，每3秒查询一次
    this.pollTimer = setInterval(() => {
      this.checkTaskStatus(jobId);
    }, 3000);
  },

  /**
   * 查询任务状态
   */
  checkTaskStatus(jobId) {
    wx.request({
      url: `${API_BASE_URL}/api/v1/get-redirect-url/${jobId}`,
      method: 'GET',
      header: {
        'Authorization': wx.getStorageSync('token') || '',
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const { status, redirectUrl } = res.data;

          if (status === 'COMPLETED' && redirectUrl) {
            // 任务完成，跳转到webview页面
            this.handleTaskComplete(redirectUrl);
          } else if (status === 'FAILED') {
            // 任务失败
            this.handleTaskFailed();
          }
          // 如果是 PROCESSING，继续等待
        }
      },
      fail: (err) => {
        console.error('查询任务状态失败:', err);
        // 网络错误，继续轮询
      },
    });
  },

  /**
   * 处理任务完成
   */
  handleTaskComplete(redirectUrl) {
    // 清除定时器
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // 关闭等待框
    wx.hideLoading();

    // 跳转到webview页面
    wx.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(redirectUrl)}`,
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        });
      },
    });
  },

  /**
   * 处理任务失败
   */
  handleTaskFailed() {
    // 清除定时器
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // 关闭等待框
    wx.hideLoading();

    wx.showToast({
      title: '任务生成失败',
      icon: 'error',
    });
  },
});
