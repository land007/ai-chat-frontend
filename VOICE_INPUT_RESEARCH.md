# 语音输入支持实现方案研究

## 项目背景

- **项目类型**: React + TypeScript 前端 + Express 后端 AI聊天应用
- **已有功能**: TTS（文本转语音）、流式对话响应、SSE支持
- **AI服务**: 阿里云DashScope API
- **技术栈**: React 19, TypeScript, Express, Node.js

---

## 实现方案对比

### 方案1: Web Speech API（浏览器原生）

#### 技术原理
- 使用浏览器内置的 `webkitSpeechRecognition` 或 `SpeechRecognition` API
- 完全前端实现，无需后端支持
- 支持实时语音识别

#### 优点
- ✅ 无需后端开发，实现简单
- ✅ 无需额外服务器资源
- ✅ 实时识别，用户体验好
- ✅ 无需API密钥，零成本
- ✅ 支持多语言（取决于浏览器）

#### 缺点
- ❌ 浏览器兼容性限制（Chrome/Edge支持较好，Firefox不支持）
- ❌ 需要HTTPS环境（localhost除外）
- ❌ 识别准确度依赖浏览器引擎
- ❌ 无法自定义语音识别模型
- ❌ 隐私问题（语音数据可能发送到浏览器厂商服务器）

#### 浏览器支持情况
- Chrome/Edge: ✅ 完全支持
- Safari: ⚠️ 部分支持（需要前缀）
- Firefox: ❌ 不支持

#### 实现复杂度
- **前端**: 中等（需要处理浏览器兼容性）
- **后端**: 无需
- **总体**: ⭐⭐☆☆☆（简单）

---

### 方案2: 后端语音识别服务（文件上传）

#### 技术原理
- 用户录音后，将音频文件上传到后端
- 后端调用语音识别API（如阿里云、百度、讯飞等）
- 返回识别结果

#### 优点
- ✅ 识别准确度高（使用专业语音识别服务）
- ✅ 可自定义识别模型和参数
- ✅ 支持离线识别（使用本地模型）
- ✅ 跨浏览器兼容性好
- ✅ 支持更多音频格式

#### 缺点
- ❌ 需要后端开发
- ❌ 需要API密钥和费用
- ❌ 延迟较高（需要上传+识别）
- ❌ 需要服务器存储临时文件

#### 推荐服务商
1. **阿里云语音识别**（推荐，与项目已使用DashScope一致）
   - 支持实时和离线识别
   - 支持中文、英文等多种语言
   - 价格相对合理

2. **百度语音识别**
   - 识别准确度高
   - 免费额度充足

3. **讯飞语音识别**
   - 中文识别准确度高
   - 支持方言识别

#### 实现复杂度
- **前端**: 中等（需要录音、文件上传）
- **后端**: 中等（需要API集成、文件处理）
- **总体**: ⭐⭐⭐☆☆（中等）

---

### 方案3: 实时流式语音识别（WebRTC + 后端）

#### 技术原理
- 使用WebRTC或WebSocket将音频流实时传输到后端
- 后端实时调用语音识别API
- 实时返回识别结果

#### 优点
- ✅ 实时性好，延迟低
- ✅ 识别准确度高
- ✅ 用户体验最佳（边说边识别）
- ✅ 支持长时间录音

#### 缺点
- ❌ 实现复杂（需要处理音频流、WebSocket）
- ❌ 需要后端开发
- ❌ 需要API密钥和费用
- ❌ 服务器资源消耗较大

#### 实现复杂度
- **前端**: 复杂（需要WebRTC、音频流处理）
- **后端**: 复杂（需要WebSocket、流式处理）
- **总体**: ⭐⭐⭐⭐☆（复杂）

---

## 推荐方案

### 推荐方案：方案1（Web Speech API）+ 方案2（后端服务）混合方案

#### 推荐理由
1. **渐进式增强**: 优先使用Web Speech API（零成本、快速），如果浏览器不支持或需要更高准确度，回退到后端服务
2. **用户体验**: 支持实时识别，同时提供高准确度选项
3. **成本控制**: 大部分用户使用免费的Web Speech API，只有需要高准确度时才使用付费服务

#### 实现策略
1. **检测浏览器支持**: 优先尝试Web Speech API
2. **降级处理**: 如果不支持或用户选择，使用后端语音识别服务
3. **用户选择**: 提供设置选项，让用户选择使用哪种方式

---

## 详细实现方案

### 方案1实现：Web Speech API

#### 前端实现步骤

