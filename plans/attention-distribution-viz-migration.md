# 移植计划：`AttentionDistributionViz` 到微信小程序

> 源页面：`RGCNFormer_WebAndWx_WebFrontend/src/pages/AttentionDistributionViz.tsx`  
> 微信端：`RGCNFormer_WebAndWx_WxFrontend`  
> 后端：`RGCNFormer_WebAndWx_backend`  
> 更新日期：2026-06-12

**实施状态：代码实现已完成，等待真实环境联调**

已按本计划完成后端缓存与查询接口、微信独立组件、结果页集成，以及纯函数和静态结构验证。当前环境没有微信开发者工具 CLI 和可用的完整 Redis/Celery 联调环境，真机 Canvas 与完整请求链路仍需在部署环境验收。

---

## 一、目标与范围

在微信小程序结果页的 `Attention Weights` 区域中增加「注意力分布」视图，展示每个预测修饰类型在序列位置上的完整注意力曲线。

本次迁移的目标是：

1. 复用任务推理时已经产生的完整注意力权重，避免用户查看图表时再次运行模型。
2. 保证分布图与分类结果使用相同的预测阈值和层级剪枝结果。
3. 正确处理短序列 padding 和长序列截断后的坐标映射。
4. 使用适合手机屏幕的单类型大图，而不是直接复制 Web 端的多图纵向堆叠。
5. 将新增逻辑放入独立微信组件，控制 `pages/results/results.js` 的复杂度。

不在本次范围内：

- 修改模型结构或注意力计算方式。
- 实现缩放、框选等复杂图表交互。
- 使用 WebView 直接承载 Web 端页面。
- 将 ECharts 引入微信小程序。

---

## 二、现状分析

### 2.1 Web 源页面的实际功能

源文件虽然在注释中称为“直方图 / KDE”，但当前实际实现是位置级注意力折线图：

- x 轴：序列位置。
- y 轴：该修饰类别在对应位置的注意力权重。
- 每个类别一张平滑折线图和面积图。
- 固定过滤 `probability > 0.5` 的类别。
- 数据通过 `POST /api/v1/attention-visualization` 获取。
- 使用 React Query 缓存，使用 ECharts 绘制。

因此，本次迁移应以“位置级注意力分布折线图”为功能基准，不实现直方图或 KDE。

### 2.2 微信前端现状

微信端是原生小程序：

- 页面结构：JS + WXML + WXSS。
- `pages/results/results.js` 已展示分类树、Top-K 注意力位点和 GCN 统计。
- `utils/request.js` 已封装 `requestWithFallback`。
- 当前没有图表库。
- 批量任务结果中包含每条序列的 `jobId`、原始序列、分类结果和 Top-K 位点。

当前结果页只获得聚合后的 Top-K 位点，无法直接绘制每个修饰类别的完整曲线。

### 2.3 后端现状

异步任务 `run_prediction_task` 在一次推理中已经获得：

```text
probs_12class: [12]
attn_weights:  [12, 1001]
predictions_12class: 经过类别阈值和层级剪枝后的预测结果
```

但当前任务结果只保存分类树和 Top-K 聚合位点，完整注意力数组在任务结束后被丢弃。

现有 `POST /api/v1/attention-visualization` 会重新执行：

1. LinearFold。
2. 图结构构建。
3. 模型推理。
4. 注意力归一化和响应构建。

如果微信端直接调用该接口，会造成重复推理，并可能与原任务结果不一致。

---

## 三、关键问题

### 3.1 重复推理

微信任务完成时已经计算过完整注意力。再次调用同步接口会增加等待时间和服务器负载；批量五条序列时问题更加明显。

### 3.2 展示过滤规则不一致

Web 页面固定使用 `probability > 0.5`，正式任务使用每个类别独立阈值，并执行 4 类与 12 类之间的层级剪枝。

例如：

| 类别 | 当前默认阈值 |
|---|---:|
| Am | 0.510 |
| Atol | 0.400 |
| Y | 0.150 |
| ac4C | 0.120 |
| m6A | 0.260 |

