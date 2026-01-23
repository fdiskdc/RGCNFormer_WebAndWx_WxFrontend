import * as echarts from '../../miniprogram_npm/echarts-for-weixin/ec-canvas/echarts';

const echartsLib = require('../../miniprogram_npm/echarts-for-weixin/ec-canvas/echarts');

let chartInstance = null;

function initChart(canvas, width, height, dpr, option) {
  chartInstance = echartsLib.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: dpr
  });
  chartInstance.setOption(option);
  return chartInstance;
}

Component({
  properties: {
    chartOption: {
      type: Object,
      value: {}
    }
  },

  data: {
    ec: {
      onInit: null
    }
  },

  observers: {
    'chartOption': function(newOption) {
      if (newOption && Object.keys(newOption).length > 0) {
        this.setData({
          ec: {
            onInit: (canvas, width, height, dpr) => {
              return initChart(canvas, width, height, dpr, newOption);
            }
          }
        });
      }
    }
  },

  methods: {
    updateChart(option) {
      if (chartInstance) {
        chartInstance.setOption(option);
      }
    }
  }
});
