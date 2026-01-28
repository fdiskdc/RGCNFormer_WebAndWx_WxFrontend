// index.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

// 引入RNA示例序列
const { RNA_EXAMPLES } = require('../../utils/rnaExamples');

// API 基础配置
const API_BASE_URL = 'https://rgcnformer.dawdawdawdawfafaawf.xyz' // 请替换为实际的API域名

Page({
  data: {
    isLoggedIn: false,
    isLogging: false,
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickname: '',
    },
    rnaSequences: [{ value: '' }],  // 初始为空，onLoad时加载随机示例
    focusedIndex: 0,  // 当前聚焦的输入框索引
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    // 进度条相关
    showProgress: false,
    progressCurrent: 0,
    progressTotal: 0,
    batchJobId: '',
  },

  // 轮询定时器
  pollTimer: null,

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.checkLoginStatus();
    this.loadRandomExample();
  },

  /**
   * 加载随机RNA示例序列
   */
  loadRandomExample() {
    const randomIndex = Math.floor(Math.random() * RNA_EXAMPLES.length);
    this.setData({
      rnaSequences: [{ value: RNA_EXAMPLES[randomIndex] }]
    });
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
    this.clearPollTimer();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    this.clearPollTimer();
  },

  /**
   * 清除轮询定时器
   */
  clearPollTimer() {
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
          nickname: '',
        },
      });
    }
  },

  /**
   * 用户登录 - 调用后端 API
   */
  onLoginTap() {
    // 防止重复点击
    if (this.data.isLogging) {
      return;
    }

    // 设置登录中状态
    this.setData({ isLogging: true });

    // 先获取用户授权信息（昵称和头像）
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (profileRes) => {
        console.log('getUserProfile 成功:', profileRes);
        console.log('userInfo.nickName:', profileRes.userInfo?.nickName);
        console.log('userInfo.avatarUrl:', profileRes.userInfo?.avatarUrl);

        const userProfile = profileRes.userInfo;

        wx.showLoading({
          title: '登录中...',
        });

        // 获取微信登录 code
        wx.login({
          success: (loginRes) => {
            if (loginRes.code) {
              console.log('wx.login 成功，code:', loginRes.code);

              // 调用后端登录接口，同时发送用户信息
              const loginUrl = `${API_BASE_URL}/api/v1/wx/login`;
              console.log('登录请求URL:', loginUrl);
              console.log('API_BASE_URL:', API_BASE_URL);

              wx.request({
                url: loginUrl,
                method: 'POST',
                header: {
                  'Content-Type': 'application/json',
                },
                data: {
                  loginCode: loginRes.code,
                  nickname: userProfile.nickName,
                  avatarUrl: userProfile.avatarUrl,
                },
                success: (res) => {
                  wx.hideLoading();

                  if (res.statusCode === 200 && res.data.code === 0) {
                    // 后端返回的数据格式: { code: 0, openid: xxx, data: { nickname, avatarUrl }, message: xxx }
                    const backendData = res.data.data || {};

                    // 构造用户信息对象，优先使用后端返回的数据
                    const userInfo = {
                      nickname: backendData.nickname || userProfile.nickName,
                      avatarUrl: backendData.avatarUrl || userProfile.avatarUrl,
                      openid: res.data.openid,
                    };

                    // 保存 loginCode 到本地
                    wx.setStorageSync('loginCode', loginRes.code);

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

                    console.log('登录成功，用户信息:', userInfo);
                  } else {
                    this.setData({ isLogging: false });
                    wx.showToast({
                      title: res.data?.error || '登录失败',
                      icon: 'none',
                    });
                  }
                },
                fail: (err) => {
                  wx.hideLoading();
                  this.setData({ isLogging: false });
                  console.error('后端登录请求失败:', err);
                  wx.showToast({
                    title: '网络错误，请重试',
                    icon: 'none',
                  });
                },
              });
            } else {
              wx.hideLoading();
              this.setData({ isLogging: false });
              wx.showToast({
                title: '获取登录凭证失败',
                icon: 'none',
              });
            }
          },
          fail: (err) => {
            wx.hideLoading();
            this.setData({ isLogging: false });
            console.error('wx.login 失败:', err);
            wx.showToast({
              title: '登录失败，请重试',
              icon: 'none',
            });
          },
        });
      },
      fail: (err) => {
        console.error('getUserProfile 失败:', err);
        this.setData({ isLogging: false });

        // 检查是否是用户拒绝授权
        if (err.errMsg && err.errMsg.includes('getUserProfile:fail')) {
          wx.showModal({
            title: '授权失败',
            content: '您拒绝了授权，无法获取昵称和头像',
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
          wx.removeStorageSync('loginCode');
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
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const rnaSequences = this.data.rnaSequences;
    // 自动转换为大写并过滤非法字符（只保留 ACGUTN）
    const filteredValue = value.toUpperCase().replace(/[^ACGUTN]/g, '');
    rnaSequences[index].value = filteredValue;
    this.setData({
      rnaSequences: rnaSequences,
    });
  },

  /**
   * 序列输入框聚焦事件
   */
  onSequenceFocus(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      focusedIndex: index,
    });
  },

  /**
   * 序列输入框失焦事件
   */
  onSequenceBlur(e) {
    // 失焦时不做处理，保持当前聚焦状态
  },

  /**
   * 添加序列输入框
   */
  onAddSequence() {
    if (this.data.rnaSequences.length < 5) {
      const rnaSequences = this.data.rnaSequences.concat({ value: '' });
      const newIndex = rnaSequences.length - 1;
      this.setData({
        rnaSequences: rnaSequences,
        focusedIndex: newIndex,  // 新增的输入框自动聚焦
      });
    }
  },

  /**
   * 删除序列输入框
   */
  onDeleteSequence(e) {
    const index = e.currentTarget.dataset.index;
    const rnaSequences = this.data.rnaSequences.filter((_, i) => i !== index);

    // 调整聚焦索引
    let newFocusedIndex = this.data.focusedIndex;
    if (index === this.data.focusedIndex) {
      // 如果删除的是当前聚焦的输入框，聚焦到第一个
      newFocusedIndex = 0;
    } else if (index < this.data.focusedIndex) {
      // 如果删除的输入框在当前聚焦的输入框之前，聚焦索引减1
      newFocusedIndex = this.data.focusedIndex - 1;
    }
    // 如果删除的输入框在当前聚焦的输入框之后，聚焦索引不变

    this.setData({
      rnaSequences: rnaSequences,
      focusedIndex: newFocusedIndex,
    });
  },

  /**
   * 验证RNA序列合法性
   */
  validateRNASequence(sequence) {
    // 检查最小长度（至少51个字符）
    if (sequence.length < 51) {
      return {
        valid: false,
        message: '序列长度至少为51个字符',
      };
    }

    // 检查字符是否只包含大写 ATCGUN（不允许小写和其他字符）
    const validPattern = /^[ATCGUN]+$/;
    if (!validPattern.test(sequence)) {
      return {
        valid: false,
        message: '序列只能包含大写字母 A、T、C、G、U、N',
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

    // 检查至少有一个序列输入
    const sequences = this.data.rnaSequences.map(seq => seq.value.trim()).filter(seq => seq);
    if (sequences.length === 0) {
      wx.showToast({
        title: '请至少输入一条序列',
        icon: 'none',
      });
      return;
    }

    // 验证所有序列合法性
    for (let i = 0; i < sequences.length; i++) {
      const validation = this.validateRNASequence(sequences[i]);
      if (!validation.valid) {
        wx.showToast({
          title: `序列${i + 1}: ${validation.message}`,
          icon: 'none',
          duration: 2000,
        });
        return;
      }
    }

    // 开始提交流程
    this.submitTask(sequences);
  },

  /**
   * 提交任务到后端
   */
  submitTask(sequences) {
    console.log('%c========== submitTask 被调用 ==========', 'color: green; font-size: 14px; font-weight: bold;');

    // 生成前端 Job ID
    const jobId = this.generateJobId();

    // 获取登录凭证 code
    const loginCode = wx.getStorageSync('loginCode');

    // 调试日志
    console.log('loginCode 从缓存获取:', loginCode);
    console.log('userInfo:', this.data.userInfo);

    // 如果没有 loginCode，重新获取
    if (!loginCode) {
      wx.login({
        success: (loginRes) => {
          if (loginRes.code) {
            console.log('重新获取 code 成功:', loginRes.code);
            wx.setStorageSync('loginCode', loginRes.code);
            // 使用新 code 提交任务
            this.doSubmitTask(jobId, loginRes.code, sequences);
          } else {
            wx.showModal({
              title: '登录凭证失效',
              content: '请重新登录',
              showCancel: false,
            });
          }
        },
        fail: () => {
          wx.showToast({
            title: '获取登录凭证失败',
            icon: 'none',
          });
        },
      });
      return;
    }

    this.doSubmitTask(jobId, loginCode, sequences);
  },

  /**
   * 实际执行任务提交
   */
  doSubmitTask(jobId, loginCode, sequences) {
    // 构造JSON数据，使用 code 作为用户标识
    const requestData = {
      code: loginCode,  // 使用微信登录凭证 code
      jobId: jobId,
      rnaSequence1: '',
      rnaSequence2: '',
      rnaSequence3: '',
      rnaSequence4: '',
      rnaSequence5: '',
    };

    // 动态添加 rnaSequence1, rnaSequence2, ... (即使为空也保留key)
    sequences.forEach((seq, index) => {
      requestData[`rnaSequence${index + 1}`] = seq;
    });

    // 打印JSON到控制台（在请求之前）
    console.log('%c========================================', 'color: red; font-size: 16px; font-weight: bold;');
    console.log('%c前端发送的JSON数据', 'color: red; font-size: 16px; font-weight: bold;');
    console.log('%c========================================', 'color: red; font-size: 16px; font-weight: bold;');
    console.log('请求URL:', `${API_BASE_URL}/api/v1/wx-submit-task`);
    console.log('code (微信登录凭证):', loginCode);
    console.log('jobId:', jobId);
    console.log('序列数量:', sequences.length);
    sequences.forEach((seq, index) => {
      console.log(`rnaSequence${index + 1}长度:`, seq.length);
    });
    console.log('JSON字符串:', JSON.stringify(requestData, null, 2));
    console.log('JSON对象:', requestData);
    console.log('%c========================================', 'color: red; font-size: 16px; font-weight: bold;');

    wx.showLoading({
      title: '正在提交任务...',
    });

    wx.request({
      url: `${API_BASE_URL}/api/v1/wx-submit-task`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
      },
      data: requestData,
      success: (res) => {
        wx.hideLoading();

        console.log('提交任务响应:', res);

        // Check for 202 status code and data.job_id
        if (res.statusCode === 202 && res.data.code === 200 && res.data.data && res.data.data.job_id) {
          const batchJobId = res.data.data.job_id;
          console.log('任务提交成功，batch_job_id:', batchJobId);

          // 开始轮询任务进度
          this.startPollingProgress(batchJobId);
        } else {
          console.error('提交任务失败:', res);
          wx.showToast({
            title: res.data?.message || '提交失败，请重试',
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
   * 开始轮询任务进度
   */
  startPollingProgress(batchJobId) {
    console.log('开始轮询任务进度, batchJobId:', batchJobId);

    // 显示进度条
    this.setData({
      showProgress: true,
      batchJobId: batchJobId,
      progressCurrent: 0,
      progressTotal: 0,
    });

    // 清除之前的定时器（如果有）
    this.clearPollTimer();

    // 立即查询一次
    this.checkTaskProgress(batchJobId);

    // 设置定时器，每2秒查询一次
    this.pollTimer = setInterval(() => {
      this.checkTaskProgress(batchJobId);
    }, 2000);
  },

  /**
   * 查询任务进度
   */
  checkTaskProgress(batchJobId) {
    wx.request({
      url: `${API_BASE_URL}/api/v1/wx-task-progress/${batchJobId}`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
      },
      success: (res) => {
        console.log('任务进度响应:', res);

        if (res.statusCode === 200 && res.data.code === 200 && res.data.data) {
          const data = res.data.data;
          const status = data.status;
          const total = data.total_sequences || 0;
          const completed = data.completed_sequences || 0;
          const results = data.results || [];

          console.log(`任务进度: ${completed}/${total}, status: ${status}`);

          // 更新进度条
          this.setData({
            progressCurrent: completed,
            progressTotal: total,
          });

          // 检查是否完成
          if (status === 'COMPLETED' || completed >= total) {
            // 清除定时器
            this.clearPollTimer();

            console.log('所有任务已完成，准备跳转');

            // 延迟1秒后跳转到可视化页面
            setTimeout(() => {
              this.navigateToVisualization(results);
            }, 1000);
          }
        } else if (res.statusCode === 404) {
          // 任务不存在
          console.error('任务不存在:', batchJobId);
          this.handlePollingError('任务不存在');
        }
      },
      fail: (err) => {
        console.error('查询任务进度失败:', err);
        // 网络错误，继续轮询
      },
    });
  },

  /**
   * 跳转到可视化页面
   */
  navigateToVisualization(results) {
    // 隐藏进度条
    this.setData({
      showProgress: false,
    });

    console.log('可视化结果:', results);

    // 将结果编码后传递给results页面
    const resultsJson = JSON.stringify(results);
    const encodedResults = encodeURIComponent(resultsJson);

    wx.navigateTo({
      url: `/pages/results/results?results=${encodedResults}`,
      fail: (err) => {
        console.error('页面跳转失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        });
      },
    });
  },

  /**
   * 处理轮询错误
   */
  handlePollingError(errorMessage) {
    // 清除定时器
    this.clearPollTimer();

    // 隐藏进度条
    this.setData({
      showProgress: false,
    });

    wx.showModal({
      title: '错误',
      content: errorMessage,
      showCancel: false,
    });
  },
});