如果继续使用固定 `0.5`，会出现分类树显示为预测存在，但分布图不显示的情况。

### 3.3 坐标映射

模型输入长度固定为 1001：

- 原始序列短于 1001：左右 padding。
- 原始序列长于 1001：从两侧截断，仅对中间 1001 个位置建模。

接口必须明确返回实际建模范围，微信端不能自行猜测。

### 3.4 小程序数据与渲染成本

完整数据最多包含 `12 × 1001` 个浮点数。若全部通过 `setData` 写入页面，会增加逻辑层与视图层通信成本。

完整数组应保存在组件实例字段中；WXML 数据只保存类别摘要、当前类别和状态信息。

---

## 四、方案对比

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| 微信端调用现有同步接口 | 前端改动较少 | 重复推理、慢、与任务结果可能不一致 | 不采用 |
| WebView 复用 Web 页面 | 开发最快、保留 ECharts | 体验割裂、域名和页面状态传递复杂 | 不采用 |
| 后端复用任务推理结果，微信端原生 Canvas | 性能好、结果一致、体验原生 | 需要同时修改后端和微信端 | 推荐 |

---

## 五、推荐总体方案

```text
微信提交批量任务
  ↓
Celery 任务完成一次模型推理
  ├── 保存现有结果：classification / Top-K attention / gcn
  └── 单独缓存完整注意力分布：attention_distribution:{jobId}
  ↓
结果页正常展示现有内容
  ↓
用户切换到「注意力分布」
  ↓
GET /api/v1/results/{jobId}/attention-distribution
  ↓
独立微信组件缓存数据并使用 Canvas 2D 绘制当前修饰类型
```

核心决策：

- 数据来源：复用异步任务推理结果。
- 接口形式：按单条序列的 `jobId` 获取。
- 展示类别：默认仅展示经过正式阈值和层级剪枝后 `is_predicted = true` 的类别。
- 展示布局：一次展示一个修饰类型的大图。
- 绘制方式：微信原生 Canvas 2D。
- 数据缓存：后端 Redis + 微信组件内存缓存。

---

## 六、后端设计

### 6.1 新增注意力分布数据构建逻辑

建议提取公共方法，避免 `tasks.py`、`tasks_docker.py` 和同步接口分别实现坐标处理：

```python
def build_attention_distribution(
    original_sequence,
    attn_weights,
    probs_12class,
    predictions_12class,
    left_padding,
    left_trimming,
):
    ...
```

该方法负责：

1. 将模型坐标裁剪或映射到原始序列坐标。
2. 去除短序列的 padding 区域。
3. 标记长序列实际建模范围。
4. 对可见建模范围内的注意力重新归一化。
5. 附加类别阈值和最终 `is_predicted` 状态。
6. 将浮点数适当舍入，减少 JSON 体积。

### 6.2 坐标处理规则

#### 原始序列长度小于或等于 1001

返回完整原始序列范围：

```text
model slice = [left_padding, left_padding + original_length)
modeled_range = [0, original_length)
```

返回的每个 `attention` 数组长度等于原始序列长度。

#### 原始序列长度大于 1001

仅返回模型实际处理的中间 1001 个位置：

```text
model slice = [0, 1001)
modeled_range = [left_trimming, left_trimming + 1001)
```

返回的每个 `attention` 数组长度为 1001。图表 x 轴必须使用原始序列坐标，从 `modeled_range.start` 开始。

### 6.3 归一化规则

推荐在移除 padding 或完成截断后，对每个类别的可见注意力重新归一化：

```text
sum(attention) = 1
normalization = "visible_modeled_range_sum_1"
```

接口必须返回归一化说明，避免未来调用方误解数值含义。

### 6.4 Redis 缓存

完整注意力分布单独缓存，不放入批量任务进度响应：

```text
Key: attention_distribution:{jobId}
TTL: 与 task:{jobId} 保持一致
```

这样可以避免：

- 批量进度接口返回体过大。
- 首页通过 URL 参数传递结果时数据膨胀。
- 用户未查看分布图时产生额外网络传输。

建议保存全部 12 个类别，便于未来增加“显示全部类别”功能；接口默认返回预测类别。

