# PC端语音识别显示状态优化流程图

**重要说明**：本文档仅针对PC端优化，手机端逻辑保持不变，无问题。

## 当前流程（存在问题 - 仅PC端）

```mermaid
flowchart TD
    A[PC端用户点击输入框] --> B[开始录音 isRecording=true]
    B --> C[显示波形区域]
    C --> D[实时显示识别文本]
    D --> E[用户松开鼠标]
    E --> F[stopRecording调用]
    F --> G[setIsRecording=false]
    G --> H[波形区域消失]
    H --> I{检查isRecognizing}
    I -->|isRecognizing=true<br/>无文本| J[显示占位符: 正在识别...]
    I -->|isRecognizing=false| K[显示占位符: 输入您的问题]
    J --> L[快速切换]
    L --> K
    K --> M[用户困惑: 为什么变成输入框了?]
    M --> N[等待服务器返回结果]
    N --> O[onComplete回调]
    O --> P[setIsRecognizing=false]
    P --> Q[显示最终识别结果或保持输入框]
    
    style H fill:#ffcccc
    style L fill:#ffcccc
    style M fill:#ffcccc
    style K fill:#ffcccc
```

**问题点：**
- ❌ 松手后波形区域立即消失
- ❌ 占位符从"正在识别..."快速切换到"输入您的问题"
- ❌ 状态切换不清晰，用户感到困惑
- ❌ 识别中不应该显示"输入您的问题"，因为用户并没有输入

## 优化后的流程（仅PC端）

```mermaid
flowchart TD
    A[PC端用户点击输入框] --> B[开始录音 isRecording=true]
    B --> C[显示波形区域]
    C --> D[实时显示识别文本]
    D --> E[用户松开鼠标]
    E --> F[stopRecording调用]
    F --> G[setIsRecording=false]
    G --> H{检查是否有识别文本}
    H -->|有文本| I[立即显示文本在输入框]
    H -->|无文本| J[保持isRecognizing=true]
    I --> K[保持isRecognizing=true]
    J --> L[显示占位符: 正在识别...]
    K --> M[显示文本+保持识别状态]
    L --> N[等待服务器返回结果]
    M --> N
    N --> O[服务器返回最终识别结果]
    O --> P[onComplete回调]
    P --> Q[更新文本或保持状态]
    Q --> R[setIsRecognizing=false]
    R --> S{检查是否有文本}
    S -->|有文本| T[显示最终识别结果]
    S -->|无文本| U[显示占位符: 点击说话,自动结束]
    
    style I fill:#ccffcc
    style K fill:#ccffcc
    style L fill:#ccffcc
    style M fill:#ccffcc
    style T fill:#ccffcc
```

**改善点：**
- ✅ 松手后立即检查是否有识别文本
- ✅ 有文本时立即显示，无等待感
- ✅ 无文本时保持"正在识别..."状态，不切换
- ✅ 识别完成前不会显示"输入您的问题"
- ✅ 状态清晰，用户体验流畅

## 占位符显示逻辑流程图

```mermaid
flowchart TD
    A[判断占位符显示] --> B{inputMode === 'voice'?}
    B -->|否| C[显示默认占位符]
    B -->|是| D{isRecognizing?}
    D -->|是| E{有文本?}
    E -->|是| F[显示文本,不显示占位符]
    E -->|否| G{isRecording?}
    G -->|是| H[显示默认占位符]
    G -->|否| I[显示: 正在识别...]
    D -->|否| J{isRecording?}
    J -->|是| H
    J -->|否| K{shouldShowVoiceButton?}
    K -->|是| L[显示按钮,不显示占位符]
    K -->|否| M{isTouchDevice?}
    M -->|是| N[显示: 按住说话,松开结束]
    M -->|否| O[显示: 点击说话,自动结束]
    
    style I fill:#ccffcc
    style F fill:#ccffcc
    style O fill:#ccffcc
```

## 状态转换图

```mermaid
stateDiagram-v2
    [*] --> 空闲状态: 初始状态
    空闲状态 --> 录音中: PC端点击输入框
    录音中 --> 识别中_有文本: 松手(有文本)
    录音中 --> 识别中_无文本: 松手(无文本)
    识别中_有文本 --> 识别完成_有文本: 收到最终结果
    识别中_无文本 --> 识别完成_有文本: 收到最终结果
    识别中_无文本 --> 识别完成_无文本: 收到最终结果(空)
    识别完成_有文本 --> 空闲状态: 用户操作
    识别完成_无文本 --> 空闲状态: 用户操作
    
    note right of 录音中
        显示波形区域
        实时显示识别文本
        占位符: 默认
    end note
    
    note right of 识别中_有文本
        显示输入框+文本
        占位符: 无(显示文本)
        保持isRecognizing=true
    end note
    
    note right of 识别中_无文本
        显示输入框
        占位符: "正在识别..."
        保持isRecognizing=true
        不显示"输入您的问题"
    end note
    
    note right of 识别完成_有文本
        显示最终识别结果
        占位符: 无(显示文本)
        isRecognizing=false
    end note
    
    note right of 识别完成_无文本
        显示输入框
        占位符: "点击说话,自动结束"
        isRecognizing=false
    end note
```

