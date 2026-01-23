// API 基础配置
const API_BASE_URL = 'https://rgcnformer.dawdawdawdawfafaawf.xyz'

// 12类修饰名称映射
const MOD_NAMES = {
  0: 'Am', 1: 'Atol', 2: 'Cm',
  3: 'Gm', 4: 'Tm', 5: 'Y',
  6: 'ac4C', 7: 'm1A', 8: 'm5C',
  9: 'm6A', 10: 'm6Am', 11: 'm7G'
};

// 修饰索引到核苷酸类型的映射
const INDEX_TO_NUCLEOTIDE = {
  0: 'A', 1: 'A',     // Am, Atol
  2: 'C',             // Cm
  3: 'G',             // Gm
  4: 'U', 5: 'U',     // Tm, Y
  6: 'C',             // ac4C
  7: 'A',             // m1A
  8: 'C',             // m5C
  9: 'A', 10: 'A',    // m6A, m6Am
  11: 'G'             // m7G
};

// 修饰名称到核苷酸类型的映射（反向映射）
const MOD_NAME_TO_NUCLEOTIDE = {};
Object.keys(INDEX_TO_NUCLEOTIDE).forEach(index => {
  const modName = MOD_NAMES[index];
  const nucleotide = INDEX_TO_NUCLEOTIDE[index];
  MOD_NAME_TO_NUCLEOTIDE[modName] = nucleotide;
});

console.log('修饰名称到核苷酸映射:', MOD_NAME_TO_NUCLEOTIDE);
// 应该输出: {Am: 'A', Atol: 'A', Cm: 'C', Gm: 'G', Tm: 'U', Y: 'U', ac4C: 'C', m1A: 'A', m5C: 'C', m6A: 'A', m6Am: 'A', m7G: 'G'}

// 每个核苷酸组包含的修饰ID (0-11，对应模型索引)
const NUCLEOTIDE_GROUPS = {
  'A': { name: '腺嘌呤 (A)', mods: [0, 1, 7, 9, 10] },   // Am, Atol, m1A, m6A, m6Am
  'C': { name: '胞嘧啶 (C)', mods: [2, 6, 8] },           // Cm, ac4C, m5C
  'G': { name: '鸟嘌呤 (G)', mods: [3, 11] },              // Gm, m7G
  'U': { name: '尿嘧啶 (U)', mods: [4, 5] }                // Tm, Y
};

// 莫兰迪配色方案
const BASE_COLORS = {
  'A': '#bcaaa4', // 柔和的灰玫瑰色 (腺嘌呤)
  'G': '#a5d6a7', // 柔和的鼠尾草绿 (鸟嘌呤)
  'C': '#90caf9', // 柔和的石板蓝 (胞嘧啶)
  'U': '#ffe082', // 柔和的沙黄色 (尿嘧啶)
  '-': '#eeeeee', // 用于填充字符的中性灰色
};

// 视口宽度
const VIEWPORT_WIDTH = 51; // 微信小程序用较小的宽度

