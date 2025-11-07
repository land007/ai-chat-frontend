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
            // 工具库（highlight.js, katex等）
            utils: {
              test: /[\\/]node_modules[\\/](highlight\.js|katex|mermaid)[\\/]/,
              name: 'utils-vendor',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Markdown相关库
            markdown: {
              test: /[\\/]node_modules[\\/](react-markdown|remark-|rehype-)[\\/]/,
              name: 'markdown-vendor',
              priority: 20,
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