## 关键状态判断逻辑

### 1. isRecognizingWithoutText 判断

```mermaid
flowchart LR
    A[isRecognizingWithoutText] --> B{isRecognizing?}
    B -->|否| C[false]
    B -->|是| D{displayValue为空?}
    D -->|否| C
    D -->|是| E{isRecording?}
    E -->|是| C
    E -->|否| F[true]
    
    style F fill:#ccffcc
```

### 2. 占位符优先级判断

```mermaid
flowchart TD
    A[开始判断] --> B{isRecognizingWithoutText<br/>且PC端?}
    B -->|是| C["显示: 正在识别..."]
    B -->|否| D{识别完成<br/>且无文本<br/>且PC端?}
    D -->|是| E["显示: 点击说话,自动结束"]
    D -->|否| F[显示默认占位符]
    
    style C fill:#ccffcc
    style E fill:#ccffcc
```

## 优化前后对比

### 当前体验（有问题）

| 时间点 | 状态 | 显示内容 | 用户感受 |
|--------|------|----------|----------|
| 点击输入框 | 录音中 | 波形区域 + 实时文本 | ✅ 正常 |
| 松开鼠标 | 识别中 | 输入框 + "正在识别..." | ✅ 正常 |
| 0.5秒后 | 识别中 | 输入框 + "输入您的问题" | ❌ 困惑：为什么变了？ |
| 1-2秒后 | 识别完成 | 输入框 + 识别结果 | ✅ 正常 |

### 优化后体验

| 时间点 | 状态 | 显示内容 | 用户感受 |
|--------|------|----------|----------|
| 点击输入框 | 录音中 | 波形区域 + 实时文本 | ✅ 正常 |
| 松开鼠标(有文本) | 识别中 | 输入框 + 识别文本 | ✅ 立即看到结果 |
| 松开鼠标(无文本) | 识别中 | 输入框 + "正在识别..." | ✅ 明确知道在识别 |
| 识别完成 | 识别完成 | 输入框 + 最终结果 | ✅ 正常 |

## 实施要点（仅PC端）

### 1. 占位符逻辑优化（明确区分PC端和移动端）

```typescript
// ✅ 优化后的逻辑（仅PC端）
const isRecognizingWithoutText = isRecognizing && !displayValue && !isRecording;

const displayPlaceholder = 
  // ⚠️ PC端识别中且无文本：始终显示"正在识别..."（关键修复）
  (inputMode === 'voice' && !isTouchDevice() && isRecognizingWithoutText)
    ? '正在识别...'
    // PC端识别完成且无文本：显示"点击说话,自动结束"
    : (inputMode === 'voice' && !isTouchDevice() && !isRecording && !isRecognizing && !shouldShowVoiceButton)
      ? '点击说话，自动结束'
      // ✅ 移动端逻辑（保持不变，无问题）
      : (inputMode === 'voice' && isTouchDevice() && !isRecording && !isRecognizing && !shouldShowVoiceButton)
        ? '按住说话，松开结束'
        // 默认占位符
        : (placeholder || t('ui.inputPlaceholder'));
```

**关键点**：
- 使用 `!isTouchDevice()` 明确标识PC端
- PC端识别中时，优先判断 `isRecognizingWithoutText`，确保显示"正在识别..."
- 移动端逻辑完全保持不变

### 2. 状态保持

- 确保 `isRecognizing` 在识别过程中保持 `true`
- 只有在 `onComplete` 回调中才设置为 `false`
- 避免在 `stopRecording` 中过早设置为 `false`

### 3. 视觉反馈（可选）

- 识别中时，输入框边框可以显示蓝色
- 可以添加微妙的加载动画
- 使用颜色变化表示状态

## 关键改进点总结（仅PC端）

1. **状态连续性**：PC端识别中始终保持"正在识别..."，不切换
2. **明确反馈**：PC端有文本立即显示，无文本明确提示
3. **避免混淆**：PC端识别中不显示"输入您的问题"
4. **用户体验**：PC端流畅的状态转换，无视觉跳跃
5. **移动端**：✅ 保持原有逻辑不变，无问题

## 注意事项

⚠️ **重要**：
- 只修改PC端的占位符显示逻辑
- 使用 `!isTouchDevice()` 明确区分PC端
- 移动端使用 `isTouchDevice()` 保持原有逻辑
- 确保修改不影响手机端的正常功能