### 6.5 新增接口

```http
GET /api/v1/results/{jobId}/attention-distribution
```

可选查询参数：

```text
predictedOnly=true
```

默认 `predictedOnly=true`。

建议响应格式：

```json
{
  "job_id": "sequence-sha256",
  "sequence_length": 1200,
  "modeled_range": {
    "start": 99,
    "end": 1100
  },
  "normalization": "visible_modeled_range_sum_1",
  "classes": [
    {
      "index": 9,
      "name": "m6A",
      "probability": 0.63,
      "threshold": 0.26,
      "is_predicted": true,
      "attention": [0.00042, 0.00031]
    }
  ]
}
```

约定：

- `modeled_range.start` 包含。
- `modeled_range.end` 不包含。
- `attention[0]` 对应原始序列位置 `modeled_range.start`。
- `classes` 按类别索引排序。
- 无预测类别时返回 `200` 和空数组。
- 缓存不存在时返回 `404`，不要自动触发同步推理。

### 6.6 后端文件变更

| 文件 | 修改内容 |
|---|---|
| `tasks.py` | 推理完成后构建并缓存完整注意力分布 |
| `tasks_docker.py` | 与 `tasks.py` 保持同样逻辑 |
| `server.py` | 新增按 `jobId` 获取分布数据的接口 |
| 建议新增公共模块 | 放置坐标裁剪、归一化和响应构建逻辑 |

### 6.7 兼容性策略

历史任务可能没有 `attention_distribution:{jobId}` 缓存。微信端遇到 `404` 时显示：

```text
该任务暂不包含完整注意力分布，请重新提交序列。
```

不建议用同步推理接口静默回退，否则会重新引入结果不一致和重复推理问题。

---

## 七、微信前端设计

### 7.1 新增独立组件

新增：

```text
components/attention-distribution/
  index.js
  index.json
  index.wxml
  index.wxss
```

组件职责：

- 接收当前 `jobId`。
- 按需请求注意力分布。
- 管理加载、错误、空数据和当前类别。
- 缓存完整数组。
- 绘制 Canvas。
- 在类别切换或组件重新显示时重绘。

结果页职责：

- 提供「重点位点 / 注意力分布」切换。
- 将当前结果的 `jobId` 传入组件。
- 切换批量序列时更新组件输入。

### 7.2 结果页布局

在现有 `Attention Weights` 区域增加分段切换：

```text
┌──────────────────────────────────┐
│ Attention Weights                │
│ [重点位点] [注意力分布]           │
├──────────────────────────────────┤
│ 当前模式内容                      │
└──────────────────────────────────┘
```

「重点位点」保留现有页面功能。

「注意力分布」使用单类型大图：

```text
┌──────────────────────────────────┐
│ 修饰类型  [m6A (A)           ▾]  │
│ P = 63.0%    阈值 = 26.0%        │
│                                  │
│      注意力折线与面积图           │
│                                  │
│ 建模范围：99 - 1099              │
└──────────────────────────────────┘
```

单类型大图比 Web 端多图堆叠更适合手机屏幕，也便于后续增加触摸提示。

### 7.3 组件属性

```javascript
properties: {
  jobId: {
    type: String,
    value: ''
  },
  active: {
    type: Boolean,
    value: false
  }
}
```

- `jobId` 改变时清空当前展示并加载对应数据。
- `active` 从 `false` 变为 `true` 时，如果已有缓存则重新绘图。

### 7.4 组件状态

只将 WXML 需要的数据放入 `data`：

```javascript
data: {
  loading: false,
  error: '',
  classOptions: [],
  selectedClassIndex: 0,
  currentClassSummary: null,
  sequenceLength: 0,
  modeledRangeText: ''
}
```

完整响应和注意力数组保存在组件实例字段：

```javascript
this.distributionData = null;
this.requestToken = 0;
```

不要把所有注意力数组写入 `setData`。

### 7.5 请求与缓存

组件内部使用：

```javascript
requestWithFallback(
  `/api/v1/results/${jobId}/attention-distribution?predictedOnly=true`,
  { method: 'GET' }
)
```