1. **创建语音识别Hook**
```typescript
// src/hooks/useSpeechRecognition.ts
import { useState, useEffect, useRef } from 'react';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition?: {
      new (): SpeechRecognition;
    };
  }
}

export const useSpeechRecognition = (options?: {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // 检测浏览器支持
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('浏览器不支持语音识别');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = options?.continuous ?? true;
    recognition.interimResults = options?.interimResults ?? true;
    recognition.lang = options?.lang || 'zh-CN';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(prev => prev + finalTranscript);
      setInterimTranscript(interimTranscript);
    };

    recognition.onerror = (event) => {
      setError(`语音识别错误: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [options]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setInterimTranscript('');
      setError(null);
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    isSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  };
};
```

2. **创建语音输入组件**
```typescript
// src/components/VoiceInput.tsx
import React from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  lang?: string;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscript,
  onError,
  lang = 'zh-CN'
}) => {
  const {
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    isSupported
  } = useSpeechRecognition({ lang });

  React.useEffect(() => {
    if (transcript) {
      onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  React.useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  if (!isSupported) {
    return (
      <div className="voice-input-error">
        浏览器不支持语音识别功能
      </div>
    );
  }

  return (
    <div className="voice-input">
      <button
        onClick={isListening ? stopListening : startListening}
        className={`voice-button ${isListening ? 'listening' : ''}`}
      >
        {isListening ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Mic />
        )}
      </button>
      {(transcript || interimTranscript) && (
        <div className="transcript-preview">
          {transcript}
          <span className="interim">{interimTranscript}</span>
        </div>
      )}
    </div>
  );
};
```

3. **集成到ChatInterface**
```typescript
// 在ChatInterface.tsx中添加
import { VoiceInput } from './VoiceInput';

// 在输入区域添加语音输入按钮
<div style={getStyles().inputArea}>
  <div style={getStyles().inputContainer}>
    <VoiceInput
      onTranscript={(text) => {
        setInputValue(text);
      }}
      onError={(error) => {
        console.error('语音识别错误:', error);
      }}
    />
    <textarea ... />
    <button ... />
  </div>
</div>
```

---

### 方案2实现：后端语音识别服务

#### 后端实现步骤

1. **添加语音识别API端点**
```typescript
// server.ts 中添加
import multer from 'multer';
import FormData from 'form-data';
import fs from 'fs';

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 语音识别端点
app.post('/api/speech-to-text', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '未上传音频文件', code: 'NO_FILE' });
      return;
    }

    // 调用阿里云语音识别API
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(req.file.path));
    formData.append('format', 'wav'); // 或根据实际格式调整
    formData.append('sample_rate', '16000');

    const response = await axios.post(
      'https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${config.DASHSCOPE_API_KEY}`,
          ...formData.getHeaders()
        }
      }
    );

    // 清理临时文件
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      text: response.data.result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: '语音识别失败',
      code: 'RECOGNITION_ERROR'
    });
  }
});
```

2. **前端录音功能**
```typescript
// src/services/audioRecorder.ts
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.stream = stream;
      
      const options = {
        mimeType: 'audio/webm;codecs=opus' as const,
        audioBitsPerSecond: 128000
      };

      this.mediaRecorder = new MediaRecorder(stream, options);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
    } catch (error) {
      throw new Error('无法访问麦克风');
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('录音未开始'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
      
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
    });
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.audioChunks = [];
  }
}
```

3. **前端上传和识别**
```typescript
// src/services/speechToText.ts
import { AudioRecorder } from './audioRecorder';

export class SpeechToTextService {
  private recorder = new AudioRecorder();

  async recordAndRecognize(): Promise<string> {
    try {
      // 开始录音
      await this.recorder.startRecording();

      // 等待用户停止录音（这里需要UI交互）
      // 实际使用时，应该在组件中调用stopRecording
      
    } catch (error) {
      throw error;
    }
  }

  async recognizeAudio(audioBlob: Blob): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('语音识别失败');
      }

      const data = await response.json();
      return data.text;
    } catch (error) {
      throw error;
    }
  }

  async stopRecording(): Promise<Blob> {
    return await this.recorder.stopRecording();
  }

  cancelRecording(): void {
    this.recorder.cancelRecording();
  }
}
```

---

## 技术选型建议

### 优先级排序

1. **首选**: Web Speech API（方案1）
   - 理由: 零成本、快速实现、用户体验好
   - 适用: 大多数用户场景

2. **备选**: 后端语音识别服务（方案2）
   - 理由: 高准确度、跨浏览器兼容
   - 适用: 需要高准确度或浏览器不支持时

3. **高级**: 实时流式识别（方案3）
   - 理由: 最佳用户体验
   - 适用: 未来优化时考虑

### 实现顺序

1. **第一阶段**: 实现Web Speech API支持
   - 开发时间: 1-2天
   - 测试时间: 1天

2. **第二阶段**: 添加后端语音识别服务
   - 开发时间: 2-3天
   - 测试时间: 1-2天

3. **第三阶段**: 优化和混合方案
   - 开发时间: 1-2天
   - 测试时间: 1天

---

## 依赖项

### 方案1（Web Speech API）
- 无需额外依赖

### 方案2（后端服务）
- `multer`: 文件上传处理
- `form-data`: FormData处理
- `@types/multer`: TypeScript类型定义

```bash
npm install multer form-data
npm install --save-dev @types/multer
```

---

## 注意事项

1. **HTTPS要求**: Web Speech API需要HTTPS环境（localhost除外）
2. **权限请求**: 需要用户授权麦克风权限
3. **浏览器兼容性**: 需要检测浏览器支持情况
4. **错误处理**: 需要完善的错误处理和用户提示
5. **隐私保护**: 语音数据需要妥善处理，避免泄露
6. **音频格式**: 后端服务需要支持多种音频格式转换

---

## 测试建议

1. **功能测试**
   - 测试不同浏览器的兼容性
   - 测试不同语言的识别准确度
   - 测试长时间录音的稳定性

2. **性能测试**
   - 测试录音文件大小限制
   - 测试网络延迟对识别的影响
   - 测试并发请求的处理能力

3. **用户体验测试**
   - 测试UI交互流程
   - 测试错误提示的友好性
   - 测试降级方案的用户体验

---

## 总结

推荐采用**渐进式增强**的混合方案：
1. 优先使用Web Speech API（零成本、快速）
2. 提供后端服务作为备选（高准确度、兼容性）
3. 根据用户需求和浏览器支持情况自动选择

这样可以在保证用户体验的同时，控制开发成本和服务器资源消耗。
