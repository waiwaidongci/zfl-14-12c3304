# 微型制钟师

静态浏览器小游戏，直接打开 `index.html` 即可运行。

玩家根据故障记录选择零件，将零件拖到钟面对应插槽，或点击零件快速装配。完成后调节摆长和齿轮咬合，运行走时测试并获得误差与评分。

## 测试

误差计算和评分规则已抽出为纯计算模块 `calc.js`（`window.CalcEngine` / CommonJS 双模式），不依赖 DOM 与随机扰动，可稳定测试。覆盖用例：

- 目标零件全匹配（零零件误差）
- 缺失零件罚分（擒纵 42 / 其他 34）
- 错误零件逐槽差值
- 摆长微调 −3/格、咬合微调 +2.2/格
- 零件+微调综合场景
- 指定 jitter 的带扰动结果
- 评分档位 S/A/B/C/D 全部边界
- 验收判定与 gap
- 缺省参数、未知零件等防御性场景

### 方式一：浏览器打开（零依赖）

打开 `tests/test.html`，页面会自执行所有用例并以分组形式展示通过/失败。

### 方式二：命令行 Node.js（零依赖）

```bash
node tests/calc.test.js
```

退出码 0 表示全部通过，非 0 表示有失败用例并打印错误详情。

## 文件结构

```
├── calc.js              # 纯计算：误差/评分/验收（已抽离，可被测试稳定覆盖）
├── data.js              # 订单与零件数据
├── store.js             # 全局状态与装配、测试操作（调用 calc.js）
├── diagnostics.js       # 诊断提示（复用 calc.js）
├── manual.js            # 修理手册面板（复用 calc.js）
├── dom.js / events.js   # DOM 查询与事件绑定
├── renderer.js / app.js # 渲染与启动
├── styles.css
├── index.html
└── tests
    ├── calc.test.js     # Node.js 端测试（内置 assert，无额外依赖）
    └── test.html        # 浏览器端可视化测试
```
