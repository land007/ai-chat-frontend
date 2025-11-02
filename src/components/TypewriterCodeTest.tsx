import React, { useState } from 'react';
import TypewriterEffect from './TypewriterEffect';

interface TestCase {
  name: string;
  category: string;
  content: string;
}

const TypewriterCodeTest: React.FC = () => {
  const [testCase, setTestCase] = useState<string>('javascript-basic');
  const [enabled, setEnabled] = useState(true);
  const [speed, setSpeed] = useState(10);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [key, setKey] = useState(0); // 用于强制重置组件

  // 测试用例集合
  const testCases: Record<string, TestCase> = {
    'javascript-basic': {
      name: 'JavaScript 基础',
      category: '编程语言',
      content: `## JavaScript 函数示例

这是一个简单的 JavaScript 函数：

\`\`\`javascript
function greet(name) {
  const message = \`Hello, \\\${name}!\`;
  console.log(message);
  return message;
}

const result = greet('TypewriterEffect');
\`\`\`

**说明**：包含模板字符串、箭头函数和常量声明。`
    },
    'python-advanced': {
      name: 'Python 高级特性',
      category: '编程语言',
      content: `## Python 装饰器与上下文管理器

\`\`\`python
from functools import wraps
from contextlib import contextmanager

def log_execution(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        print(f"执行函数: {func.__name__}")
        result = func(*args, **kwargs)
        print(f"函数 {func.__name__} 执行完成")
        return result
    return wrapper

@log_execution
def process_data(data):
    return sorted(data, reverse=True)

@contextmanager
def database_connection():
    print("建立数据库连接")
    yield "connection_obj"
    print("关闭数据库连接")

# 使用示例
with database_connection() as conn:
    numbers = process_data([3, 1, 4, 1, 5, 9])
    print(f"处理结果: {numbers}")
\`\`\`

**说明**：演示装饰器、上下文管理器和内置函数的使用。`
    },
    'java-oop': {
      name: 'Java 面向对象',
      category: '编程语言',
      content: `## Java 接口与多态

\`\`\`java
public interface Drawable {
    void draw();
    default void highlight() {
        System.out.println("高亮显示");
    }
}

public class Circle implements Drawable {
    private double radius;
    
    public Circle(double radius) {
        this.radius = radius;
    }
    
    @Override
    public void draw() {
        System.out.println("绘制半径为 " + radius + " 的圆形");
    }
}

public class Rectangle implements Drawable {
    private double width;
    private double height;
    
    public Rectangle(double width, double height) {
        this.width = width;
        this.height = height;
    }
    
    @Override
    public void draw() {
        System.out.println("绘制 " + width + "x" + height + " 的矩形");
    }
}

// 使用多态
Drawable circle = new Circle(5.0);
Drawable rect = new Rectangle(10.0, 8.0);

circle.draw();
rect.draw();
\`\`\`

**说明**：接口定义、实现类和多态应用。`
    },
    'go-concurrency': {
      name: 'Go 并发编程',
      category: '编程语言',
      content: `## Go 协程与通道

\`\`\`go
package main

import (
    "fmt"
    "time"
)

func worker(id int, jobs <-chan int, results chan<- int) {
    for j := range jobs {
        fmt.Printf("Worker %d 开始处理任务 %d\\n", id, j)
        time.Sleep(time.Second)
        results <- j * 2
    }
}

func main() {
    jobs := make(chan int, 5)
    results := make(chan int, 5)
    
    // 启动 3 个 worker
    for w := 1; w <= 3; w++ {
        go worker(w, jobs, results)
    }
    
    // 发送任务
    for j := 1; j <= 5; j++ {
        jobs <- j
    }
    close(jobs)
    
    // 收集结果
    for a := 1; a <= 5; a++ {
        <-results
    }
}
\`\`\`

**说明**：协程、通道和并发任务处理的实现。`
    },
    'rust-ownership': {
      name: 'Rust 所有权',
      category: '编程语言',
      content: `## Rust 所有权系统

\`\`\`rust
fn main() {
    let s1 = String::from("Hello");
    
    // s1 被移动，不能再使用
    let s2 = takes_ownership(s1);
    // println!("{}", s1); // 编译错误！
    
    let x = 5;
    makes_copy(x); // 拷贝值，x 仍可使用
    println!("x is still: {}", x);
    
    // 借用引用
    let s3 = String::from("world");
    let len = calculate_length(&s3);
    println!("The length of '{}' is {}.", s3, len);
}

fn takes_ownership(some_string: String) -> String {
    println!("{}", some_string);
    some_string // 返回所有权
}

fn makes_copy(some_integer: i32) {
    println!("{}", some_integer);
}

fn calculate_length(s: &String) -> usize {
    s.len()
}
\`\`\`

**说明**：所有权、借用和生命周期的核心概念。`
    },
    'cpp-stl': {
      name: 'C++ STL 容器',
      category: '编程语言',
      content: `## C++ STL 容器使用

\`\`\`cpp
#include <iostream>
#include <vector>
#include <map>
#include <algorithm>

int main() {
    // Vector 容器
    std::vector<int> vec = {3, 1, 4, 1, 5, 9, 2, 6};
    
    // 排序
    std::sort(vec.begin(), vec.end());
    
    // 查找
    auto it = std::find(vec.begin(), vec.end(), 5);
    if (it != vec.end()) {
        std::cout << "找到元素: " << *it << std::endl;
    }
    
    // Map 容器
    std::map<std::string, int> scores;
    scores["Alice"] = 95;
    scores["Bob"] = 87;
    scores["Charlie"] = 92;
    
    // 遍历
    for (const auto& pair : scores) {
        std::cout << pair.first << ": " << pair.second << std::endl;
    }
    
    return 0;
}
\`\`\`

**说明**：STL 容器、算法和迭代器的使用。`
    },
    'typescript-generic': {
      name: 'TypeScript 泛型',
      category: '编程语言',
      content: `## TypeScript 泛型编程

\`\`\`typescript
// 泛型接口
interface Repository<T> {
  findById(id: string): T | undefined;
  save(entity: T): void;
  findAll(): T[];
}

// 泛型类
class ArrayRepository<T> implements Repository<T> {
  private items: T[] = [];
  
  findById(id: string): T | undefined {
    const index = parseInt(id);
    return this.items[index];
  }
  
  save(entity: T): void {
    this.items.push(entity);
  }
  
  findAll(): T[] {
    return [...this.items];
  }
}

// 泛型函数
function identity<T>(arg: T): T {
  return arg;
}

function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// 使用示例
const repo = new ArrayRepository<string>();
repo.save("Hello");
repo.save("World");

const strings = repo.findAll();
console.log(strings);

const num = identity<number>(42);
const name = identity("TypeScript");
\`\`\`

**说明**：泛型接口、类和函数的定义和使用。`
    },
    'sql-advanced': {
      name: 'SQL 高级查询',
      category: '编程语言',
      content: `## SQL 复杂查询

\`\`\`sql
-- 窗口函数示例
SELECT 
    employee_id,
    name,
    department,
    salary,
    AVG(salary) OVER (PARTITION BY department) as avg_dept_salary,
    RANK() OVER (PARTITION BY department ORDER BY salary DESC) as salary_rank,
    LAG(salary, 1) OVER (PARTITION BY department ORDER BY salary) as prev_salary
FROM employees;

-- CTE 递归查询
WITH RECURSIVE org_hierarchy AS (
    -- 锚点查询
    SELECT id, name, manager_id, 0 as level
    FROM employees
    WHERE manager_id IS NULL
    
    UNION ALL
    
    -- 递归查询
    SELECT e.id, e.name, e.manager_id, oh.level + 1
    FROM employees e
    INNER JOIN org_hierarchy oh ON e.manager_id = oh.id
)
SELECT * FROM org_hierarchy
ORDER BY level, name;

-- 条件聚合
SELECT 
    department,
    COUNT(*) as total_employees,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
    AVG(CASE WHEN status = 'active' THEN salary ELSE NULL END) as avg_active_salary
FROM employees
GROUP BY department;
\`\`\`

**说明**：窗口函数、CTE 递归和条件聚合的高级用法。`
    },
    'shell-script': {
      name: 'Shell 脚本',
      category: '编程语言',
      content: `## Shell 脚本编程

\`\`\`bash
#!/bin/bash

# 函数定义
process_file() {
    local file=$1
    if [[ ! -f "$file" ]]; then
        echo "错误: 文件 $file 不存在"
        return 1
    fi
    
    local count=$(wc -l < "$file")
    echo "文件 $file 共有 $count 行"
    
    # 查找特定内容
    if grep -q "ERROR" "$file"; then
        echo "文件包含错误日志"
        grep "ERROR" "$file" >> errors.log
    fi
}

# 数组处理
files=("app.log" "server.log" "access.log")

# 遍历数组
for file in "\${files[@]}"; do
    echo "处理文件: $file"
    process_file "$file"
done

# 使用 case 语句
read -p "选择操作 (start|stop|restart): " action

case $action in
    start)
        echo "启动服务..."
        ;;
    stop)
        echo "停止服务..."
        ;;
    restart)
        echo "重启服务..."
        ;;
    *)
        echo "无效操作"
        exit 1
        ;;
esac
\`\`\`

**说明**：函数、数组、条件判断和循环的 Shell 脚本实践。`
    },
    'html-css-demo': {
      name: 'HTML/CSS 响应式',
      category: '编程语言',
      content: `## 响应式 CSS 布局

\`\`\`html
<!DOCTYPE html>
<html lang="zh">
<head>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        .container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 20px;
        }
        
        .card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 10px;
            padding: 20px;
            color: white;
            transition: transform 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
        }
        
        @media (max-width: 768px) {
            .container {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">卡片 1</div>
        <div class="card">卡片 2</div>
        <div class="card">卡片 3</div>
    </div>
</body>
</html>
\`\`\`

**说明**：Grid 布局、渐变和响应式设计。`
    },
    'markdown-mixed': {
      name: 'Markdown 组合',
      category: 'Markdown特性',
      content: `## 代码块与 Markdown 组合

### 使用示例

以下是一个完整的响应式组件示例：

\`\`\`typescript
import React, { useState } from 'react';

export const Counter: React.FC = () => {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>当前计数: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        增加
      </button>
    </div>
  );
};
\`\`\`

### 性能对比

| 方案 | 渲染时间 | 内存占用 | 推荐度 |
|------|---------|---------|--------|
| React.memo | 10ms | 低 | ⭐⭐⭐⭐⭐ |
| useMemo | 15ms | 中 | ⭐⭐⭐⭐ |
| 普通组件 | 25ms | 高 | ⭐⭐ |

### 注意事项

> **重要提示**：在生产环境中使用这些优化时，应该进行充分的性能测试和监控。

### 实施步骤

1. **安装依赖**
   \`\`\`bash
   npm install react react-dom
   \`\`\`

2. **创建组件**
   - 复制上述代码
   - 保存为 \`Counter.tsx\`
   
3. **测试验证**
   - 运行单元测试
   - 检查性能指标
   - 进行浏览器兼容性测试

### 其他优化技巧

- 使用 \`React.memo\` 避免不必要的重渲染
- 通过 \`useMemo\` 缓存计算结果
- 合理使用 \`useCallback\` 减少函数重建`
    },
    'mermaid-flowchart': {
      name: 'Mermaid 流程图',
      category: 'Mermaid图表',
      content: `## 流程图示例

这是一个复杂的分支流程图：

\`\`\`mermaid
graph TD
    A[开始] --> B{是否登录?}
    B -->|是| C[加载用户数据]
    B -->|否| D[跳转登录页]
    D --> E[输入账号密码]
    E --> F{验证通过?}
    F -->|是| C
    F -->|否| G[显示错误信息]
    G --> E
    C --> H[获取权限列表]
    H --> I{是否有管理权限?}
    I -->|是| J[显示管理面板]
    I -->|否| K[显示普通面板]
    J --> L[操作完成]
    K --> L
    L --> M[结束]
    
    style A fill:#90EE90
    style M fill:#FFB6C1
    style C fill:#87CEEB
    style J fill:#DDA0DD
    style K fill:#F0E68C
\`\`\`

**说明**：展示用户认证和权限控制的完整流程。`
    },
    'mermaid-sequence': {
      name: 'Mermaid 序列图',
      category: 'Mermaid图表',
      content: `## 序列图示例

API 请求处理的交互流程：

\`\`\`mermaid
sequenceDiagram
    participant User as 用户
    participant UI as 前端界面
    participant API as 后端API
    participant DB as 数据库
    participant Cache as 缓存层

    User->>UI: 发起搜索请求
    UI->>API: POST /api/search
    API->>Cache: 查询缓存
    Cache-->>API: 缓存未命中
    
    API->>DB: SELECT * FROM data
    DB-->>API: 返回查询结果
    API->>Cache: 写入缓存
    Cache-->>API: 缓存成功
    
    API->>API: 数据转换处理
    API-->>UI: 返回 JSON 响应
    UI->>UI: 渲染搜索结果
    UI-->>User: 显示结果列表
    
    Note over User,DB: 全程耗时 < 200ms
    
    alt 缓存命中
        Cache-->>API: 返回缓存数据
        API-->>UI: 快速响应
    end
\`\`\`

**说明**：展示完整的请求-响应周期和缓存机制。`
    },
    'mermaid-class': {
      name: 'Mermaid 类图',
      category: 'Mermaid图表',
      content: `## 类图示例

系统架构设计：

\`\`\`mermaid
classDiagram
    class User {
        +String id
        +String name
        +String email
        +login()
        +logout()
        +updateProfile()
    }
    
    class Order {
        +String orderId
        +Date createTime
        +Double totalAmount
        +status: OrderStatus
        +create()
        +cancel()
        +pay()
    }
    
    class Product {
        +String productId
        +String name
        +Double price
        +Integer stock
        +getDetails()
        +updateStock()
    }
    
    class Payment {
        +String paymentId
        +PaymentMethod method
        +processPayment()
        +refund()
    }
    
    User "1" --> "*" Order : 创建
    Order "*" --> "1" Product : 包含
    Order "1" --> "1" Payment : 关联
    
    class OrderStatus {
        <<enumeration>>
        PENDING
        PAID
        SHIPPED
        DELIVERED
        CANCELLED
    }
    
    class PaymentMethod {
        <<enumeration>>
        CREDIT_CARD
        ALIPAY
        WECHAT_PAY
    }
    
    OrderStatus <|-- Order
    PaymentMethod <|-- Payment
\`\`\`

**说明**：电商系统的核心实体和关系设计。`
    },
    'map-basic': {
      name: '地图基础',
      category: '地图功能',
      content: `## 基础地图示例

这是一个简单的交互式地图：

\`\`\`map
{
  "center": [39.9, 116.4],
  "zoom": 13,
  "markers": [
    {
      "lat": 39.9,
      "lng": 116.4,
      "title": "北京天安门",
      "description": "中华人民共和国首都的象征"
    }
  ]
}
\`\`\`

**说明**：包含中心点、缩放级别和标记点的基本地图。`
    },
    'map-markers': {
      name: '多标记点地图',
      category: '地图功能',
      content: `## 多标记点地图示例

显示多个地点标记的地图：

\`\`\`map
{
  "center": [39.9, 116.4],
  "zoom": 11,
  "markers": [
    {
      "lat": 39.9,
      "lng": 116.4,
      "title": "天安门广场",
      "description": "位于北京市中心"
    },
    {
      "lat": 39.9163,
      "lng": 116.3972,
      "title": "故宫博物院",
      "description": "明清两朝的皇家宫殿"
    },
    {
      "lat": 39.9042,
      "lng": 116.4074,
      "title": "王府井大街",
      "description": "北京著名的商业街"
    }
  ]
}
\`\`\`

**说明**：多个标记点可以帮助用户快速了解地理位置关系。`
    },
    'map-track': {
      name: '轨迹路线地图',
      category: '地图功能',
      content: `## 轨迹路线地图示例

显示路线轨迹的交互式地图：

\`\`\`map
{
  "center": [39.9, 116.4],
  "zoom": 12,
  "markers": [
    {
      "lat": 39.9,
      "lng": 116.4,
      "title": "起点：天安门",
      "description": "行程开始地点"
    },
    {
      "lat": 39.98,
      "lng": 116.35,
      "title": "终点：奥林匹克公园",
      "description": "行程结束地点"
    }
  ],
  "tracks": [
    {
      "points": [
        {"lat": 39.9, "lng": 116.4, "description": "起点"},
        {"lat": 39.92, "lng": 116.38},
        {"lat": 39.94, "lng": 116.37},
        {"lat": 39.96, "lng": 116.36},
        {"lat": 39.98, "lng": 116.35, "description": "终点"}
      ],
      "color": "#3b82f6",
      "weight": 4,
      "opacity": 0.8,
      "title": "从天安门到奥林匹克公园",
      "description": "总距离约 8 公里，预计用时 30 分钟"
    }
  ]
}
\`\`\`

**说明**：点击轨迹路线可以查看详细信息。支持放大缩小和平移操作。`
    },
    'map-complex': {
      name: '复杂地图场景',
      category: '地图功能',
      content: `## 复杂地图场景示例

包含多个标记点和多条轨迹的综合地图：

\`\`\`map
{
  "center": [31.2304, 121.4737],
  "zoom": 12,
  "markers": [
    {
      "lat": 31.2304,
      "lng": 121.4737,
      "title": "外滩",
      "description": "上海著名的观光景点"
    },
    {
      "lat": 31.2231,
      "lng": 121.4755,
      "title": "南京路步行街",
      "description": "上海最繁华的商业街"
    },
    {
      "lat": 31.2408,
      "lng": 121.4998,
      "title": "陆家嘴",
      "description": "上海金融中心"
    }
  ],
  "tracks": [
    {
      "points": [
        {"lat": 31.2304, "lng": 121.4737},
        {"lat": 31.2320, "lng": 121.4750},
        {"lat": 31.2336, "lng": 121.4763},
        {"lat": 31.2352, "lng": 121.4776},
        {"lat": 31.2368, "lng": 121.4789}
      ],
      "color": "#10b981",
      "weight": 3,
      "opacity": 0.7,
      "title": "观光路线1",
      "description": "外滩沿岸步行路线"
    },
    {
      "points": [
        {"lat": 31.2231, "lng": 121.4755},
        {"lat": 31.2260, "lng": 121.4770},
        {"lat": 31.2289, "lng": 121.4785},
        {"lat": 31.2318, "lng": 121.4800},
        {"lat": 31.2347, "lng": 121.4815},
        {"lat": 31.2376, "lng": 121.4830},
        {"lat": 31.2408, "lng": 121.4998}
      ],
      "color": "#ef4444",
      "weight": 4,
      "opacity": 0.8,
      "dashArray": "10, 5",
      "title": "购物路线",
      "description": "从南京路到陆家嘴的购物路线，包含多个购物点"
    }
  ]
}
\`\`\`

**说明**：
- 支持多条轨迹路线显示
- 轨迹可以设置不同颜色和样式
- 虚线轨迹通过 dashArray 属性设置
- 点击标记点和轨迹可以查看详细信息`
    },
    'map-mixed': {
      name: '地图与Markdown混合',
      category: '地图功能',
      content: `## 地图与 Markdown 内容混合

### 城市介绍

上海是中国最大的城市，拥有丰富的历史文化和现代化发展。

### 地图位置

\`\`\`map
{
  "center": [31.2304, 121.4737],
  "zoom": 13,
  "markers": [
    {
      "lat": 31.2304,
      "lng": 121.4737,
      "title": "上海外滩",
      "description": "上海标志性景点，黄浦江畔"
    },
    {
      "lat": 31.2231,
      "lng": 121.4755,
      "title": "南京路",
      "description": "中华商业第一街"
    }
  ],
  "tracks": [
    {
      "points": [
        {"lat": 31.2304, "lng": 121.4737},
        {"lat": 31.2320, "lng": 121.4760},
        {"lat": 31.2340, "lng": 121.4780},
        {"lat": 31.2360, "lng": 121.4800}
      ],
      "color": "#8b5cf6",
      "weight": 3,
      "title": "推荐游览路线"
    }
  ]
}
\`\`\`

### 游览建议

1. **最佳时间**：春季和秋季天气宜人
2. **交通方式**：地铁、公交、出租车都很方便
3. **景点推荐**：外滩、东方明珠、南京路等

### 注意事项

> **提示**：地图支持放大缩小和平移操作，可以更清楚地查看地理位置关系。在移动设备上可以使用手势操作。`
    },
    'audio-basic': {
      name: '音频播放器',
      category: '音视频功能',
      content: `## 音频播放器示例

这是一个音频播放器测试：

\`\`\`audio
https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3
\`\`\`

**说明**：音频播放器支持播放/暂停、进度控制和音量调节。可以使用浏览器原生 controls 进行操作。

### 功能特性

- ✅ 支持多种音频格式（MP3、WAV、OGG等）
- ✅ 自动适配深色模式
- ✅ 响应式设计，支持移动端
- ✅ 错误处理和空URL验证`
    },
    'video-basic': {
      name: '视频播放器',
      category: '音视频功能',
      content: `## 视频播放器示例

这是一个视频播放器测试：

\`\`\`video
https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4
\`\`\`

**说明**：视频播放器支持播放/暂停、进度控制、音量调节和全屏功能。最大高度为600px，保持响应式布局。

### 功能特性

- ✅ 支持多种视频格式（MP4、WebM、OGV等）
- ✅ 自动适配深色模式
- ✅ 响应式设计，自适应宽度
- ✅ 最大高度限制，避免页面过长
- ✅ 错误处理和空URL验证`
    },
    'audio-video-mixed': {
      name: '音视频混合',
      category: '音视频功能',
      content: `## 音视频混合内容示例

### 音频示例

以下是一个音频文件的播放：

\`\`\`audio
https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3
\`\`\`

### 视频示例

以下是一个视频文件的播放：

\`\`\`video
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
\`\`\`

### 使用说明

1. **音频代码块**：使用 \`\`\`audio 代码块，直接传入音频URL
2. **视频代码块**：使用 \`\`\`video 代码块，直接传入视频URL
3. **格式要求**：URL必须完整且可访问

### 代码示例

\`\`\`markdown
\`\`\`audio
https://example.com/audio.mp3
\`\`\`

\`\`\`video
https://example.com/video.mp4
\`\`\`
\`\`\`

### 注意事项

> **重要提示**：
> - 音频和视频文件需要支持跨域访问（CORS）
> - 建议使用HTTPS协议的URL
> - 文件大小会影响加载速度`
    },
    'katex-basic': {
      name: 'KaTeX 基础公式',
      category: 'KaTeX 数学公式',
      content: `## KaTeX 数学公式基础测试

### 行内公式

这是爱因斯坦的质能方程：$E = mc^2$，其中 $E$ 表示能量，$m$ 表示质量，$c$ 表示光速。

### 分数和根号

分数公式：$\\frac{a}{b} + \\frac{c}{d} = \\frac{ad + bc}{bd}$

二次方程的解：$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

### 上标和下标

化学反应式：$H_2SO_4 + 2NaOH \\to Na_2SO_4 + 2H_2O$

数学表达式：$x^2 + y^2 = z^2$ 和 $a^{n-1} + a^{n-2}$

### 希腊字母

常用希腊字母：$\\alpha, \\beta, \\gamma, \\delta, \\theta, \\lambda, \\mu, \\pi, \\sigma, \\phi$

**说明**：测试行内数学公式的基本渲染功能。`
    },
    'katex-advanced': {
      name: 'KaTeX 高级公式',
      category: 'KaTeX 数学公式',
      content: `## KaTeX 高级数学公式测试

### 块级公式

积分公式：

$$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$

傅里叶变换：

$$F(\\omega) = \\int_{-\\infty}^{\\infty} f(t) e^{-i\\omega t} dt$$

### 求和与连乘

求和公式：

$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$

连乘公式：

$$\\prod_{k=1}^{n} k = n!$$

### 矩阵和行列式

3x3 矩阵：

$$
\\begin{pmatrix}
a & b & c \\\\
d & e & f \\\\
g & h & i
\\end{pmatrix}
$$

行列式：

$$
\\begin{vmatrix}
a & b \\\\
c & d
\\end{vmatrix} = ad - bc
$$

**说明**：测试块级数学公式和复杂数学符号的渲染。`
    },
    'katex-mixed': {
      name: 'KaTeX 混合内容',
      category: 'KaTeX 数学公式',
      content: `## KaTeX 与其他内容混合测试

### 数学公式与文本

在物理学中，**牛顿第二定律**表示为：

$$F = ma$$

其中：
- $F$ 是力（牛顿）
- $m$ 是质量（千克）
- $a$ 是加速度（米每秒²）

### 公式与代码块结合

计算圆周率的程序：

\`\`\`python
import math

# 使用莱布尼茨公式近似计算 π
pi = 0
for k in range(100000):
    pi += (-1)**k / (2*k + 1)
pi *= 4

print(f"π ≈ {pi:.10f}")
print(f"误差: {abs(pi - math.pi):.10f}")
\`\`\`

数学公式：$\\pi = \\sum_{k=0}^{\\infty} \\frac{(-1)^k}{2k+1}$

### 多个公式组合

**欧拉恒等式**：

$$e^{i\\pi} + 1 = 0$$

这个公式被称为"数学中最美丽的方程"，因为它将五个最重要的数学常数联系在一起。

**高斯积分**：

$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

**几何级数**：

$$\\sum_{n=0}^{\\infty} ar^n = \\frac{a}{1-r}$$ （当 $|r| < 1$ 时）

**说明**：测试数学公式与文本、代码块等其他内容的混合渲染效果。`
    },
    'katex-streaming': {
      name: 'KaTeX 流式输出',
      category: 'KaTeX 数学公式',
      content: `## KaTeX 流式输出测试

这个测试专门用于验证数学公式在流式输出过程中的显示效果。

### 简单公式流式测试

首先是一个简单的公式：$y = ax + b$

然后是稍复杂的：$\\sin(x) = \\sum_{n=0}^{\\infty} \\frac{(-1)^n x^{2n+1}}{(2n+1)!}$

### 块级公式流式测试

积分：

$$\\int e^x dx = e^x + C$$

微分：

$$\\frac{d}{dx}(x^n) = nx^{n-1}$$

### 复杂公式流式测试

施瓦茨不等式：

$$\\left|\\sum_{i=1}^n x_i y_i\\right|^2 \\leq \\left(\\sum_{i=1}^n x_i^2\\right)\\left(\\sum_{i=1}^n y_i^2\\right)$$

切比雪夫不等式：

$$P(|X - \\mu| \\geq k\\sigma) \\leq \\frac{1}{k^2}$$

**说明**：验证公式在打字机流式输出过程中的平滑渲染，不应该出现闪烁或渲染错误。`
    },
    'katex-edge': {
      name: 'KaTeX 边界情况',
      category: 'KaTeX 数学公式',
      content: `## KaTeX 边界情况测试

### 1. 特殊符号

包含各种特殊符号：
- 无穷大：$\\infty$
- 空集：$\\emptyset$
- 属于：$x \\in \\mathbb{R}$
- 不等于：$a \\neq b$
- 约等于：$\\pi \\approx 3.14159$
- 大于等于：$x \\geq 0$
- 小于等于：$y \\leq 1$

### 2. 多个公式紧邻

紧挨着的公式：
$x = 1$ 和 $y = 2$ 然后 $z = x + y = 3$

### 3. 公式与列表

数学序列：
1. 等差数列：$a_n = a_1 + (n-1)d$
2. 等比数列：$a_n = a_1 \\cdot r^{n-1}$
3. 斐波那契：$F_n = F_{n-1} + F_{n-2}$

### 4. 公式与引用

> 正如爱因斯坦所说，质能等价关系 $E = mc^2$ 揭示了质量与能量的关系。

### 5. 长公式测试

这是非常长的公式，测试换行和滚动：

$\\sum_{i=1}^{n} \\left(\\frac{a_i}{b_i} + \\frac{c_i}{d_i}\\right) = \\sum_{i=1}^{n} \\frac{a_i d_i + b_i c_i}{b_i d_i} = \\prod_{j=1}^{n} \\left(\\sum_{k=1}^{m} x_{jk}\\right)$

**说明**：测试各种边界情况和特殊场景下的公式渲染效果。`
    },
    'edge-cases': {
      name: '边界情况',
      category: '边界测试',
      content: `## 边界情况测试

### 1. 内联代码

这是一个 \`inline code\` 示例，以及 \`另一个code\` 和多行的情况。

### 2. 未指定语言的代码块

\`\`\`
这是一个没有任何语言标识的代码块
应该显示为普通文本格式
包含一些特殊字符: !@#$%^&*()
和数字: 1234567890
\`\`\`

### 3. 嵌套引用的代码

> 这是一个引用块
> 里面包含 \`内联代码\` 和
> 
> \`\`\`python
> def nested_example():
>     print("在引用中的代码块")
> \`\`\`

### 4. 空代码块

\`\`\`javascript
\`\`\`

### 5. 列表中包含代码

1. 第一项：使用 \`code\` 来处理
2. 第二项：
   \`\`\`javascript
   const item2 = "列表中的代码块";
   console.log(item2);
   \`\`\`
3. 第三项：再次使用 \`inline\`

### 6. 特殊字符处理

\`\`\`javascript
// 包含各种特殊字符
const special = "字符串: <>&"'";
const regex = /.*[^a-z0-9]/gi;
const json = {"key": "value", "number": 123};
const template = \`变量: \\\${special}\`;
\`\`\`

### 7. 超长代码行

\`\`\`javascript
const veryLongLine = "这是一个非常长的字符串，应该能够正确显示，即使它超出了正常的屏幕宽度，也不应该破坏布局或者导致显示问题。支持自动换行和水平滚动是很好的体验。".repeat(10);
\`\`\``
    },
    'alert-info': {
      name: '信息提示框',
      category: '警告框',
      content: `## 信息提示框测试

> [!info] 信息提示
> 这是一个信息提示框，用于显示一般性的信息。
> 它使用蓝色主题，适合展示说明、提示或相关信息。

### 多个提示框组合

> [!info] 提示：登录状态
> 您已经成功登录系统。

> [!info] 系统通知
> 新的功能更新已可用，请查看更新日志获取详细信息。

> [!info]
> 只有内容，没有标题的信息提示框。标题会自动使用类型名称。

**说明**：信息提示框使用蓝色主题，适合展示一般性信息。`
    },
    'alert-warning': {
      name: '警告提示框',
      category: '警告框',
      content: `## 警告提示框测试

> [!warning] 注意事项
> 这是一个警告提示框，用于显示需要注意的内容。
> 它使用黄色/橙色主题，适合展示警告、注意事项或潜在问题。

### 使用场景

> [!warning] 数据备份
> 在执行此操作之前，请确保已备份重要数据。

> [!warning] 兼容性提醒
> 此功能仅在最新版本的浏览器中可用。如果遇到问题，请更新您的浏览器。

> [!caution] 另一个警告样式
> 使用 \`caution\` 类型也会显示为警告框。

**说明**：警告提示框使用黄色/橙色主题，适合展示需要用户注意的内容。`
    },
    'alert-success': {
      name: '成功提示框',
      category: '警告框',
      content: `## 成功提示框测试

> [!success] 操作成功
> 这是一个成功提示框，用于显示成功完成的操作。
> 它使用绿色主题，适合展示成功消息、完成状态或确认信息。

### 示例场景

> [!success] 保存成功
> 您的更改已成功保存到数据库。

> [!success] 验证通过
> 所有测试用例已通过验证，代码质量良好。

> [!check] 检查完成
> 使用 \`check\` 类型也会显示为成功提示框。

**说明**：成功提示框使用绿色主题，适合展示操作成功或完成状态。`
    },
    'alert-error': {
      name: '错误提示框',
      category: '警告框',
      content: `## 错误提示框测试

> [!error] 操作失败
> 这是一个错误提示框，用于显示错误信息或失败的操作。
> 它使用红色主题，适合展示错误消息、失败状态或需要立即关注的问题。

### 错误场景

> [!error] 连接失败
> 无法连接到服务器，请检查您的网络连接。

> [!error] 验证失败
> 输入的数据格式不正确，请检查并重新提交。

> [!danger] 危险操作
> 使用 \`danger\` 类型也会显示为错误提示框，适合显示危险或需要立即处理的情况。

**说明**：错误提示框使用红色主题，适合展示错误或需要立即关注的问题。`
    },
    'alert-mixed': {
      name: '混合警告框',
      category: '警告框',
      content: `## 混合警告框测试

### 组合使用

> [!info] 信息提示
> 这是一个信息提示，通常用于说明性内容。

> [!warning] 警告提示
> 这是一个警告提示，需要注意的内容。

> [!success] 成功提示
> 操作已成功完成！

> [!error] 错误提示
> 发生了一个错误，请检查并重试。

### 与其他内容混合

这是一个普通段落，用于测试警告框与常规内容的混合显示效果。

> [!info] 提示：功能说明
> 警告框可以包含 **粗体文本**、*斜体文本* 和 \`内联代码\`。
> 
> 甚至可以包含多段内容。

#### 代码与警告框

\`\`\`javascript
// 代码块中的注释
const message = "代码块与警告框可以同时使用";
\`\`\`

> [!warning] 代码审查提醒
> 在提交代码之前，请确保：
> 1. 所有测试用例通过
> 2. 代码格式符合规范
> 3. 已添加必要的注释

**说明**：测试警告框与其他 Markdown 内容的混合显示效果。`
    },
    'diff-basic': {
      name: '基础差异对比',
      category: '代码差异',
      content: `## 基础差异对比测试

### 简单差异

\`\`\`diff
- const oldCode = "old version";
+ const newCode = "new version";
\`\`\`

### 函数修改

\`\`\`diff
 function greet(name) {
-   return "Hello, " + name;
+   return \`Hello, \${name}!\`;
 }
\`\`\`

### 变量变更

\`\`\`diff
- let count = 0;
+ let count = 1;
  let total = 10;
\`\`\`

**说明**：基础差异对比测试，删除的行显示为红色，添加的行显示为绿色。`
    },
    'diff-complex': {
      name: '复杂差异对比',
      category: '代码差异',
      content: `## 复杂差异对比测试

### 文件修改示例

\`\`\`diff
--- a/src/utils/helpers.js
+++ b/src/utils/helpers.js
@@ -1,5 +1,6 @@
 import { format } from 'date-fns';
+import { validate } from 'validator';
 
 export function formatDate(date) {
-  if (!date) return '';
-  return format(date, 'YYYY-MM-DD');
+  if (!date || !validate.isDate(date)) return '';
+  return format(date, 'yyyy-MM-dd');
 }
\`\`\`

### 类方法修改

\`\`\`diff
 class UserService {
   constructor() {
     this.users = [];
+    this.cache = new Map();
   }
   
   findUser(id) {
-    return this.users.find(u => u.id === id);
+    const cached = this.cache.get(id);
+    if (cached) return cached;
+    
+    const user = this.users.find(u => u.id === id);
+    if (user) this.cache.set(id, user);
+    return user;
   }
+ 
+   clearCache() {
+    this.cache.clear();
+   }
 }
\`\`\`

**说明**：复杂差异对比，包含多个删除和添加的操作，以及上下文行的显示。`
    },
    'diff-mixed': {
      name: '差异与Markdown混合',
      category: '代码差异',
      content: `## 差异对比与 Markdown 混合测试

### 代码审查流程

在代码审查过程中，我们通常会查看代码差异：

\`\`\`diff
- function oldImplementation() {
-   console.log("旧实现");
- }
+ function newImplementation() {
+   console.log("新实现");
+   // 添加了错误处理
+   try {
+     processData();
+   } catch (error) {
+     console.error("处理失败", error);
+   }
+ }
\`\`\`

### 注意事项

> [!warning] 代码变更提醒
> 在查看差异时，请注意：
> - 删除的代码可能包含重要逻辑
> - 新增的代码需要进行充分测试
> - 确保不破坏现有功能

### 测试用例

修改后的代码应该通过以下测试：

1. 单元测试
2. 集成测试
3. 性能测试

\`\`\`diff
 describe('newImplementation', () => {
-  it('should process data', () => {
-    expect(oldImplementation()).toBeUndefined();
+  it('should process data correctly', () => {
+    expect(newImplementation()).not.toThrow();
   });
 });
\`\`\`

**说明**：测试差异对比代码块与其他 Markdown 内容的混合显示效果。`
    },
    'file-basic': {
      name: '基础文件下载',
      category: '文件下载',
      content: `## 基础文件下载测试

### 简单文件下载

\`\`\`file
https://example.com/document.pdf
\`\`\`

### 带文件名的下载

\`\`\`file
https://example.com/report.pdf
文件名：月度报告.pdf
\`\`\`

**说明**：基础文件下载链接测试。只有在打字机完成且流式结束后才会渲染为下载链接。`
    },
    'file-various': {
      name: '多种文件类型',
      category: '文件下载',
      content: `## 多种文件类型测试

### PDF 文档

\`\`\`file
https://example.com/docs/user-guide.pdf
文件名：用户指南.pdf
\`\`\`

### 图片文件

\`\`\`file
https://example.com/images/banner.png
文件名：宣传横幅.png
\`\`\`

### 压缩文件

\`\`\`file
https://example.com/downloads/data.zip
文件名：数据集.zip
\`\`\`

### Excel 表格

\`\`\`file
https://example.com/reports/sales.xlsx
文件名：销售数据.xlsx
\`\`\`

**说明**：测试不同类型的文件下载链接，系统会自动从 URL 中提取文件名（如果未指定）。`
    },
    'file-mixed': {
      name: '文件与Markdown混合',
      category: '文件下载',
      content: `## 文件下载与 Markdown 混合测试

### 文档说明

以下是相关的文档文件，您可以下载查看：

#### 1. 用户手册

\`\`\`file
https://example.com/docs/user-manual.pdf
文件名：用户手册 v2.0.pdf
\`\`\`

> [!info] 提示
> 文件下载链接只有在内容完整显示后才会激活，避免在流式传输过程中意外触发下载。

#### 2. API 文档

\`\`\`file
https://example.com/docs/api-reference.pdf
文件名：API 参考文档.pdf
\`\`\`

### 代码示例

如果您需要查看源代码：

\`\`\`typescript
// 文件下载处理逻辑
const handleDownload = (url: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = 'file.pdf';
  link.click();
};
\`\`\`

### 注意事项

> [!warning] 安全提醒
> 下载文件时请注意：
> - 确保文件来源可信
> - 检查文件类型和大小
> - 使用 HTTPS 协议的链接

**说明**：测试文件下载链接与其他 Markdown 内容的混合显示效果。`
    },
    'all-new-features': {
      name: '所有新功能综合',
      category: '综合测试',
      content: `## 所有新功能综合测试

### 警告框示例

> [!info] 信息提示
> 这是一个信息提示框。

> [!warning] 警告提示
> 这是一个警告提示框。

> [!success] 成功提示
> 操作已成功完成！

> [!error] 错误提示
> 发生了一个错误。

### 代码差异对比

\`\`\`diff
- const oldValue = 10;
+ const newValue = 20;
  const result = calculate();
\`\`\`

### 文件下载

\`\`\`file
https://example.com/comprehensive-test.pdf
文件名：综合测试文档.pdf
\`\`\`

### 任务列表

- [x] 已完成的任务1
- [ ] 未完成的任务1
- [x] 已完成的任务2
- [ ] 未完成的任务2

### 混合内容

这是一个包含所有新功能的综合测试场景：

1. **警告框**：使用 \`> [!type] 标题\n> 内容\` 格式
2. **代码差异**：使用 \`\`\`diff 代码块
3. **文件下载**：使用 \`\`\`file 代码块
4. **任务列表**：使用 \`- [x]\` 或 \`- [ ]\` 格式

> [!info] 功能说明
> 所有新功能都支持深色模式，并且与现有的 Markdown 格式完美兼容。

### 综合示例

\`\`\`diff
- console.log("旧版本");
+ console.log("新版本");
+ console.log("支持新功能");
\`\`\`

待办事项：

- [x] 更新代码
- [ ] 编写测试
- [ ] 更新文档

\`\`\`file
https://example.com/new-features-demo.zip
文件名：新功能演示.zip
\`\`\`

**说明**：综合测试所有新功能，验证它们可以同时使用且不会相互干扰。`
    },
    'checklist-basic': {
      name: '基础任务列表',
      category: '任务列表',
      content: `## 基础任务列表测试

### 简单任务列表

- [x] 已完成的任务
- [ ] 未完成的任务
- [x] 另一个已完成的任务
- [ ] 另一个未完成的任务

### 嵌套任务列表

- [x] 第一项已完成
  - [x] 子任务1已完成
  - [ ] 子任务2未完成
- [ ] 第二项未完成
  - [ ] 子任务3未完成
  - [x] 子任务4已完成

**说明**：基础任务列表测试，已完成的任务显示为绿色复选框和删除线。`
    },
    'checklist-mixed': {
      name: '混合任务列表',
      category: '任务列表',
      content: `## 混合任务列表测试

### 任务列表与其他内容混合

这是一个包含任务列表的段落。

- [x] **已完成的重要任务**
- [ ] *未完成的普通任务*
- [x] 包含 \`代码\` 的任务
- [ ] 包含 [链接](https://example.com) 的任务

### 任务列表与警告框

> [!info] 任务提示
> 以下是需要完成的任务：

- [ ] 任务1：完成功能开发
- [x] 任务2：编写单元测试
- [ ] 任务3：更新文档

### 任务列表与代码块

开发步骤：

\`\`\`bash
npm install
npm run build
\`\`\`

待办事项：

- [x] 安装依赖
- [ ] 运行构建
- [ ] 部署应用

**说明**：测试任务列表与其他 Markdown 内容的混合显示效果。`
    },
    'checklist-complex': {
      name: '复杂任务列表',
      category: '任务列表',
      content: `## 复杂任务列表测试

### 项目开发任务

#### 前端开发

- [x] 创建 React 组件结构
- [x] 实现基础 UI 组件
  - [x] 按钮组件
  - [x] 输入框组件
  - [x] 卡片组件
- [ ] 集成状态管理
  - [ ] 配置 Redux
  - [ ] 实现 Action Creators
  - [ ] 编写 Reducers
- [ ] 添加路由功能
- [ ] 优化性能

#### 后端开发

- [x] 设计数据库 schema
- [ ] 实现 API 接口
  - [x] 用户认证接口
  - [ ] 数据查询接口
  - [ ] 数据更新接口
- [ ] 编写单元测试
- [ ] 配置 CI/CD

#### 部署任务

- [ ] 准备生产环境
- [ ] 配置服务器
- [ ] 部署应用
- [ ] 监控和日志

### 进度统计

已完成：8/15 任务（53%）

**说明**：复杂任务列表，包含多级嵌套和大量任务项。`
    },
    'checklist-formatting': {
      name: '格式化任务列表',
      category: '任务列表',
      content: `## 格式化任务列表测试

### 带格式的任务列表

- [x] **粗体文本**的任务
- [ ] *斜体文本*的任务
- [x] ~~删除线文本~~的任务（已完成）
- [ ] \`行内代码\`的任务
- [x] 包含 [链接](https://example.com) 的任务

### 多行任务内容

- [x] 这是一个已完成的多行任务
  包含多行内容，用于测试任务列表的
  多行显示效果。

- [ ] 这是一个未完成的多行任务
  也包含多行内容，用于测试任务列表的
  多行显示效果。

### 任务列表样式

- [x] 已完成任务：绿色复选框 + 删除线
- [ ] 未完成任务：灰色复选框 + 正常文本

**说明**：测试任务列表中各种文本格式的显示效果。`
    },
    'tree-basic': {
      name: '基础文件树',
      category: '文件树',
      content: `## 基础文件树测试

### 简单文件树

\`\`\`tree
root/
  file1.js
  file2.ts
  folder/
    file3.js
    file4.ts
\`\`\`

### 多层嵌套文件树

\`\`\`tree
project/
  src/
    components/
      Button.tsx
      Input.tsx
    utils/
      helpers.ts
      constants.ts
  public/
    index.html
    favicon.ico
  package.json
  README.md
\`\`\`

**说明**：基础文件树测试，显示目录结构和文件层级关系。`
    },
    'tree-complex': {
      name: '复杂文件树',
      category: '文件树',
      content: `## 复杂文件树测试

### 完整项目结构

\`\`\`tree
my-app/
  src/
    components/
      common/
        Button.tsx
        Input.tsx
        Card.tsx
      layout/
        Header.tsx
        Footer.tsx
        Sidebar.tsx
      features/
        dashboard/
          Dashboard.tsx
          Chart.tsx
        settings/
          Settings.tsx
          Profile.tsx
    hooks/
      useAuth.ts
      useTheme.ts
      useApi.ts
    utils/
      api.ts
      format.ts
      validation.ts
    types/
      index.ts
      user.ts
      api.ts
    styles/
      globals.css
      theme.css
    App.tsx
    index.tsx
  public/
    images/
      logo.png
      icon.png
    fonts/
      roboto.woff2
  tests/
    components/
      Button.test.tsx
      Input.test.tsx
    utils/
      format.test.ts
  docs/
    README.md
    CHANGELOG.md
    API.md
  .gitignore
  package.json
  tsconfig.json
  vite.config.ts
\`\`\`

**说明**：复杂文件树测试，展示完整的项目目录结构，包含多层嵌套文件夹。`
    },
    'tree-mixed': {
      name: '混合文件树',
      category: '文件树',
      content: `## 混合文件树测试

### 文件树与其他内容混合

这是一个包含文件树的段落。

\`\`\`tree
config/
  database.yml
  routes.rb
  application.rb
\`\`\`

### 文件树与代码块

项目结构：

\`\`\`tree
src/
  index.js
  App.js
  components/
    Header.js
    Footer.js
\`\`\`

对应的代码：

\`\`\`javascript
// src/index.js
import React from 'react';
import App from './App';

ReactDOM.render(<App />, document.getElementById('root'));
\`\`\`

### 文件树与警告框

> [!info] 项目说明
> 以下是项目的目录结构：

\`\`\`tree
project/
  src/
    main.ts
    app.ts
  dist/
    bundle.js
\`\`\`

**说明**：测试文件树与其他 Markdown 内容的混合显示效果。`
    },
    'tree-formatting': {
      name: '格式化文件树',
      category: '文件树',
      content: `## 格式化文件树测试

### 不同缩进方式

#### 使用空格缩进

\`\`\`tree
root/
  file1.js
  folder/
    file2.js
\`\`\`

#### 使用制表符缩进

\`\`\`tree
root/
\tfile1.js
\tfolder/
\t\tfile2.js
\`\`\`

### 混合格式文件树

\`\`\`tree
project/
  .config/
    .env
    settings.json
  src/
    components/
      Header.tsx
      Footer.tsx
    utils/
      helpers.ts
      types.ts
  public/
    assets/
      images/
        logo.png
      fonts/
        roboto.woff2
  README.md
  package.json
  tsconfig.json
\`\`\`

### 特殊文件命名

\`\`\`tree
project/
  .gitignore
  .env.local
  file-name.js
  file_name.ts
  FileName.tsx
  config-file.json
\`\`\`

**说明**：测试文件树的各种格式和命名方式的显示效果。`
    },
    'merge-basic': {
      name: '基础合并冲突',
      category: '代码差异',
      content: `## 基础合并冲突测试

### 简单合并冲突

\`\`\`merge
<<<<<<< HEAD
const version = "1.0.0";
const author = "Alice";
=======
const version = "2.0.0";
const author = "Bob";
>>>>>>> feature/new-version
\`\`\`

### 多行合并冲突

\`\`\`merge
function calculate(x, y) {
<<<<<<< HEAD
  return x + y;
  console.log("加法");
=======
  return x * y;
  console.log("乘法");
>>>>>>> feature/multiply
}
\`\`\`

**说明**：基础合并冲突测试，当前分支代码显示为红色（删除），要合并的代码显示为绿色（添加）。`
    },
    'merge-complex': {
      name: '复杂合并冲突',
      category: '代码差异',
      content: `## 复杂合并冲突测试

### 多个冲突区域

\`\`\`merge
// 第一个冲突
<<<<<<< HEAD
import { useState } from 'react';
import { useEffect } from 'react';
=======
import { useState, useEffect } from 'react';
>>>>>>> feature/optimize-imports
// 中间代码
const value = 10;

// 第二个冲突
<<<<<<< HEAD
function Component() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    console.log(count);
  }, [count]);
=======
function Component() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);
>>>>>>> feature/update-title
  return <div>{count}</div>;
}
\`\`\`

### 包含注释的冲突

\`\`\`merge
class MyClass {
<<<<<<< HEAD
  // 旧实现
  method() {
    return "old";
  }
=======
  // 新实现
  method() {
    return "new";
  }
>>>>>>> feature/new-implementation
}
\`\`\`

**说明**：复杂合并冲突测试，包含多个冲突区域和注释。`
    },
    'merge-mixed': {
      name: '混合合并冲突',
      category: '代码差异',
      content: `## 混合合并冲突测试

### 合并冲突与普通 diff

#### 普通 diff

\`\`\`diff
- const oldValue = 10;
+ const newValue = 20;
  const result = calculate();
\`\`\`

#### 合并冲突

\`\`\`merge
function process(data) {
<<<<<<< HEAD
  return data.map(item => item.value);
=======
  return data.filter(item => item.active).map(item => item.value);
>>>>>>> feature/filter-active
}
\`\`\`

### 合并冲突与代码块

普通代码：

\`\`\`javascript
// 这是普通代码
const x = 1;
const y = 2;
\`\`\`

合并冲突代码：

\`\`\`merge
<<<<<<< HEAD
const result = x + y;
=======
const result = x * y;
>>>>>>> feature/multiply
\`\`\`

### 合并冲突与警告框

> [!warning] 合并冲突警告
> 检测到以下文件存在合并冲突：

\`\`\`merge
<<<<<<< HEAD
src/components/App.tsx
=======
src/components/Main.tsx
>>>>>>> feature/rename-component
\`\`\`

**说明**：测试合并冲突与其他 Markdown 内容的混合显示效果。`
    },
    'merge-formatting': {
      name: '格式化合并冲突',
      category: '代码差异',
      content: `## 格式化合并冲突测试

### 不同语言的合并冲突

#### JavaScript

\`\`\`merge
<<<<<<< HEAD
const greeting = "Hello";
=======
const greeting = "Hi";
>>>>>>> feature/casual-greeting
console.log(greeting);
\`\`\`

#### Python

\`\`\`merge
def greet(name):
<<<<<<< HEAD
    return f"Hello, {name}!"
=======
    return f"Hi, {name}!"
>>>>>>> feature/casual-greeting
\`\`\`

#### TypeScript

\`\`\`merge
interface User {
<<<<<<< HEAD
  name: string;
  age: number;
=======
  name: string;
  email: string;
  age?: number;
>>>>>>> feature/add-email
}
\`\`\`

### 大块代码冲突

\`\`\`merge
class ApiClient {
<<<<<<< HEAD
  constructor(config) {
    this.baseURL = config.baseURL;
    this.timeout = 5000;
  }
  
  async request(url, options) {
    const response = await fetch(this.baseURL + url, {
      ...options,
      timeout: this.timeout
    });
    return response.json();
  }
=======
  constructor(config) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 10000;
    this.headers = config.headers || {};
  }
  
  async request(url, options) {
    const response = await fetch(this.baseURL + url, {
      ...options,
      headers: {
        ...this.headers,
        ...options?.headers
      },
      timeout: this.timeout
    });
    return response.json();
  }
>>>>>>> feature/improve-api-client
}
\`\`\`

**说明**：测试合并冲突在不同语言和格式下的显示效果。`
    },
    'pdf-basic': {
      name: '基础 PDF 查看',
      category: 'PDF查看器',
      content: `## 基础 PDF 查看测试

### 简单 PDF 文档

\`\`\`pdf
https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
\`\`\`

**说明**：基础 PDF 查看测试，支持缩放、平移、页面导航等功能。`
    },
    'pdf-multi-page': {
      name: '多页 PDF 文档',
      category: 'PDF查看器',
      content: `## 多页 PDF 文档测试

### 带完整内容的 PDF

\`\`\`pdf
https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf
\`\`\`

**说明**：测试多页 PDF 文档的导航和渲染功能。`
    },
    'pdf-mixed': {
      name: '混合 PDF 查看',
      category: 'PDF查看器',
      content: `## 混合 PDF 查看测试

### PDF 与其他内容混合

这是一个包含 PDF 的段落。

\`\`\`pdf
https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
\`\`\`

### PDF 与代码块

查看以下 PDF 文档：

\`\`\`pdf
https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf
\`\`\`

然后查看以下代码：

\`\`\`javascript
// PDF 处理代码
const pdfUrl = 'https://example.com/document.pdf';
fetch(pdfUrl)
  .then(response => response.blob())
  .then(blob => {
    console.log('PDF 加载成功');
  });
\`\`\`

### PDF 与警告框

> [!info] PDF 查看提示
> 以下 PDF 文档支持缩放、平移和页面导航功能：

\`\`\`pdf
https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
\`\`\`

**说明**：测试 PDF 查看器与其他 Markdown 内容的混合显示效果。`
    },
    'pdf-features': {
      name: 'PDF 功能测试',
      category: 'PDF查看器',
      content: `## PDF 功能测试

### 缩放功能

- 使用缩放按钮：点击放大/缩小按钮
- 使用滚轮缩放：按住 Ctrl（Mac: Cmd）+ 滚轮
- 使用手势缩放（移动端）：双指捏合
- 重置缩放：点击重置按钮

\`\`\`pdf
https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf
\`\`\`

### 平移功能

- 拖拽平移（桌面端）：点击并拖拽 PDF
- 触摸滑动（移动端）：单指滑动

### 页面导航

- 使用上一页/下一页按钮
- 显示当前页面和总页数

**说明**：测试 PDF 查看器的所有功能，包括缩放、平移和页面导航。`
    },
    'pdf-mobile': {
      name: '移动端 PDF 测试',
      category: 'PDF查看器',
      content: `## 移动端 PDF 测试

### 移动端适配

以下 PDF 在移动端应该能够正常显示和操作：

\`\`\`pdf
https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
\`\`\`

### 移动端功能

- **触摸滑动**：单指滑动平移 PDF
- **手势缩放**：双指捏合缩放
- **响应式按钮**：控制按钮大小适合触摸操作
- **自适应布局**：根据屏幕宽度自动调整

### 移动端优化

- 按钮大小适合触摸
- 控制栏布局自适应
- PDF 显示区域高度自适应

**说明**：测试 PDF 查看器在移动端的显示和交互效果。`
    },
    'chart-line-basic': {
      name: '折线图趋势分析',
      category: '数据可视化',
      content: `## 折线图：AI 服务请求量趋势

### 近 12 周请求量

\`\`\`chart
{
  "type": "line",
  "data": [
    { "week": "W01", "value": 680 },
    { "week": "W02", "value": 720 },
    { "week": "W03", "value": 835 },
    { "week": "W04", "value": 910 },
    { "week": "W05", "value": 1050 },
    { "week": "W06", "value": 1230 },
    { "week": "W07", "value": 1315 },
    { "week": "W08", "value": 1420 },
    { "week": "W09", "value": 1570 },
    { "week": "W10", "value": 1680 },
    { "week": "W11", "value": 1765 },
    { "week": "W12", "value": 1890 }
  ],
  "xField": "week",
  "yField": "value",
  "smooth": true,
  "point": {
    "size": 4,
    "shape": "circle",
    "style": { "stroke": "#ffffff", "lineWidth": 1 }
  },
  "tooltip": { "showMarkers": true }
}
\`\`\`

**说明**：展示 AI 服务请求量的连续增长趋势。`
    },
    'chart-column-group': {
      name: '分组柱状图',
      category: '数据可视化',
      content: `## 柱状图：模型调用对比

### 行业模型调用量（月度）

\`\`\`chart
{
  "type": "column",
  "data": [
    { "category": "客服问答", "value": 420, "year": "2024" },
    { "category": "智能客服", "value": 360, "year": "2024" },
    { "category": "营销文案", "value": 275, "year": "2024" },
    { "category": "代码助手", "value": 480, "year": "2024" },
    { "category": "客服问答", "value": 540, "year": "2025" },
    { "category": "智能客服", "value": 510, "year": "2025" },
    { "category": "营销文案", "value": 360, "year": "2025" },
    { "category": "代码助手", "value": 640, "year": "2025" }
  ],
  "xField": "category",
  "yField": "value",
  "seriesField": "year",
  "isGroup": true,
  "columnStyle": { "radius": [4, 4, 0, 0] },
  "legend": { "position": "top" }
}
\`\`\`

**说明**：对比不同年份行业模型的调用量变化。`
    },
    'chart-area-stacked': {
      name: '堆叠面积图',
      category: '数据可视化',
      content: `## 面积图：渠道增长贡献

\`\`\`chart
{
  "type": "area",
  "data": [
    { "month": "Jan", "value": 420, "channel": "官网" },
    { "month": "Jan", "value": 180, "channel": "合作伙伴" },
    { "month": "Jan", "value": 120, "channel": "社区" },
    { "month": "Feb", "value": 480, "channel": "官网" },
    { "month": "Feb", "value": 210, "channel": "合作伙伴" },
    { "month": "Feb", "value": 165, "channel": "社区" },
    { "month": "Mar", "value": 530, "channel": "官网" },
    { "month": "Mar", "value": 260, "channel": "合作伙伴" },
    { "month": "Mar", "value": 198, "channel": "社区" },
    { "month": "Apr", "value": 610, "channel": "官网" },
    { "month": "Apr", "value": 305, "channel": "合作伙伴" },
    { "month": "Apr", "value": 232, "channel": "社区" }
  ],
  "xField": "month",
  "yField": "value",
  "seriesField": "channel",
  "isStack": true,
  "areaStyle": { "fillOpacity": 0.85 },
  "smooth": true
}
\`\`\`

**说明**：展示不同渠道对整体增长的贡献占比。`
    },
    'chart-pie-donut': {
      name: '环形图占比',
      category: '数据可视化',
      content: `## 环形图：流量来源结构

\`\`\`chart
{
  "type": "donut",
  "data": [
    { "item": "官网", "value": 0.38 },
    { "item": "API", "value": 0.26 },
    { "item": "生态伙伴", "value": 0.18 },
    { "item": "推广活动", "value": 0.12 },
    { "item": "其它", "value": 0.06 }
  ],
  "angleField": "value",
  "colorField": "item",
  "legend": { "position": "right" },
  "label": {
    "type": "inner",
    "offset": "-30%",
    "style": { "textAlign": "center", "fontSize": 14 },
    "content": "{percentage}"
  },
  "statistic": {
    "title": { "content": "总流量" },
    "content": { "content": "100%" }
  }
}
\`\`\`

**说明**：展示不同来源占总流量的比例。`
    },
    'chart-radar-competency': {
      name: '雷达图对比',
      category: '数据可视化',
      content: `## 雷达图：模型能力谱

\`\`\`chart
{
  "type": "radar",
  "data": [
    { "indicator": "推理能力", "name": "Model-A", "score": 92 },
    { "indicator": "创造力", "name": "Model-A", "score": 78 },
    { "indicator": "多语支持", "name": "Model-A", "score": 82 },
    { "indicator": "代码生成", "name": "Model-A", "score": 88 },
    { "indicator": "安全合规", "name": "Model-A", "score": 94 },
    { "indicator": "推理能力", "name": "Model-B", "score": 85 },
    { "indicator": "创造力", "name": "Model-B", "score": 84 },
    { "indicator": "多语支持", "name": "Model-B", "score": 90 },
    { "indicator": "代码生成", "name": "Model-B", "score": 80 },
    { "indicator": "安全合规", "name": "Model-B", "score": 95 }
  ],
  "xField": "indicator",
  "yField": "score",
  "seriesField": "name",
  "point": { "size": 2 },
  "area": { "style": { "fillOpacity": 0.2 } },
  "yAxis": { "max": 100, "min": 0 }
}
\`\`\`

**说明**：对比两个模型在多个维度的表现差异。`
    },
    'chart-scatter-bubble': {
      name: '散点与气泡',
      category: '数据可视化',
      content: `## 散点图：模型性能取舍

\`\`\`chart
{
  "type": "bubble",
  "data": [
    { "model": "Alpha", "latency": 86, "accuracy": 92, "requests": 38 },
    { "model": "Beta", "latency": 72, "accuracy": 88, "requests": 44 },
    { "model": "Gamma", "latency": 64, "accuracy": 84, "requests": 26 },
    { "model": "Delta", "latency": 58, "accuracy": 79, "requests": 52 },
    { "model": "Sigma", "latency": 95, "accuracy": 96, "requests": 18 }
  ],
  "xField": "latency",
  "yField": "accuracy",
  "sizeField": "requests",
  "colorField": "model",
  "size": [8, 32],
  "shape": "circle",
  "tooltip": {
    "showMarkers": false,
    "fields": ["model", "latency", "accuracy", "requests"]
  },
  "xAxis": { "title": { "text": "延迟 (ms)" } },
  "yAxis": { "title": { "text": "准确率 (%)" }, "min": 70, "max": 100 }
}
\`\`\`

**说明**：展示不同模型在延迟、准确率与请求量之间的平衡。`
    },
    'chart-dual-axes': {
      name: '双轴组合图',
      category: '数据可视化',
      content: `## 双轴图：营收与用户增长

\`\`\`chart
{
  "type": "dual-axes",
  "data": [
    [
      { "month": "Jan", "revenue": 68000 },
      { "month": "Feb", "revenue": 72000 },
      { "month": "Mar", "revenue": 81500 },
      { "month": "Apr", "revenue": 92000 },
      { "month": "May", "revenue": 103500 },
      { "month": "Jun", "revenue": 116200 }
    ],
    [
      { "month": "Jan", "users": 1.8 },
      { "month": "Feb", "users": 2.1 },
      { "month": "Mar", "users": 2.6 },
      { "month": "Apr", "users": 3.0 },
      { "month": "May", "users": 3.6 },
      { "month": "Jun", "users": 4.2 }
    ]
  ],
  "xField": "month",
  "yField": ["revenue", "users"],
  "geometryOptions": [
    {
      "geometry": "column",
      "color": "#5B8FF9",
      "columnWidthRatio": 0.4
    },
    {
      "geometry": "line",
      "smooth": true,
      "color": "#5AD8A6",
      "lineStyle": {
        "lineWidth": 2
      },
      "point": {
        "size": 4,
        "shape": "circle"
      }
    }
  ],
  "yAxis": {
    "revenue": {
      "title": {
        "text": "月度营收 (¥)"
      }
    },
    "users": {
      "title": {
        "text": "新增付费用户 (万)"
      }
    }
  },
  "legend": {
    "position": "top-right"
  }
}
\`\`\`

**说明**：同时观察营收与付费用户新增的趋势。`
    },
    'chart-tiny-metrics': {
      name: '迷你趋势图',
      category: '数据可视化',
      content: `## 迷你图：核心指标快照

### 日活跃用户微趋势

\`\`\`chart
{
  "type": "tiny-line",
  "data": [520, 560, 610, 640, 690, 720, 760],
  "height": 80,
  "smooth": true
}
\`\`\`

### 会话转化率微趋势

\`\`\`chart
{
  "type": "tiny-column",
  "data": [0.21, 0.24, 0.23, 0.27, 0.31, 0.29, 0.33],
  "height": 80
}
\`\`\`

### 平均响应时长微趋势

\`\`\`chart
{
  "type": "tiny-area",
  "data": [2.8, 2.6, 2.4, 2.5, 2.3, 2.1, 1.9],
  "height": 80
}
\`\`\`

**说明**：在少量空间中呈现关键指标的微趋势。`
    },
    'chart-progress-indicator': {
      name: '进度与水位图',
      category: '数据可视化',
      content: `## 仪表盘：SLA 达成率

\`\`\`chart
{
  "type": "gauge",
  "percent": 0.78,
  "range": {
    "ticks": [0, 0.5, 1],
    "color": ["#fca5a5", "#22c55e"]
  },
  "indicator": {
    "pointer": { "style": { "stroke": "#16a34a" } },
    "pin": { "style": { "stroke": "#16a34a" } }
  },
  "innerRadius": 0.7,
  "statistic": {
    "title": { "content": "SLA" },
    "content": { "content": "78%" }
  }
}
\`\`\`

### 水位图：资源使用率

\`\`\`chart
{
  "type": "liquid",
  "percent": 0.63,
  "color": "#06b6d4"
}
\`\`\`

**说明**：快速查看达成率与资源利用率。`
    }
  };

  const currentTest = testCases[testCase];

  // 将测试用例按类别分组
  const categories = Array.from(
    new Set(Object.values(testCases).map(tc => tc.category))
  );

  const handleReset = () => {
    setKey(prev => prev + 1); // 强制重新渲染
    setEnabled(true);
    setSpeed(10);
    setIsStreaming(false);
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
      minHeight: '100vh',
      transition: 'background-color 0.3s'
    }}>
      {/* 控制面板 */}
      <div style={{
        backgroundColor: isDarkMode ? '#2d2d2d' : '#f5f5f5',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`
      }}>
        <h2 style={{ 
          marginTop: 0, 
          marginBottom: '16px',
          color: isDarkMode ? '#fff' : '#333'
        }}>
          打字机代码渲染测试
        </h2>

        {/* 测试场景选择 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px',
            fontWeight: '600',
            color: isDarkMode ? '#ccc' : '#666'
          }}>
            测试场景
          </label>
          {categories.map(category => (
            <div key={category} style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: isDarkMode ? '#888' : '#999',
                marginBottom: '4px',
                textTransform: 'uppercase'
              }}>
                {category}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(testCases)
                  .filter(([_, tc]) => tc.category === category)
                  .map(([key, tc]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setTestCase(key);
                        handleReset();
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: testCase === key 
                          ? '#3b82f6' 
                          : isDarkMode ? '#444' : '#e0e0e0',
                        color: testCase === key ? 'white' : isDarkMode ? '#ccc' : '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {tc.name}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* 参数控制 */}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {/* 打字机开关 */}
          <div>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: isDarkMode ? '#ccc' : '#666'
            }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>打字机效果</span>
            </label>
          </div>

          {/* 速度调节 */}
          <div style={{ flex: '0 0 auto' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: isDarkMode ? '#ccc' : '#666'
            }}>
              <span style={{ fontSize: '13px' }}>速度:</span>
              <input
                type="range"
                min="1"
                max="100"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                style={{ width: '150px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', minWidth: '40px' }}>
                {speed}ms
              </span>
            </label>
          </div>

          {/* 流式传输开关 */}
          <div>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: isDarkMode ? '#ccc' : '#666'
            }}>
              <input
                type="checkbox"
                checked={isStreaming}
                onChange={(e) => setIsStreaming(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>模拟流式传输</span>
            </label>
          </div>

          {/* 主题切换 */}
          <div>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: isDarkMode ? '#ccc' : '#666'
            }}>
              <input
                type="checkbox"
                checked={isDarkMode}
                onChange={(e) => setIsDarkMode(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>暗色主题</span>
            </label>
          </div>

          {/* 重置按钮 */}
          <button
            onClick={handleReset}
            style={{
              padding: '6px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.2s'
            }}
          >
            重置
          </button>
        </div>
      </div>

      {/* 渲染结果区域 */}
      <div style={{
        backgroundColor: isDarkMode ? '#2d2d2d' : '#fafafa',
        padding: '24px',
        borderRadius: '8px',
        border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
        minHeight: '400px'
      }}>
        <div style={{
          marginBottom: '12px',
          fontSize: '14px',
          color: isDarkMode ? '#888' : '#999',
          fontStyle: 'italic'
        }}>
          当前场景: {currentTest.name} | {currentTest.category}
        </div>
        <TypewriterEffect
          key={key}
          text={currentTest.content}
          enabled={enabled}
          speed={speed}
          isStreaming={isStreaming}
          isDarkMode={isDarkMode}
          style={{
            color: isDarkMode ? '#e0e0e0' : '#333',
            lineHeight: '1.6'
          }}
        />
      </div>
    </div>
  );
};

export default TypewriterCodeTest;

