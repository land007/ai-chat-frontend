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