建议增加模块级内存缓存：

```javascript
const distributionCache = new Map();
```

缓存键为 `jobId`。同一结果页内切换「重点位点 / 注意力分布」或切换回已查看序列时，不重复请求。

必须使用请求令牌避免竞态：

1. 开始请求时递增 `requestToken`。
2. 响应返回时检查令牌和当前 `jobId`。
3. 已切换到其他批量序列时忽略旧响应。

### 7.6 Canvas 2D 绘制

绘制内容：

- 背景。
- x/y 坐标轴。
- 水平辅助线。
- 注意力面积填充。
- 注意力折线。
- 首、中、尾位置刻度。
- y 轴 `0` 和最大值。

绘制流程：

1. 使用 `wx.nextTick` 等待 Canvas 节点创建。
2. 使用 `wx.createSelectorQuery().in(this)` 获取 Canvas 2D 节点和尺寸。
3. 按 DPR 设置物理像素尺寸。
4. 根据画布宽度对数据降采样。
5. 绘制坐标轴、面积和折线。

### 7.7 降采样规则

长序列需要在绘制前降采样。推荐使用“每个像素桶保留最大值”的方式，以避免注意力峰值被平均掉：

```text
bucketSize = ceil(attention.length / drawableWidth)
sampledPoint = max(bucket)
```

图表 tooltip 暂不纳入首期。后续增加触摸提示时，需要同时保存每个采样桶对应的原始位置范围。

### 7.8 配色

复用 Web 端修饰类别配色：

```javascript
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
```

### 7.9 状态设计

组件需要覆盖：

| 状态 | 展示 |
|---|---|
| 未激活 | 不请求、不绘制 |
| 加载中 | 局部 loading，不遮挡整个结果页 |
| 请求失败 | 错误信息和重试按钮 |
| 历史任务无缓存 | 提示重新提交序列 |
| 无预测类别 | 提示没有预测到可展示的修饰类型 |
| 加载成功 | 类别选择器和图表 |

### 7.10 微信端文件变更

| 文件 | 修改内容 |
|---|---|
| `app.json` 或页面 JSON | 注册注意力分布组件 |
| `pages/results/results.js` | 增加视图模式状态和切换事件 |
| `pages/results/results.wxml` | 增加分段切换并挂载组件 |
| `pages/results/results.wxss` | 增加模式切换样式 |
| `components/attention-distribution/*` | 请求、缓存、状态和 Canvas 绘制 |

---

## 八、建议接口与组件数据流

```text
用户打开 results 页面
  ↓
默认展示现有重点位点
  ↓
用户点击「注意力分布」
  ↓
results.js 设置 attentionViewMode = "distribution"
  ↓
attention-distribution 组件 active = true
  ↓
检查内存缓存 distributionCache[jobId]
  ├── 命中：更新摘要并绘制
  └── 未命中：
       GET /api/v1/results/{jobId}/attention-distribution
       ↓
       校验请求令牌和当前 jobId
       ↓
       完整数组写入组件实例字段和内存缓存
       ↓
       摘要信息通过 setData 写入视图层
       ↓
       wx.nextTick 后绘制当前类别
```

批量序列切换时：

```text
currentResultData.jobId 改变
  ↓
组件 observer 清空当前展示
  ↓
取消旧请求结果的应用资格
  ↓
若组件处于 active 状态，加载新 jobId 数据
```

---

## 九、实施步骤

### 阶段 1：后端数据复用

1. 提取注意力分布构建公共方法。
2. 在 `tasks.py` 中使用已有 `attn_weights`、概率和最终预测状态构建分布数据。
3. 将数据写入 `attention_distribution:{jobId}`。
4. 同步修改 `tasks_docker.py`。
5. 新增 `GET /api/v1/results/{jobId}/attention-distribution`。
6. 为短序列、1001 长度序列和长序列增加测试。

### 阶段 2：微信组件

1. 创建 `components/attention-distribution`。
2. 完成请求、状态、缓存和请求竞态处理。
3. 完成 Canvas DPR 适配、降采样和绘图。
4. 完成类别切换和重试功能。

