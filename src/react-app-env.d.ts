/// <reference types="react-scripts" />

// 声明 CSS 模块类型，支持动态导入
declare module '*.css' {
  const content: any;
  export default content;
}
