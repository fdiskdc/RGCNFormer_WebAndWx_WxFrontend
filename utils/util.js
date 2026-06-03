/**
 * util.js - 通用工具函数(日期格式化等) / Generic utility functions (date formatting, etc.)
 *
 * 提供小程序中常用的工具方法,目前实现了时间格式化和数字补零,
 * 是新增跨切面工具(节流、深拷贝等)的首选位置。 / Provides shared helpers:
 * date formatting and number zero-padding. The natural place to add future
 * cross-cutting helpers (throttle, deep copy, etc.).
 *
 * 功能模块 / Modules:
 * - formatTime(date): Date → "YYYY/MM/DD hh:mm:ss" / Date → "YYYY/MM/DD hh:mm:ss"
 * - formatNumber(n): 数字补零到两位 / Zero-pads a number to two digits
 *
 * 输入 / Inputs:
 * - formatTime: date (Date) - 待格式化的日期 / Date to format
 * - formatNumber: n (number) - 待补零的数字 / Number to pad
 *
 * 输出 / Outputs:
 * - formatTime: string - "YYYY/MM/DD hh:mm:ss" / formatted string
 * - formatNumber: string - 补零后的字符串 / zero-padded string
 *
 * 数据流 / Data Flow:
 * 1. 提取年/月/日/时/分/秒 / Extract year/month/day/hour/minute/second
 * 2. 对每个部分调用 formatNumber 补零 / Zero-pad each via formatNumber
 * 3. 日期用 "/" 拼接,时间用 ":" 拼接,中间空格连接 / Join with "/" and ":"
 *
 * 相关文件 / Related Files:
 * - 调用 / Calls: 无 / None
 * - 被调用 / Called by: pages/logs/logs.js(通过 require) / pages/logs/logs.js (via require)
 *
 * 使用示例 / Usage Example:
 *     const { formatTime } = require('../../utils/util.js');
 *     console.log(formatTime(new Date()));
 *
 * 版本 / Version: 1.0
 */
const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

module.exports = {
  formatTime
}
