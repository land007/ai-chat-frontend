const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/components': path.resolve(__dirname, 'src/components'),
      '@/services': path.resolve(__dirname, 'src/services'),
      '@/types': path.resolve(__dirname, 'src/types'),
      '@/utils': path.resolve(__dirname, 'src/utils'),
      '@/locales': path.resolve(__dirname, 'src/locales'),
    },
    configure: (webpackConfig) => {
      // 优化代码分割配置
      webpackConfig.optimization = {
        ...webpackConfig.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // 默认vendor chunk
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
            // React核心库
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
              name: 'react-vendor',
              priority: 30,
              reuseExistingChunk: true,
            },
            // Three.js相关库
            three: {
              test: /[\\/]node_modules[\\/](three|@react-three[\\/])[\\/]/,
              name: 'three-vendor',
              priority: 25,
              reuseExistingChunk: true,
            },
            // PDF.js相关库
            pdfjs: {
              test: /[\\/]node_modules[\\/](pdfjs-dist|react-pdf)[\\/]/,
              name: 'pdfjs-vendor',
              priority: 25,
              reuseExistingChunk: true,
            },
            // Leaflet地图库
            leaflet: {
              test: /[\\/]node_modules[\\/](leaflet|react-leaflet)[\\/]/,
              name: 'leaflet-vendor',
              priority: 25,
              reuseExistingChunk: true,
            },
            // Ant Design Plots图表库
            charts: {
              test: /[\\/]node_modules[\\/]@ant-design[\\/]plots[\\/]/,
              name: 'charts-vendor',
              priority: 25,
              reuseExistingChunk: true,
            },
            // highlight.js 单独拆分
            highlight: {
              test: /[\\/]node_modules[\\/]highlight\.js[\\/]/,
              name: 'highlight-vendor',
              priority: 30,
              reuseExistingChunk: true,
            },
            // katex 单独拆分
            katex: {
              test: /[\\/]node_modules[\\/]katex[\\/]/,
              name: 'katex-vendor',
              priority: 30,
              reuseExistingChunk: true,
            },
            // mermaid 单独拆分（已经懒加载）
            mermaid: {
              test: /[\\/]node_modules[\\/]mermaid[\\/]/,
              name: 'mermaid-vendor',
              priority: 28,
              reuseExistingChunk: true,
            },
            // Markdown相关库（react-markdown及其插件）
            markdown: {
              test: /[\\/]node_modules[\\/](react-markdown|remark-|rehype-)[\\/]/,
              name: 'markdown-vendor',
              priority: 28,
              reuseExistingChunk: true,
            },
            // i18next 相关库（保持同步加载，因为需要立即使用）
            i18n: {
              test: /[\\/]node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/,
              name: 'i18n-vendor',
              priority: 26,
              reuseExistingChunk: true,
            },
            // 其他工具库（剩余的小型工具库）
            // 注意：这个规则会匹配所有 node_modules，但由于优先级较低，
            // 只有没有被其他高优先级规则匹配的库才会进入这里
            utils: {
              test: /[\\/]node_modules[\\/]/,
              name: 'utils-vendor',
              priority: 15,
              reuseExistingChunk: true,
            },
            // 其他vendor
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendor',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
      return webpackConfig;
    },
  },
};
