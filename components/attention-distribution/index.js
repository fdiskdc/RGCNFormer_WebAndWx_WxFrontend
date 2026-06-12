const { requestWithFallback } = require('../../utils/request');

const distributionCache = Object.create(null);

const MODIFICATION_COLORS = {
  Am: '#8DA9C4',
  Atol: '#B5838D',
  Cm: '#A3B18A',
  Gm: '#DDB892',
  Tm: '#6B705C',
  Y: '#9E9E9E',
  ac4C: '#C9ADA7',
  m1A: '#A28B8B',
  m5C: '#8B9DAF',
  m6A: '#B8A9C9',
  m6Am: '#C4A882',
  m7G: '#D4A0A0'
};

const MOD_NAME_TO_NUCLEOTIDE = {
  Am: 'A',
  Atol: 'A',
  Cm: 'C',
  Gm: 'G',
  Tm: 'U',
  Y: 'U',
  ac4C: 'C',
  m1A: 'A',
  m5C: 'C',
  m6A: 'A',
  m6Am: 'A',
  m7G: 'G'
};

Component({
  properties: {
    jobId: {
      type: String,
      value: '',
      observer(newJobId) {
        if (this.isAttached) {
          this.handleJobIdChange(newJobId);
        }
      }
    },
    active: {
      type: Boolean,
      value: false,
      observer(active) {
        if (active && this.isAttached) {
          this.ensureDataAndDraw();
        }
      }
    }
  },

  data: {
    loading: false,
    error: '',
    classOptions: [],
    selectedClassIndex: 0,
    currentClassSummary: null,
    sequenceLength: 0,
    modeledRangeText: ''
  },

  lifetimes: {
    attached() {
      this.isAttached = true;
      this.distributionData = null;
      this.requestToken = 0;
      this.loadingJobId = '';
      if (this.properties.active && this.properties.jobId) {
        this.ensureDataAndDraw();
      }
    },

    detached() {
      this.isAttached = false;
      this.requestToken += 1;
      this.loadingJobId = '';
    }
  },

  methods: {
    handleJobIdChange(jobId) {
      this.requestToken = (this.requestToken || 0) + 1;
      this.loadingJobId = '';
      this.distributionData = null;
      this.setData({
        loading: false,
        error: '',
        classOptions: [],
        selectedClassIndex: 0,
        currentClassSummary: null,
        sequenceLength: 0,
        modeledRangeText: ''
      }, () => {
        if (jobId && this.properties.active) {
          this.ensureDataAndDraw();
        }
      });
    },

    ensureDataAndDraw() {
      const jobId = this.properties.jobId;
      if (!jobId || !this.properties.active) return;

      if (this.distributionData && this.distributionData.job_id === jobId) {
        this.drawCurrentChart();
        return;
      }

      if (distributionCache[jobId]) {
        this.applyDistribution(distributionCache[jobId]);
        return;
      }

      this.loadDistribution(false);
    },

    loadDistribution(forceReload) {
      const jobId = this.properties.jobId;
      if (!jobId) return;
      if (!forceReload && this.loadingJobId === jobId) return;

      if (forceReload) {
        delete distributionCache[jobId];
      }

      const token = (this.requestToken || 0) + 1;
      this.requestToken = token;
      this.loadingJobId = jobId;
      this.setData({ loading: true, error: '' });

      requestWithFallback(
        `/api/v1/results/${jobId}/attention-distribution?predictedOnly=true`,
        { method: 'GET' }
      ).then((res) => {
        if (!this.isCurrentRequest(token, jobId)) return;
        this.loadingJobId = '';

        if (res.statusCode === 200 && res.data) {
          distributionCache[jobId] = res.data;
          this.applyDistribution(res.data);
          return;
        }

        if (res.statusCode === 404) {
          this.setData({
            loading: false,
            error: '该任务暂不包含完整注意力分布，请重新提交序列。'
          });
          return;
        }

        this.setData({
          loading: false,
          error: '无法加载注意力分布，请稍后重试。'
        });
      }).catch(() => {
        if (!this.isCurrentRequest(token, jobId)) return;
        this.loadingJobId = '';
        this.setData({
          loading: false,
          error: '网络连接失败，请检查网络后重试。'
        });
      });
    },

    isCurrentRequest(token, jobId) {
      return token === this.requestToken && jobId === this.properties.jobId;
    },

    applyDistribution(distributionData) {
      if (!distributionData || distributionData.job_id !== this.properties.jobId) return;

      this.distributionData = distributionData;
      const classes = Array.isArray(distributionData.classes) ? distributionData.classes : [];
      const classOptions = classes.map((classData) => this.buildClassSummary(classData));
      const modeledRange = distributionData.modeled_range || { start: 0, end: 0 };
      const modeledRangeText = modeledRange.end > modeledRange.start
        ? `${modeledRange.start} - ${modeledRange.end - 1}`
        : '-';

      this.setData({
        loading: false,
        error: '',
        classOptions,
        selectedClassIndex: 0,
        currentClassSummary: classOptions[0] || null,
        sequenceLength: distributionData.sequence_length || 0,
        modeledRangeText
      }, () => {
        if (classOptions.length > 0) {
          this.drawCurrentChart();
        }
      });
    },

    buildClassSummary(classData) {
      const nucleotide = MOD_NAME_TO_NUCLEOTIDE[classData.name] || '';
      return {
        index: classData.index,
        label: nucleotide ? `${classData.name} (${nucleotide})` : classData.name,
        name: classData.name,
        color: MODIFICATION_COLORS[classData.name] || '#888888',
        probabilityText: `${((classData.probability || 0) * 100).toFixed(1)}%`,
        thresholdText: `${((classData.threshold || 0) * 100).toFixed(1)}%`
      };
    },

    onClassChange(e) {
      const selectedClassIndex = Number(e.detail.value) || 0;
      this.setData({
        selectedClassIndex,
        currentClassSummary: this.data.classOptions[selectedClassIndex] || null
      }, () => {
        this.drawCurrentChart();
      });
    },

    onRetry() {
      this.loadDistribution(true);
    },

    drawCurrentChart() {
      if (!this.properties.active || !this.distributionData) return;

      const classData = this.distributionData.classes[this.data.selectedClassIndex];
      if (!classData || !Array.isArray(classData.attention)) return;

      wx.nextTick(() => {
        if (!this.properties.active) return;

        wx.createSelectorQuery()
          .in(this)
          .select('#attention-distribution-canvas')
          .fields({ node: true, size: true })
          .exec((result) => {
            const canvasInfo = result && result[0];
            if (!canvasInfo || !canvasInfo.node || !canvasInfo.width || !canvasInfo.height) return;
            this.drawChart(canvasInfo.node, canvasInfo.width, canvasInfo.height, classData);
          });
      });
    },

    drawChart(canvas, width, height, classData) {
      const dpr = wx.getSystemInfoSync().pixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#FAFAF8';
      ctx.fillRect(0, 0, width, height);

      const plot = {
        left: 48,
        right: width - 12,
        top: 16,
        bottom: height - 30
      };
      const plotWidth = Math.max(1, plot.right - plot.left);
      const plotHeight = Math.max(1, plot.bottom - plot.top);
      const sampled = this.sampleByMaximum(classData.attention, Math.floor(plotWidth));
      const maxValue = sampled.reduce((max, point) => Math.max(max, point.value), 0) || 1;

      ctx.strokeStyle = '#E8E8E5';
      ctx.lineWidth = 1;
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#666666';

      for (let index = 0; index <= 3; index += 1) {
        const y = plot.top + (plotHeight * index / 3);
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(plot.right, y);
        ctx.stroke();

        const labelValue = maxValue * (1 - index / 3);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.formatAttention(labelValue), plot.left - 6, y);
      }

      ctx.strokeStyle = '#BDBDBD';
      ctx.beginPath();
      ctx.moveTo(plot.left, plot.top);
      ctx.lineTo(plot.left, plot.bottom);
      ctx.lineTo(plot.right, plot.bottom);
      ctx.stroke();

      const points = sampled.map((point, index) => ({
        x: sampled.length === 1
          ? plot.left
          : plot.left + (plotWidth * index / (sampled.length - 1)),
        y: plot.bottom - (point.value / maxValue * plotHeight)
      }));
      const color = MODIFICATION_COLORS[classData.name] || '#888888';

      if (points.length > 0) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(points[0].x, plot.bottom);
        points.forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.lineTo(points[points.length - 1].x, plot.bottom);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        points.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
      }

      const modeledRange = this.distributionData.modeled_range || { start: 0, end: 0 };
      const start = modeledRange.start || 0;
      const end = Math.max(start, (modeledRange.end || 1) - 1);
      const middle = Math.floor((start + end) / 2);
      const ticks = [
        { x: plot.left, label: String(start), align: 'left' },
        { x: plot.left + plotWidth / 2, label: String(middle), align: 'center' },
        { x: plot.right, label: String(end), align: 'right' }
      ];

      ctx.fillStyle = '#666666';
      ctx.textBaseline = 'top';
      ticks.forEach((tick) => {
        ctx.textAlign = tick.align;
        ctx.fillText(tick.label, tick.x, plot.bottom + 8);
      });
    },

    sampleByMaximum(values, maxPoints) {
      if (!values.length || maxPoints <= 0) return [];
      if (values.length <= maxPoints) {
        return values.map((value, index) => ({ value, index }));
      }

      const bucketSize = Math.ceil(values.length / maxPoints);
      const sampled = [];
      for (let start = 0; start < values.length; start += bucketSize) {
        const end = Math.min(start + bucketSize, values.length);
        let maxValue = -Infinity;
        let maxIndex = start;
        for (let index = start; index < end; index += 1) {
          if (values[index] > maxValue) {
            maxValue = values[index];
            maxIndex = index;
          }
        }
        sampled.push({ value: maxValue, index: maxIndex });
      }
      return sampled;
    },

    formatAttention(value) {
      if (value === 0) return '0';
      if (value < 0.001) return value.toExponential(1);
      return value.toFixed(3);
    }
  }
});
