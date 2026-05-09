# osu!mania Map Renderer 代码维基

## 目录

1. [项目概述](#项目概述)
2. [技术架构](#技术架构)
3. [核心模块详解](#核心模块详解)
4. [组件系统](#组件系统)
5. [数据解析层](#数据解析层)
6. [运行时系统](#运行时系统)
7. [配置系统](#配置系统)
8. [工具函数](#工具函数)
9. [测试覆盖](#测试覆盖)
10. [快速开始](#快速开始)
11. [扩展指南](#扩展指南)

---

## 项目概述

**osu!mania Map Renderer** 是一个基于 Remotion 构建的 osu!mania 谱面视频渲染器，用于将 `.osu` 谱面文件和 `.osr` 回放文件渲染为高质量视频。

### 核心能力

| 能力 | 描述 |
|------|------|
| 谱面解析 | 完整支持 `.osu` 格式：音符、Timing、滚动速度、音效 |
| 回放可视化 | 解析 `.osr` 回放并动画显示按键和判定着色 |
| 故事板渲染 | 完整支持 `.osb` 故事板，包括所有命令类型 |
| 动态键位 | 自动检测 1K-18K+ 谱面 |
| 判定系统 | ScoreV1、ScoreV2、自定义窗口 |
| PP 计算 | 实时计算 osu!mania PP |
| 音效系统 | 谱面专属音效 + 回退链 |

### 技术栈

```
┌─────────────────────────────────────────────────┐
│                   渲染层                          │
│         Remotion v4 (React 视频渲染)               │
├─────────────────────────────────────────────────┤
│                   样式层                          │
│         Tailwind CSS v4 + 自定义 CSS              │
├─────────────────────────────────────────────────┤
│                   类型层                          │
│         TypeScript + Zod v4                      │
├─────────────────────────────────────────────────┤
│                   解析层                          │
│         自定义解析器 (Node.js 脚本)                │
└─────────────────────────────────────────────────┘
```

---

## 技术架构

### 渲染架构（三层叠加）

```
┌─────────────────────────────────────────────────────────┐
│                    Layer 1: ManiaBackground               │
│  ┌─────────────────────────────────────────────────┐    │
│  │  背景图片 (可调模糊/变暗)                            │    │
│  │  故事板层 (Background/Fail/Pass/Foreground/Overlay) │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│                    Layer 2: ManiaStageLayer             │
│  ┌─────────────────────────────────────────────────┐    │
│  │  节拍线 / 小节线                                   │    │
│  │  音符 (普通音符 + 长按音符)                          │    │
│  │  判定线                                           │    │
│  │  按键指示器                                        │    │
│  │  列高亮                                           │    │
│  │  击中特效 (音符闪烁 + 列闪光)                        │    │
│  │  回放光标 (下落条 + 圆点)                           │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│                    Layer 3: ManiaOverlay                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  元数据显示 (标题/艺术家/难度信息)                     │    │
│  │  分数、连击、最大连击                                │    │
│  │  实时 PP 计算                                     │    │
│  │  判定统计 (P/G/GO/O/M/Miss)                       │    │
│  │  最后判定文字动画                                  │    │
│  │  偏移可视化指示器                                  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 数据流程

```
cheart/*.osu ──[parseBeatmap.ts]──▶ src/generated/beatmap.json ──import──▶ React 组件
replay/*.osr  ──[parseReplay.ts]──▶  src/generated/replay.json   ──import──▶ 回放光标
*.osb + [Events] ──[sbParser]──▶   src/generated/storyboard.json ──import──▶ 故事板
```

---

## 核心模块详解

### src/lib/osuParser.ts

谱面数据解析和类型定义。

**主要接口：**

```typescript
// 元数据
interface BeatmapMetadata {
  title: string;           // 标题
  titleUnicode: string;    // Unicode 标题
  artist: string;          // 艺术家
  artistUnicode: string;   // Unicode 艺术家
  creator: string;         // 谱师
  version: string;         // 难度名
  source: string;          // 来源
  tags: string[];          // 标签
}

// 难度属性
interface BeatmapDifficulty {
  hpDrainRate: number;      // HP 消耗
  circleSize: number;        // 键位数 (CircleSize)
  overallDifficulty: number; // OD (判定难度)
  approachRate: number;     // AR (缩放速度)
  sliderMultiplier: number;  // Slider 倍率
  sliderTickRate: number;   // Slider 刻度数
}

// Timing 点
interface TimingPoint {
  time: number;         // 时间 (ms)
  beatLength: number;   // 拍长 (正值=BPM, 负值=SV)
  meter: number;        // 拍号
  sampleSet: number;     // 音效集
  volume: number;       // 音量
  uninherited: boolean; // true=BPM, false=SV
  effects: number;      // 效果
}

// 音符对象
interface HitObject {
  x: number;
  y: number;
  time: number;           // 出现时间
  type: number;           // 类型位掩码
  hitSound: number;       // 音效
  column: number;         // 列号 (mania 专用)
  isLongNote: boolean;    // 是否为 LN
  endTime?: number;        // LN 结束时间
}
```

**导出内容：**

```typescript
export const beatmap: ParsedBeatmap;        // 预加载的谱面数据
export function getBeatmapDuration(): number; // 获取谱面时长
export function parseHitSample(): HitSample | undefined; // 解析音效
```

---

### src/lib/osrParser.ts

`.osr` 回放文件二进制解析器。

**主要功能：**

- **ULEB128 编码解析** — 压缩整数解码
- **LZMA/Zlib 解压** — 多种压缩格式支持
- **二进制结构解析** — 解析完整 osu! 回放格式

**数据结构：**

```typescript
interface ReplayData {
  mode: number;           // 游戏模式
  gameVersion: number;    // osu! 版本
  beatmapHash: string;    // 谱面 MD5
  playerName: string;     // 玩家名
  count300/100/50: number; // 各判定计数
  mods: number;           // Mod 位掩码
  lifeData: { time: number; life: number }[]; // 血量数据
  replayData: ReplayFrame[]; // 每帧按键数据
}

interface ReplayFrame {
  timeOffset: number; // 距上一帧的 ms
  x: number;          // X 坐标 (mania 列号)
  y: number;          // Y 坐标 (判定线位置)
  keys: number;       // 按键位掩码
}
```

**Mod 常量：**

```typescript
export const MOD_NOFAIL = 1;
export const MOD_EASY = 2;
export const MOD_HIDDEN = 8;
export const MOD_HARDROCK = 16;
export const MOD_DOUBLETIME = 64;
export const MOD_NIGHTCORE = 512;
export const MOD_PERFECT = 16384;
```

---

### src/lib/judgment.ts

判定系统核心模块。

**判定模式：**

```typescript
type JudgmentMode = "v1" | "v2" | "custom";

interface HitWindows {
  perfect: number;  // 320 分窗口
  great: number;    // 300 分窗口
  good: number;     // 200 分窗口
  ok: number;        // 100 分窗口
  meh: number;       // 50 分窗口
  miss: number;      // Miss 窗口
}
```

**判定算法：**

```typescript
// v2 (ScoreV2): 使用 DifficultyRange + floor + 0.5
function getHitWindowsV2(od: number): HitWindows

// v1 (Classic): 使用简化公式
function getHitWindowsV1(od: number): HitWindows

// 自定义判定窗口
function setCustomWindows(windows: CustomHitWindows): void
```

**核心函数：**

```typescript
// 计算单个音符判定
export function calculateJudgment(
  hitTime: number,    // 实际击中时间
  noteTime: number,   // 音符时间
  od: number          // Overall Difficulty
): Judgment

// 获取判定颜色
export function getJudgmentColor(judgment: Judgment): string

// 获取判定分数
export function getJudgmentScore(judgment: Judgment): number

// 计算所有判定结果 (含缓存)
export function getJudgmentResults(
  hitObjects: HitObject[],
  od: number
): JudgmentResult[]

// 获取回放按键间隔
export function getKeyIntervals(hitObjects?: HitObject[]): KeyInterval[]

// 判断是否为自动模式
export function isAutoplayMode(): boolean
```

---

### src/lib/difficulty.ts

难度计算和 PP 系统。

**星级计算：**

```typescript
interface DifficultyResult {
  stars: number;         // 星级
  maxCombo: number;      // 最大连击
  difficulty: number;    // 难度值
  total: number;         // 总 PP
  ppComponents: {
    difficulty: number;
  };
}

// 计算星级
function calculateStarRating(
  hitObjects: HitObject[],
  totalColumns: number
): number {
  // 基于密度: 音符/秒, LN 比例, 列分布平衡度
  const notesPerSecond = 1000 / avgDelta;
  const lnRatio = lnCount / totalNotes;
  const balance = maxCol / minCol;
  
  const baseSR = Math.sqrt(notesPerSecond / totalColumns) * 2.65;
  const lnBonus = 1 + lnRatio * 0.33;
  const balanceFactor = 1 + (balance - 1) * 0.12;
  
  return baseSR * lnBonus * balanceFactor;
}
```

**PP 计算 (osu!mania 公式)：**

```typescript
// PP = 8.0 * pow(max(stars - 0.15, 0.05), 2.2)
//     * max(0, 5 * accuracy - 4)
//     * (1 + 0.1 * min(1, totalHits / 1500))

function calculatePP(beatmap, maxCombo, stars, replayData): {
  total: number;        // 总 PP
  difficulty: number;  // 难度 PP
}

// 实时 PP 计算
export function calculateRealtimePP(
  beatmap,
  currentTime: number,
  currentCombo: number,
  judgmentCounts: JudgmentCounts
): number
```

---

### src/lib/scrollVelocity.ts

滚动速度 (SV) 系统。

**核心算法：**

```typescript
interface ScrollVelocitySegment {
  startTime: number;       // 开始时间
  scrollVelocity: number; // 滚动倍率
}

// 从 Timing Points 提取 SV 段
export function extractScrollVelocitySegments(
  timingPoints: TimingPoint[]
): ScrollVelocitySegment[]

// 获取某时间的 SV 值
export function getScrollVelocityAt(
  segments: ScrollVelocitySegment[],
  time: number
): number
```

**顺序滚动算法：**

```typescript
export class SequentialScrollAlgorithm {
  constructor(
    svSegments: ScrollVelocitySegment[],  // SV 段列表
    timeRange: number                      // 可见时间范围
  );
  
  // 计算音符在当前时间的进度
  getProgress(noteTime: number, currentTime: number): number
}
```

---

## 组件系统

### src/ManiaRender.tsx

完整渲染编排组件。

**Props：**

```typescript
interface ManiaRenderProps {
  time: {
    beatOffset: number;    // 节拍偏移
    timeOffset: number;   // 时间偏移
  };
  scroll: {
    scrollSpeed: number;  // 滚动速度 (5-50)
  };
  judgment: {
    mode: "v1" | "v2" | "custom";
    offset: number;        // 判定偏移
    showZones: boolean;   // 显示判定区
    customWindows?: CustomHitWindows;
  };
  layout: {
    stageOffset: number;     // 舞台 X 偏移
    judgmentLineY: number;   // 判定线 Y 位置 (100-1000)
    judgmentTextY: number;    // 判定文字 Y 位置
  };
  contents: {
    trackHeight: boolean;     // 显示轨道高度线
    columnHighlights: boolean; // 列高亮
    replayCursor: boolean;     // 回放光标
    sessionLine: boolean;      // 小节线
    storyboardEnabled: boolean; // 故事板
    bgDarken: number;          // 背景变暗 (0-1)
    bgBlur: number;            // 背景模糊 (0-20)
    stageBgOpacity: number;    // 舞台透明度
    hitsounds: HitsoundsConfig;
    hitOffsetIndicator: HitOffsetIndicatorConfig;
  };
}
```

---

### src/ManiaStageLayer.tsx

舞台渲染核心组件。

**渲染内容：**

1. **BeatLinesLayer** — 节拍线和小节线
2. **ManiaNote** — 单个音符渲染
3. **JudgmentZonesLayer** — 判定区域可视化
4. **KeyIndicatorsLayer** — 按键指示器
5. **ColumnHighlightsLayer** — 列高亮效果
6. **HitEffectsLayer** — 击中特效
7. **ReplayCursor** — 回放光标

**性能优化：**

```typescript
// 音符剔除 — 只渲染可见窗口内的音符
const visibleNotes = useMemo(() => {
  if (!ENABLE_NOTE_CULLING) return hitObjects;
  
  const margin = 500; // 缓冲区域
  const earliestTime = currentTime - margin;
  const latestTime = currentTime + visibleTime + margin;
  
  // 二分查找左右边界
  const rightIdx = bisectRight(startTimes, latestTime);
  const leftIdx = bisectRight(startTimes, earliestTime - 0.001) + 1;
  
  return hitObjects.slice(leftIdx, rightIdx + 1);
}, [hitObjects, currentTime, visibleTime]);
```

---

### src/components/stage/

舞台子组件集合。

| 组件 | 功能 |
|------|------|
| `BeatLinesLayer` | 节拍线和小节线渲染 |
| `ColumnHighlightsLayer` | 列高亮闪烁效果 |
| `HitEffectsLayer` | 击中时的列闪光和音符闪烁 |
| `JudgmentZonesLayer` | 判定区域可视化 |
| `KeyIndicatorsLayer` | 底部按键按下指示 |

---

### src/ManiaNote.tsx

单个音符渲染组件。

**特性：**

- 普通音符和长按音符 (LN) 统一渲染
- 支持负 x 坐标的屏幕外音符
- 动态计算 Y 位置（基于时间和滚动速度）
- LN 尾部渲染

```typescript
interface ManiaNoteProps {
  note: HitObject;
  scrollSpeed: number;
  scrollAlgorithm?: SequentialScrollAlgorithm;
  judgmentLineY: number;
  stageOffset: number;
}
```

---

## 数据解析层

### scripts/parseBeatmap.ts

谱面解析脚本。

```bash
# 解析选定的谱面
npm run parse

# 按关键词解析
npm run parse -- "song name"

# 解析所有谱面
npm run parse:all
```

**解析流程：**

1. 扫描 `cheart/` 目录下的 `.osu` 文件
2. 支持多目录：`cheart/`, `cheart-bliss/`, `cheart-spm/` 等
3. 解析生成：
   - `src/generated/beatmap.json`
   - `public/audio.mp3`
   - `public/background.jpg`
   - `public/Storyboard/` (故事板资源)

---

### scripts/parseReplay.ts

回放解析脚本。

```bash
# 解析选定的回放
npm run parse:replay

# 按关键词解析
npm run parse:replay -- "player name"
```

---

## 运行时系统

### src/lib/storyboard/

故事板运行时解析和渲染系统。

**目录结构：**

```
storyboard/
├── command-evaluator.ts  # 命令插值和优先级
├── easing.ts             # 35 种缓动函数
├── loop-evaluator.ts     # 循环迭代计算
├── visibility.ts         # 可见性计算
└── index.ts              # 导出
```

#### 命令类型支持

| 命令 | 功能 | 参数格式 |
|------|------|----------|
| F | 透明度 | `startVal, endVal` |
| M | 移动 | `x1, y1, x2, y2` |
| MX/MY | 单轴移动 | `val1, val2` |
| S | 缩放 | `startScale, endScale` |
| V | 矢量缩放 | `sx1, sy1, sx2, sy2` |
| R | 旋转 | `startDeg, endDeg` (弧度→角度) |
| C | 颜色 | `r1,g1,b1, r2,g2,b2` |
| P | 参数 | `H`(水平翻转) / `V`(垂直翻转) / `A`(叠加) |

#### 缓动函数 (35 种)

```typescript
// easing.ts 导出
export function applyEasing(t: number, easing: number): number

// 示例
case 0:  return t;                              // linear
case 1:  return t * (2 - t);                    // easeOut
case 2:  return t * t;                          // easeIn
case 3:  return t * t;                          // easeInQuad
case 7:  return 1 - Math.pow(1 - t, 3);        // easeOutCubic
case 24: return -Math.pow(2,10*t-10)*sin(...);  // easeInElastic
case 33: return bounceOut(t);                    // easeOutBounce
// ... 更多
```

#### 命令求值器

```typescript
// "latest startTime wins" 规则
function evaluateSequence<T>(...) {
  // 1. 过滤同类型命令并按开始时间排序
  // 2. 找到当前时间最后一个开始的命令
  // 3. 如果命令正在执行，进行插值
  // 4. 如果命令已结束，使用终值
  // 5. 循环命令与直接命令按 startTime 比较
}

// 核心导出
export function getOpacity(commands, loops, time): number
export function getPosition(commands, loops, time, defaultX, defaultY): {x, y}
export function getScale(commands, loops, time): number
export function getVectorScale(commands, loops, time): {x, y}
export function getRotation(commands, loops, time): number
export function getColor(commands, loops, time): {r, g, b}
export function getFlipState(commands, loops, time): {flipH, flipV, additive}
export function isObjectVisible(commands, loops, time): boolean
```

#### 循环求值

```typescript
// L 命令迭代计算
export function getLoopCommandValue(
  loops: SbLoop[],
  cmdType: string,
  currentTime: number,
  paramIndex: number
): { value: number; startTime: number; endTime: number } | null {
  // 1. 计算当前迭代次数
  const iteration = Math.floor((timeSinceFirstCmd) / loopDuration);
  
  // 2. 计算命令绝对时间
  const cmdStartAbs = iterationStart + (cmd.startTime - minCmdStart);
  
  // 3. 插值计算
  const t = (currentTime - cmdStartAbs) / duration;
  const easedT = applyEasing(t, cmd.easing);
  value = startValue + (endValue - startValue) * easedT;
}
```

#### 可见性系统

```typescript
export function isObjectVisible(commands, loops, currentTime): boolean {
  // 1. 计算生命周期开始时间
  //    - 有 F 命令：第一个可见 F 的开始时间
  //    - 无 F 命令：第一个命令的开始时间
  
  // 2. 计算生命周期结束时间
  //    - 最大命令结束时间
  //    - 循环结束时间
  
  // 3. 检查透明度 > 0
  return currentTime >= lifetimeStart && 
         currentTime <= lifetimeEnd && 
         getOpacity(commands, loops, currentTime) > 0;
}
```

---

### src/lib/StoryboardLayer.tsx

故事板 React 渲染组件。

**特性：**

- 全局 SVG 颜色滤镜 (优化性能)
- Gamma 校正 (sRGB → 线性空间)
- 负缩放镜像处理
- 帧动画支持

```typescript
// 坐标转换
const STORYBOARD_SCALE = 1080 / 480; // 2.25
const x = containerOffsetX + objectX * STORYBOARD_SCALE;
const y = containerOffsetY + objectY * STORYBOARD_SCALE;

// 颜色滤镜
<svg>
  <defs>
    <filter id="sb-color-255-0-128">
      <feColorMatrix
        type="matrix"
        values="1 0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 1 0"
      />
    </filter>
  </defs>
</svg>
```

---

## 配置系统

### src/config.ts

全局配置和动态键位系统。

**键位配置 (1K-18K)：**

```typescript
// 预定义颜色映射
const COLUMN_COLORS_MAP: Record<number, string[]> = {
  4: ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"],
  7: ["#FF6B6B", "#FF8E53", "#FFD93D", "#4ECDC4", 
      "#FFD93D", "#FF8E53", "#FF6B6B"],
  // ...
};

// 动态计算函数
export function getColumnColors(keyCount: number): string[]
export function getColumnPositionsStage(keyCount: number): number[]
export function getColumnPositionsNote(keyCount: number): number[]
export function getStageWidth(keyCount: number): number

// 动态键位设置
export function setKeyCount(count: number): void
export function getKeyCount(): number

// 音效配置
export const hitsoundConfig = {
  basePath: string,
  defaultVolume: number,
  sampleSets: Record<number, string>,
  hitSoundFlags: { normal, whistle, finish, clap },
  fallbackSounds: { normal, whistle, finish, clap },
}
```

---

### src/schema.ts

Zod 类型校验和 Props 定义。

```typescript
export const maniaRenderSchema = z.object({
  time: z.object({
    beatOffset: z.number().min(0),
    timeOffset: z.number(),
  }),
  scroll: z.object({
    scrollSpeed: z.number().min(5).max(50),
  }),
  judgment: z.object({
    mode: z.enum(["v1", "v2", "custom"]),
    offset: z.number().default(0),
    showZones: z.boolean().default(false),
    customWindows: z.object({...}).optional(),
  }),
  layout: z.object({...}),
  contents: maniaRenderContentsSchema,
});

export type ManiaRenderProps = z.infer<typeof maniaRenderSchema>;
```

---

## 工具函数

### src/lib/utils.ts

通用工具函数。

```typescript
// 二分查找
export function bisectRight(arr: number[], x: number): number
export function bisectLeft(arr: number[], x: number): number

// 线性插值
export function lerp(a: number, b: number, t: number): number

// 颜色转换
export function hexToRgb(hex: string): {r, g, b}
export function rgbToHex(r: number, g: number, b: number): string

// 数组工具
export function clamp(value: number, min: number, max: number): number
export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number
```

---

## 测试覆盖

### 测试框架

Vitest — 快速并行测试运行器

```bash
# 运行所有测试
npm run test

# 运行特定文件
npm run test -- src/lib/__tests__/judgment.test.ts

# 监视模式
npm run test -- --watch
```

### 测试覆盖范围

| 模块 | 测试内容 |
|------|----------|
| 命令求值 | F, M, S, V, R, C, P 类型 |
| 循环计时 | 迭代计算、优先级 |
| 缓动函数 | 全部 35 种缓动 |
| 可见性 | 生命周期计算 |
| 动画帧 | 帧索引计算 |
| 颜色滤镜 | ID 生成 |
| 判定窗口 | v1/v2/自定义 |
| 谱面解析 | .osu 文件解析 |
| 回放解析 | .osr LZMA 解压 |
| 故事板解析 | 完整解析流程 |
| 滚动速度 | SV 段提取 |
| 难度计算 | 星级算法 |

---

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装依赖

```bash
npm install
```

### 准备文件

```bash
# 将 .osu 谱面放入 cheart/ 目录
mkdir -p cheart
cp /path/to/song.osu cheart/

# 将 .osr 回放放入 replay/ 目录 (可选)
mkdir -p replay
cp /path/to/play.osr replay/
```

### 解析谱面

```bash
# 解析谱面
npm run parse

# 或指定关键词
npm run parse -- "song name"

# 同时解析回放
npm run parse:all
```

### 预览渲染

```bash
# 打开 Remotion Studio
npm run dev

# 访问 http://localhost:3000
# 在侧边栏选择 Compositions
# 调整右侧参数面板
```

### 导出视频

```bash
# 完整渲染
npx remotion render ManiaRender out/video.mp4

# 单独渲染背景
npx remotion render ManiaBackground out/bg.mp4

# 单独渲染舞台
npx remotion render ManiaStageOnly out/stage.mp4

# 单独渲染覆盖层
npx remotion render ManiaOverlayOnly out/overlay.mp4

# 单独渲染回放光标
npx remotion render ManiaReplayCursorOnly out/cursor.mp4
```

### 常用命令

```bash
# 代码检查
npm run lint

# 运行测试
npm run test

# 构建包
npm run build
```

---

## 扩展指南

### 添加新的判定模式

在 `src/lib/judgment.ts` 中扩展：

```typescript
export type JudgmentMode = "v1" | "v2" | "custom" | "yourMode";

// 添加新的判定窗口计算
function getHitWindowsYourMode(od: number): HitWindows {
  // 实现自定义逻辑
  return {
    perfect: yourPerfectWindow,
    great: yourGreatWindow,
    // ...
  };
}

// 在 getHitWindows 中添加 case
export function getHitWindows(od: number): HitWindows {
  if (currentJudgmentMode === "custom") {
    // ...
  }
  switch (currentJudgmentMode) {
    case "v2": return getHitWindowsV2(od);
    case "v1": return getHitWindowsV1(od);
    case "yourMode": return getHitWindowsYourMode(od);
    default: return getHitWindowsV2(od);
  }
}
```

### 添加新故事板命令

1. 在 `src/lib/sbParser/types.ts` 添加类型：

```typescript
export type CommandType = "F" | "M" | "MX" | "MY" | "S" | "V" | "R" | "C" | "P" | "N";
```

2. 在 `src/lib/sbParser/parser.ts` 添加解析逻辑：

```typescript
case "N": // 新命令
  // 解析参数
  if (parts[5] === undefined) {
    params = [parseFloat(parts[4])];
  } else {
    params = [parseFloat(parts[4]), parseFloat(parts[5])];
  }
  break;
```

3. 在 `src/lib/storyboard/command-evaluator.ts` 添加求值：

```typescript
export function getYourProperty(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): number {
  return evaluateSequence(
    commands, loops, currentTime, "N",
    {
      handleInfinite: (cmd, time) => getCommandValue(cmd, time, 0),
      handleActive: (cmd, time) => getCommandValue(cmd, time, 0),
      handleEnded: (cmd) => cmd.params[1] ?? cmd.params[0] ?? 0,
      handlePreRead: (cmd) => cmd.params[0] ?? 0,
      defaultValue: 0,
    },
    getYourPropertyFromLoops,
  );
}
```

### 添加新的故事板缓动函数

在 `src/lib/storyboard/easing.ts` 中添加：

```typescript
export function applyEasing(t: number, easing: number): number {
  switch (easing) {
    // ... 现有 case
    case 35: return Math.pow(t - 1, 10) * t + 1; // OutPow10
    // 添加新的缓动
    case 36: return yourCustomEasing(t);
    default: return t;
  }
}
```

---

## 附录

### 判定颜色参考

| 判定 | 颜色 | 分数 |
|------|------|------|
| Perfect | #FF00FF (品红) | 320 |
| Great | #00FF88 (绿色) | 300 |
| Good | #00AAFF (蓝色) | 200 |
| Ok | #FFAA00 (橙色) | 100 |
| Meh | #FF4444 (红色) | 50 |
| Miss | #888888 (灰色) | 0 |

### 坐标系统

- **故事板坐标系**：640×480 (osu! 原生)
- **渲染坐标系**：1920×1080 (输出分辨率)
- **缩放比例**：2.25 (1080/480)

### 文件结构

```
src/
├── components/stage/         # 舞台子组件
├── lib/                       # 核心库
│   ├── __tests__/            # 单元测试
│   ├── sbParser/             # 故事板解析器
│   └── storyboard/           # 故事板运行时
├── generated/                # 解析生成的数据 (gitignore)
├── ManiaBackground.tsx       # 背景层
├── ManiaOverlay.tsx          # 覆盖层
├── ManiaStageLayer.tsx       # 舞台层
├── ManiaNote.tsx             # 音符组件
├── ReplayCursor.tsx          # 回放光标
├── Root.tsx                  # 合成注册
├── config.ts                 # 全局配置
└── schema.ts                 # Props 类型

scripts/
├── parseBeatmap.ts           # 谱面解析
├── parseReplay.ts            # 回放解析
├── parseStoryboard.ts        # 故事板解析
└── selectFile.ts             # 文件选择
```

---

*文档版本：1.0.0*
*最后更新：2026-05-09*