Page({
  data: {
    jobId: '',
    isLoading: true,
    resultData: null,
    classificationTree: null,
    error: null,
    pollAttempts: 0,
    maxPollAttempts: 60, // Maximum 60 attempts * 3 seconds = 3 minutes

    // 注意力可视化相关
    topX: 3,
    currentAttentionIndex: 0,
    selectedModificationType: '',
    selectedModificationIndex: 0,
    modificationTypeOptions: [],
    displayWeights: [],
    viewportElements: [],
    currentHighlight: null,
    sequence: '',
    scrollToId: '',

    // GCN ECharts 可视化相关
    gcnEc: {}
  },

  // 轮询定时器
  pollTimer: null,

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('results page onLoad, options:', options);
    
    // Get jobId from options
    if (options.jobId) {
      this.setData({
        jobId: options.jobId
      });
      
      // Start polling for results
      this.startPolling();
    } else {
      this.setData({
        isLoading: false,
        error: '缺少任务ID'
      });
    }
  },

  /**
   * 开始轮询结果
   */
  startPolling() {
    console.log('开始轮询结果, jobId:', this.data.jobId);

    // Clear any existing timer
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    // Poll immediately
    this.pollForResult();

    // Set up timer to poll every 3 seconds
    this.pollTimer = setInterval(() => {
      this.pollForResult();
    }, 3000);
  },

  /**
   * 轮询获取结果
   */
  pollForResult() {
    const { jobId, pollAttempts, maxPollAttempts } = this.data;

    console.log(`轮询尝试 ${pollAttempts + 1}/${maxPollAttempts}, jobId: ${jobId}`);

    // Check if max attempts reached
    if (pollAttempts >= maxPollAttempts) {
      this.handlePollTimeout();
      return;
    }

    wx.request({
      url: `${API_BASE_URL}/api/v1/results/${jobId}`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200) {
          // Successfully retrieved results
          console.log('成功获取结果:', res.data);
          this.handleResultSuccess(res.data);
        } else if (res.statusCode === 404) {
          // Job not found yet, continue polling
          console.log('任务尚未完成，继续轮询...');
          this.setData({
            pollAttempts: pollAttempts + 1
          });
        } else {
          // Other error
          console.error('获取结果失败:', res);
          this.handlePollError('获取结果失败');
        }
      },
      fail: (err) => {
        console.error('网络错误:', err);
        // Network error, continue polling but increment attempts
        this.setData({
          pollAttempts: pollAttempts + 1
        });
      }
    });
  },

  /**
   * 处理获取结果成功
   */
  handleResultSuccess(data) {
    // Clear timer
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // 将 classification 转换为核苷酸分组树结构
    let classificationTree = null;
    if (data.classification) {
      classificationTree = this.transformClassificationToTree(data.classification);
    }

    // 初始化注意力可视化
    const modificationTypeOptions = this.getModificationTypeOptions(classificationTree);
    const selectedModificationType = modificationTypeOptions.length > 0 ? modificationTypeOptions[0].value : '';
    const selectedModificationIndex = modificationTypeOptions.length > 0 ? 0 : -1;

    // Update data
    this.setData({
      isLoading: false,
      resultData: data,
      classificationTree: classificationTree,
      error: null,
      sequence: data.attention?.sequence || '',
      modificationTypeOptions: modificationTypeOptions,
      selectedModificationType: selectedModificationType,
      selectedModificationIndex: selectedModificationIndex
    }, () => {
      // 在setData回调中初始化显示权重
      this.updateDisplayWeights();
      // 初始化 GCN 图结构 ECharts 配置
      if (data.gcn) {
        this.initGCNECharts();
      }
    });

    wx.showToast({
      title: '分析完成',
      icon: 'success',
      duration: 2000
    });
  },

  /**
   * 获取修饰类型选项（只包含预测为true的修饰）
   */
  getModificationTypeOptions(classificationTree) {
    const options = [];

    if (!classificationTree || !classificationTree.children) {
      return options;
    }

    classificationTree.children.forEach(nucGroup => {
      nucGroup.children.forEach(mod => {
        if (mod.isPredicted) {
          // 找到修饰类型在MOD_NAMES中的索引
          const modIndex = Object.keys(MOD_NAMES).find(key => MOD_NAMES[key] === mod.name);
          if (modIndex !== undefined) {
            options.push({
              value: mod.name,
              label: `${mod.name} (${nucGroup.nucType})`
            });
          }
        }
      });
    });

    return options;
  },

  /**
   * 计算显示的权重（过滤和归一化）
   */
  updateDisplayWeights() {
    const { resultData, selectedModificationType, topX, sequence } = this.data;

    if (!resultData?.attention?.weights || resultData.attention.weights.length === 0) {
      this.setData({ displayWeights: [], viewportElements: [], currentHighlight: null });
      return;
    }

    const allWeights = resultData.attention.weights;
    console.log('原始权重数据:', allWeights);

    // 首先为所有权重添加默认分数字段（如果API没有返回）
    let processedWeights = allWeights.map(weight => ({
      ...weight,
      score: (typeof weight.score === 'number' && !isNaN(weight.score)) ? weight.score : 1.0
    }));

    console.log('Computing displayWeights for modification type:', selectedModificationType);

    // Step 1: 处理修饰类型选择和剪枝逻辑
    if (selectedModificationType && selectedModificationType !== 'all') {
      const modIndex = Object.keys(MOD_NAMES).find(key => MOD_NAMES[key] === selectedModificationType);
      if (modIndex !== undefined) {
        const targetNucleotide = INDEX_TO_NUCLEOTIDE[parseInt(modIndex)];

        // 剪枝逻辑：将不匹配目标碱基的权重分数置为0
        // 同时保存原始分数到 _originalScore 临时字段
        processedWeights = processedWeights.map(weight => {
          const positionBase = sequence[weight.index];
          const nucleotideMatch = positionBase === targetNucleotide ||
                                   (targetNucleotide === 'U' && positionBase === 'T') ||
                                   (targetNucleotide === 'T' && positionBase === 'U');

          // 保存原始分数（在修改之前）
          const originalScore = weight.score;

          if (!nucleotideMatch) {
            return { ...weight, _originalScore: originalScore, score: 0 };
          }
          return { ...weight, _originalScore: originalScore };
        });
      }
    } else {
      // 没有筛选时也保存原始分数
      processedWeights = processedWeights.map(weight => ({
        ...weight,
        _originalScore: weight.score
      }));
    }

    // 过滤掉score为0的权重
    processedWeights = processedWeights.filter(w => w.score > 0);

    if (processedWeights.length === 0) {
      this.setData({ displayWeights: [], viewportElements: [], currentHighlight: null });
      return;
    }

    // Step 2: 为每个权重计算显示分数（原始分数 * 100，保留5位小数）
    const displayWeightsList = processedWeights.map(weight => {
      const originalScore = weight._originalScore || weight.score;
      // 显示分数：原始分数 * 100，保留5位小数
      const displayScore = (originalScore * 100).toFixed(5);

      return {
        ...weight,
        originalScore: originalScore,
        displayScore: displayScore,
        score: originalScore // 用于排序
      };
    });

    // Step 3: 按原始分数排序并筛选 topX
    const displayWeights = displayWeightsList
      .sort((a, b) => b.score - a.score)
      .slice(0, topX);

    console.log('Display weights:', displayWeights);

    this.setData({
      displayWeights: displayWeights,
      currentAttentionIndex: 0
    }, () => {
      console.log('setData完成，displayWeights:', this.data.displayWeights);
      this.updateViewport();
    });
  },

  /**
   * 更新视口元素
   */
  updateViewport() {
    const { displayWeights, currentAttentionIndex, sequence } = this.data;

    if (displayWeights.length === 0) {
      this.setData({ viewportElements: [], currentHighlight: null, scrollToId: '' });
      return;
    }

    const currentHighlight = displayWeights[currentAttentionIndex];
    const centerIndex = currentHighlight.index;
    const halfWidth = Math.floor(VIEWPORT_WIDTH / 2);
    const startIndex = centerIndex - halfWidth;
    const endIndex = centerIndex + halfWidth;

    console.log('当前高亮:', currentHighlight);
    console.log('originalScore:', currentHighlight.originalScore);

    const viewportElements = [];

    for (let i = startIndex; i <= endIndex; i++) {
      const isHighlighted = i === centerIndex;
      const isOutOfBounds = i < 0 || i >= sequence.length;

      let base = isOutOfBounds ? '-' : sequence[i];
      // 将T转换为U
      if (base === 'T') {
        base = 'U';
      }
      const bgColor = BASE_COLORS[base] || BASE_COLORS['-'];

      viewportElements.push({
        index: i,
        base: base,
        bgColor: bgColor,
        isHighlighted: isHighlighted,
        isOutOfBounds: isOutOfBounds
      });
    }

    // 设置滚动到的元素ID（高亮的元素）
    const scrollToId = `block-${centerIndex}`;

    this.setData({
      viewportElements: viewportElements,
      currentHighlight: currentHighlight,
      scrollToId: scrollToId
    });
  },

  /**
   * 修饰类型选择变化
   */
  onModificationTypeChange(e) {
    const index = parseInt(e.detail.value);
    const { modificationTypeOptions } = this.data;
    const selectedModificationType = modificationTypeOptions[index]?.value || '';

    this.setData({
      selectedModificationType: selectedModificationType,
      selectedModificationIndex: index,
      currentAttentionIndex: 0
    }, () => {
      this.updateDisplayWeights();
    });
  },

  /**
   * TopX 输入变化
   */
  onTopXInput(e) {
    const topX = parseInt(e.detail.value) || 1;
    this.setData({ topX: topX }, () => {
      this.updateDisplayWeights();
    });
  },

  /**
   * 上一个位点
   */
  onPrevSite() {
    const { currentAttentionIndex } = this.data;
    if (currentAttentionIndex > 0) {
      const newIndex = currentAttentionIndex - 1;
      this.setData({
        currentAttentionIndex: newIndex
      }, () => {
        this.updateViewport();
        // 滚动到可视化区域
        this.scrollToAttentionSection();
      });
    }
  },

  /**
   * 下一个位点
   */
  onNextSite() {
    const { currentAttentionIndex, displayWeights } = this.data;
    if (currentAttentionIndex < displayWeights.length - 1) {
      const newIndex = currentAttentionIndex + 1;
      this.setData({
        currentAttentionIndex: newIndex
      }, () => {
        this.updateViewport();
        // 滚动到可视化区域
        this.scrollToAttentionSection();
      });
    }
  },

  /**
   * 滚动到注意力可视化区域
   */
  scrollToAttentionSection() {
    wx.createSelectorQuery()
      .select('#attention-viz-section')
      .boundingClientRect((rect) => {
        if (rect) {
          wx.pageScrollTo({
            scrollTop: rect.top + wx.getSystemInfoSync().scrollTop - 20,
            duration: 300
          });
        }
      })
      .exec();
  },

  /**
   * 将 classification 数据转换为核苷酸分组树结构
   */
  transformClassificationToTree(classificationData) {
    console.log('========== 原始 classification 数据 ==========');
    console.log('完整数据:', JSON.stringify(classificationData, null, 2));

    // 构建根节点
    const rootName = classificationData.name || 'RNA修饰分类';
    const rootPredicted = classificationData.isPredicted !== undefined ? classificationData.isPredicted : true;

    // API 返回结构: children 是 Groups (Group A, Group C, Group G, Group U)
    // 每个 Group 的 children 才是具体的修饰 (Am, m6A 等)
    const apiGroups = classificationData.children || [];

    // 创建 Group 名称到核苷酸类型的映射
    const groupNameToNucType = {
      'Group A': 'A',
      'Group C': 'C',
      'Group G': 'G',
      'Group U': 'U'
    };

    // 创建修饰名称到预测结果的映射
    const modPredictions = {};

    // 遍历 API 返回的 Groups
    apiGroups.forEach(group => {
      const nucType = groupNameToNucType[group.name];
      console.log(`处理 Group: ${group.name} -> 核苷酸类型: ${nucType}`);

      if (group.children && Array.isArray(group.children)) {
        group.children.forEach(mod => {
          console.log(`  修饰: ${mod.name}, isPredicted: ${mod.isPredicted}`);

          // 根据修饰名称找到对应的索引
          const modIndex = Object.keys(MOD_NAMES).find(key => MOD_NAMES[key] === mod.name);
          if (modIndex !== undefined) {
            modPredictions[parseInt(modIndex)] = mod.isPredicted;
            console.log(`    ✓ 映射到索引 ${modIndex}: ${MOD_NAMES[modIndex]}`);
          } else {
            console.log(`    ✗ 未找到匹配的索引`);
          }
        });
      }
    });

    console.log('========== 修饰预测映射完成 ==========');
    console.log('modPredictions:', modPredictions);
    console.log('========================================');

    // 按照核苷酸类型顺序 (A, C, G, U) 创建子节点
    const nucOrder = ['A', 'C', 'G', 'U'];
    const nucleotideChildren = [];

    nucOrder.forEach(nucType => {
      const group = NUCLEOTIDE_GROUPS[nucType];
      if (!group) {
        console.log(`未找到核苷酸组: ${nucType}`);
        return;
      }

      console.log(`处理核苷酸组 ${nucType}:`, group);

      const modChildren = [];

      // 添加该组的修饰类型
      group.mods.forEach(modIndex => {
        const modName = MOD_NAMES[modIndex];
        const isPredicted = modPredictions[modIndex] || false;

        console.log(`  修饰 ${modName} (索引${modIndex}): ${isPredicted ? '✓预测' : '未预测'}`);

        modChildren.push({
          name: modName,
          isPredicted: isPredicted,
          children: []
        });
      });

      // 计算该组是否有预测到的修饰
      const groupPredicted = modChildren.some(mod => mod.isPredicted);

      nucleotideChildren.push({
        name: group.name,
        nucType: nucType,
        isPredicted: groupPredicted,
        children: modChildren
      });
    });

    const result = {
      name: rootName,
      isPredicted: rootPredicted,
      children: nucleotideChildren
    };

    console.log('转换后的树结构:', JSON.stringify(result, null, 2));

    // 输出被预测为 true 的修饰
    const predictedMods = [];
    nucleotideChildren.forEach(nuc => {
      nuc.children.forEach(mod => {
        if (mod.isPredicted) {
          predictedMods.push(`${nuc.nucType}: ${mod.name}`);
        }
      });
    });

    if (predictedMods.length > 0) {
      console.log('========== 预测为 TRUE 的修饰 ==========');
      console.log(`共 ${predictedMods.length} 个修饰被预测:`);
      predictedMods.forEach(mod => console.log(`  ✓ ${mod}`));
      console.log('========================================');
    } else {
      console.log('========== 预测结果 ==========');
      console.log('没有修饰被预测为 TRUE');
      console.log('===========================');
    }

    return result;
  },

  /**
   * 处理轮询超时
   */
  handlePollTimeout() {
    // Clear timer
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.setData({
      isLoading: false,
      error: '等待超时，请稍后重试'
    });

    wx.showModal({
      title: '提示',
      content: '分析时间过长，请返回重试',
      showCancel: false
    });
  },

  /**
   * 处理轮询错误
   */
  handlePollError(message) {
    // Clear timer
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.setData({
      isLoading: false,
      error: message
    });

    wx.showToast({
      title: message,
      icon: 'none',
      duration: 3000
    });
  },

  /**
   * 返回上一页
   */
  onBackTap() {
    wx.navigateBack();
  },

  /**
   * 导航到web-view查看3D可视化
   */
  navigateToWebView() {
    const { jobId } = this.data;
    const webAppUrl = `https://rgcnformer.dawdawdawdawfafaawf.xyz/results/${jobId}`;

    wx.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(webAppUrl)}`,
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        });
      },
    });
  },

  // ==================== GCN 图结构可视化 (AntV G6) ====================

  // ==================== GCN 图结构可视化 (ECharts) ====================

  /**
   * 初始化 GCN ECharts 配置
   */
  initGCNECharts() {
    const { resultData } = this.data;

    console.log('========== GCN 图结构数据 ==========');
    if (resultData && resultData.gcn) {
      console.log('节点数:', resultData.gcn.nodes.length);
      console.log('边数:', resultData.gcn.edges.length);
    } else {
      console.log('无 GCN 数据');
      return;
    }
    console.log('=====================================');

    // 设置 ECharts 初始化函数
    this.setData({
      gcnEc: {
        onInit: this.initGCNChart.bind(this)
      }
    });
  },

  /**
   * 初始化 GCN 图表
   */
  initGCNChart(canvas, width, height, dpr) {
    const { resultData } = this.data;
    if (!resultData || !resultData.gcn) {
      return null;
    }

    console.log('初始化 ECharts, canvas尺寸:', { width, height, dpr });

    // 动态引入 echarts
    const echarts = require('echarts');

    const chart = echarts.init(canvas, null, {
      width: width,
      height: height,
      devicePixelRatio: dpr
    });

    // 重要：需要调用 canvas.setChart(chart) 来设置图表
    canvas.setChart(chart);

    const option = this.generateGCNEChartsOption(resultData.gcn);
    console.log('ECharts 配置:', option);

    chart.setOption(option);
    return chart;
  },

  /**
   * 生成 GCN ECharts 配置
   */
  generateGCNEChartsOption(gcnData) {
    const { nodes, edges } = gcnData;

    console.log('生成 ECharts 配置, 节点数:', nodes.length, '边数:', edges.length);

    // 转换节点数据为 ECharts 格式
    const echartsNodes = nodes.map(node => {
      // 解析核苷酸类型
      let nucleotide = '';
      if (node.label.includes(':')) {
        const parts = node.label.split(':');
        nucleotide = parts[1].trim().charAt(0).toUpperCase();
      } else {
        nucleotide = node.label.charAt(0).toUpperCase();
      }

      return {
        id: node.id,
        name: node.label,
        category: nucleotide,
        symbolSize: 15,
        itemStyle: {
          color: this.getNucleotideMorandiColor(nucleotide)
        },
        label: {
          show: true,
          fontSize: 10,
          formatter: () => nucleotide
        }
      };
    });

    // 转换边数据为 ECharts 格式
    const echartsEdges = edges.map(edge => ({
      source: edge.source,
      target: edge.target
    }));

    // 构建分类（按核苷酸类型）
    const categories = [
      { name: 'A' },
      { name: 'C' },
      { name: 'G' },
      { name: 'T' }
    ];

    console.log('ECharts 节点数据:', echartsNodes);
    console.log('ECharts 边数据:', echartsEdges);

    return {
      title: {
        show: false
      },
      tooltip: {
        formatter: params => {
          if (params.dataType === 'node') {
            return `节点: ${params.data.name}`;
          } else if (params.dataType === 'edge') {
            return `${params.data.source} → ${params.data.target}`;
          }
          return '';
        }
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: echartsNodes,
          links: echartsEdges,
          categories: categories,
          roam: true,
          draggable: true,
          focusNodeAdjacency: true,
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 1,
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.1)'
          },
          lineStyle: {
            color: '#a8a8a8',
            curveness: 0,
            width: 1.5
          },
          emphasis: {
            lineStyle: {
              width: 3
            }
          },
          force: {
            repulsion: 100,
            edgeLength: 50,
            gravity: 0.1,
            friction: 0.6
          },
          labelLayout: {
            hideOverlap: true
          }
        }
      ]
    };
  },

  /**
   * 获取核苷酸的莫兰迪颜色
   */
  getNucleotideMorandiColor(nucleotide) {
    const colorMap = {
      'A': '#c5b5a5', // 腺嘌呤 - 柔和的灰玫瑰色
      'C': '#b5c5d4', // 胞嘧啶 - 柔和的灰蓝色
      'G': '#c5d4b5', // 鸟嘌呤 - 柔和的灰绿色
      'T': '#d4c5b5', // 胸腺嘧啶 - 柔和的灰黄色
      'U': '#d4c5b5'  // 尿嘧啶 - 柔和的灰黄色
    };
    return colorMap[nucleotide] || '#d4d4d4';
  },

  /**
   * 页面卸载时清理
   */
  onUnload() {
    // Clear timer when page unloads
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
});