### 阶段 3：结果页集成

1. 在 Attention Weights 区域增加模式切换。
2. 保持现有重点位点模式行为不变。
3. 将当前结果 `jobId` 传入组件。
4. 验证批量序列切换和模式切换。

### 阶段 4：联调与回归

1. 对比微信曲线与后端返回数组。
2. 对比分类树预测类别与分布图类别。
3. 验证主备服务器切换。
4. 验证历史任务、缓存过期和网络失败状态。

---

## 十、测试与验收标准

### 10.1 后端测试

- [ ] 长度小于 1001 的序列已移除 padding，返回数组长度等于原始序列长度。
- [ ] 长度等于 1001 的序列返回完整 1001 个点。
- [ ] 长度大于 1001 的序列返回中间 1001 个点和正确的 `modeled_range`。
- [ ] 每个类别可见范围内的注意力和约等于 1。
- [ ] `threshold` 与后端配置一致。
- [ ] `is_predicted` 与分类树最终结果一致。
- [ ] 分布缓存与普通任务结果使用相同 TTL。
- [ ] 缓存不存在时接口返回明确的 `404`。
- [ ] `tasks.py` 与 `tasks_docker.py` 行为一致。

### 10.2 微信端功能测试

- [ ] 默认重点位点模式功能无回归。
- [ ] 首次进入分布模式时显示局部 loading。
- [ ] 加载成功后默认展示第一个预测修饰类别。
- [ ] 切换修饰类别后 Canvas 正确重绘。
- [ ] 切回重点位点再返回分布模式时不重复请求。
- [ ] 批量序列切换后显示对应 `jobId` 的数据。
- [ ] 快速切换批量序列时不会显示旧请求结果。
- [ ] 后端 `404`、网络失败和空类别均有明确状态。
- [ ] 重试按钮可以重新发起请求。

### 10.3 视觉与性能测试

- [ ] Canvas 在高 DPR 设备上清晰。
- [ ] 长序列绘制不卡顿，峰值未因降采样丢失。
- [ ] 图表 x 轴使用原始序列坐标。
- [ ] 页面滚动、picker 和底部序列标签栏无冲突。
- [ ] 多次切换模式后 Canvas 仍可正确重绘。
- [ ] 完整注意力数组未写入页面级 `setData`。

---

## 十一、风险与缓解措施

| 风险 | 缓解措施 |
|---|---|
| Redis 中完整数组增加存储体积 | 单独 key、与任务结果相同 TTL、浮点数舍入 |
| 批量任务响应过大 | 完整分布不进入批量进度响应，按 `jobId` 延迟获取 |
| Canvas 节点尚未创建 | 使用 `wx.nextTick` 和组件内 selector query |
| 快速切换序列导致旧响应覆盖新页面 | 使用请求令牌并校验当前 `jobId` |
| 长序列坐标被误解 | 接口明确返回半开区间 `modeled_range` |
| 分类结果与图表类别不一致 | 使用任务最终 `predictions_12class`，不再固定过滤 0.5 |
| 历史任务没有完整分布 | 返回明确提示，引导重新提交 |
| 本地与 Docker 后端逻辑分叉 | 公共方法复用，并同步测试两套任务入口 |

---

## 十二、后续增强

首期稳定后可考虑：

1. 增加“仅预测类别 / 全部 12 类”切换。
2. 增加触摸位置提示，显示原始位置和注意力值。
3. 增加当前类别的 Top-N 峰值列表。
4. 增加多个类别曲线叠加比较。
5. 让 Web 端也改用按 `jobId` 缓存结果，移除重复同步推理。

---

## 十三、最终决策摘要

本次迁移采用：

```text
后端复用异步推理结果
+ 按 jobId 单独获取完整注意力分布
+ 正式分类阈值和层级剪枝结果
+ 独立微信原生组件
+ 单修饰类型大图
+ Canvas 2D 降采样绘制
```

该方案比直接调用现有同步接口更快、更一致，也更适合微信小程序的移动端交互和数据传输限制。
