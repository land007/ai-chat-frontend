import React, { useMemo } from 'react';
import {
  Line,
  Area,
  Column,
  Bar,
  Pie,
  Radar,
  Scatter,
  DualAxes,
  Gauge,
  Liquid,
  Tiny,
} from '@ant-design/plots';

type ChartConfig = Record<string, any> & { type?: string };

interface ChartRendererProps {
  /** JSON 字符串或已经解析好的配置对象 */
  config: string | ChartConfig;
  /** 是否暗色模式，用于自动切换主题 */
  isDarkMode?: boolean;
  /** 自定义宽度，默认自适应父容器 */
  width?: string | number;
  /** 自定义高度，默认 420 */
  height?: string | number;
}

const chartComponentMap: Record<string, React.ComponentType<any>> = {
  line: Line,
  area: Area,
  column: Column,
  bar: Bar,
  pie: Pie,
  donut: Pie,
  radar: Radar,
  scatter: Scatter,
  bubble: Scatter,
  dualaxes: DualAxes,
  'dual-axes': DualAxes,
  'dual_axes': DualAxes,
  gauge: Gauge,
  liquid: Liquid,
  'tiny-line': Tiny.Line,
  'tinyline': Tiny.Line,
  'tiny-area': Tiny.Area,
  'tinyarea': Tiny.Area,
  'tiny-column': Tiny.Column,
  'tinycolumn': Tiny.Column,
};

const ChartRenderer: React.FC<ChartRendererProps> = ({
  config,
  isDarkMode = false,
  width = '100%',
  height = 420,
}) => {

  const { parsedConfig, error } = useMemo(() => {
    if (typeof config === 'string') {
      try {
        const parsed = JSON.parse(config) as ChartConfig;
        if (!parsed || typeof parsed !== 'object') {
          return { parsedConfig: null, error: '图表配置必须是对象' };
        }
        return { parsedConfig: parsed, error: null };
      } catch (err) {
        return { parsedConfig: null, error: `图表配置解析失败: ${(err as Error).message}` };
      }
    }
    if (!config || typeof config !== 'object') {
      return { parsedConfig: null, error: '图表配置必须是对象' };
    }
    return { parsedConfig: config as ChartConfig, error: null };
  }, [config]);

  const chartType = useMemo(() => {
    if (!parsedConfig?.type) return '';
    return String(parsedConfig.type).toLowerCase().trim();
  }, [parsedConfig?.type]);

  const ChartComponent = chartType ? chartComponentMap[chartType] : undefined;

  const resolvedConfig = useMemo(() => {
    if (!parsedConfig) return null;
    const baseConfig: ChartConfig = {
      ...parsedConfig,
    };

    // 适配暗色模式主题
    if (isDarkMode) {
      baseConfig.theme = {
        type: 'dark',
        styleSheet: {
          backgroundColor: '#111827',
          brandColor: '#3b82f6',
          paletteQualitative10: ['#93c5fd', '#6ee7b7', '#fbbf24', '#fda4af', '#c4b5fd', '#f97316', '#34d399', '#f472b6', '#a855f7', '#60a5fa'],
          paletteQualitative20: undefined,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      };
    } else {
      baseConfig.theme = {
        type: 'light',
      };
    }

    if (!baseConfig.padding) {
      baseConfig.padding = 'auto';
    }

    // 针对特殊类型提供默认项
    switch (chartType) {
      case 'pie':
        if (typeof baseConfig.radius !== 'number') {
          baseConfig.radius = 1;
        }
        break;
      case 'donut':
        baseConfig.innerRadius = baseConfig.innerRadius ?? 0.6;
        baseConfig.radius = baseConfig.radius ?? 1;
        baseConfig.statistic = baseConfig.statistic ?? { content: { style: { fontSize: 18 } } };
        baseConfig.type = 'pie';
        break;
      case 'tiny-line':
      case 'tinyline':
        baseConfig.height = baseConfig.height ?? 100;
        baseConfig.padding = baseConfig.padding ?? [8, 8, 24, 8];
        baseConfig.smooth = baseConfig.smooth ?? true;
        baseConfig.xAxis = baseConfig.xAxis ?? { line: null, label: null, tickLine: null, grid: null };
        baseConfig.yAxis = baseConfig.yAxis ?? { label: null, tickLine: null, line: null, grid: null };
        break;
      case 'tiny-area':
      case 'tinyarea':
        baseConfig.height = baseConfig.height ?? 100;
        baseConfig.padding = baseConfig.padding ?? [8, 8, 24, 8];
        baseConfig.xAxis = baseConfig.xAxis ?? { line: null, label: null, tickLine: null, grid: null };
        baseConfig.yAxis = baseConfig.yAxis ?? { label: null, tickLine: null, line: null, grid: null };
        baseConfig.autoFit = true;
        break;
      case 'tiny-column':
      case 'tinycolumn':
        baseConfig.height = baseConfig.height ?? 100;
        baseConfig.padding = baseConfig.padding ?? [8, 8, 24, 8];
        baseConfig.columnStyle = baseConfig.columnStyle ?? { radius: [2, 2, 0, 0] };
        baseConfig.xAxis = baseConfig.xAxis ?? { line: null, label: null, tickLine: null, grid: null };
        baseConfig.yAxis = baseConfig.yAxis ?? { label: null, tickLine: null, line: null, grid: null };
        baseConfig.autoFit = true;
        break;
      case 'scatter':
      case 'bubble':
        baseConfig.shape = baseConfig.shape ?? 'circle';
        break;
      default:
        break;
    }

    // 统一宽高设置
    baseConfig.autoFit = baseConfig.autoFit ?? true;
    baseConfig.height = baseConfig.height ?? height;

    const { type: _unusedType, ...finalConfig } = baseConfig;

    return finalConfig;
  }, [parsedConfig, chartType, isDarkMode, height]);

  if (error) {
    return (
      <div
        style={{
          margin: '16px 0',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: isDarkMode ? '#2d1f1f' : '#fee2e2',
          border: `1px solid ${isDarkMode ? '#ef4444' : '#dc2626'}`,
          color: isDarkMode ? '#fca5a5' : '#991b1b',
        }}
      >
        {error}
      </div>
    );
  }

  if (!resolvedConfig || !ChartComponent) {
    return (
      <div
        style={{
          margin: '16px 0',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: isDarkMode ? '#1f2937' : '#f3f4f6',
          border: `1px dashed ${isDarkMode ? '#4b5563' : '#cbd5f5'}`,
          color: isDarkMode ? '#9ca3af' : '#4b5563',
        }}
      >
        {parsedConfig ? `暂不支持的图表类型: ${parsedConfig.type ?? (chartType || '未指定')}` : '未提供图表配置'}
      </div>
    );
  }

  return (
    <div style={{ width }}>
      <ChartComponent {...resolvedConfig} />
    </div>
  );
};

export default ChartRenderer;
