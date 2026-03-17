/**
 * BaseEChart — A reusable Apache ECharts component.
 * 
 * Features:
 * - Uses echarts-for-react
 * - Accepts props for title, xAxisData, and series
 * - Responsive (width 100%, configurable height)
 * - Theme-aware styling using CSS variables
 * 
 * Usage:
 *   <BaseEChart 
 *     title="Monthly Sales" 
 *     xAxisData={['Jan', 'Feb', 'Mar']} 
 *     series={[{ name: 'Sales', type: 'line', data: [10, 20, 30] }]} 
 *   />
 */
import ReactECharts from 'echarts-for-react';
import { useTheme } from '@/contexts/ThemeContext';

export interface EChartSeries {
  name: string;
  type: 'line' | 'bar' | 'pie' | 'scatter';
  data: number[];
  itemStyle?: any;
  lineStyle?: any;
  areaStyle?: any;
  smooth?: boolean;
}

interface BaseEChartProps {
  title?: string;
  xAxisData: string[];
  series: EChartSeries[];
  height?: number | string;
  colors?: string[];
}

export default function BaseEChart({ 
  title, 
  xAxisData, 
  series, 
  height = 400,
  colors = ['#0091AE', '#FDB817', '#F4795B', '#21B9A3', '#112548']
}: BaseEChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const textColor = isDark ? '#e2e8f0' : '#334155';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  const option = {
    color: colors,
    title: title ? {
      text: title,
      textStyle: { color: textColor, fontSize: 16, fontWeight: 600 },
      left: 'center',
      top: 10
    } : undefined,
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: gridColor,
      textStyle: { color: textColor },
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: series.map(s => s.name),
      bottom: 10,
      textStyle: { color: textColor }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: title ? 50 : 20,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: series.some(s => s.type === 'bar'),
      data: xAxisData,
      axisLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      axisLabel: { color: textColor }
    },
    series: series.map(s => ({
      ...s,
      emphasis: { focus: 'series' }
    }))
  };

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-sm p-2">
      <ReactECharts 
        option={option} 
        style={{ height, width: '100%' }} 
        theme={isDark ? 'dark' : 'light'}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}
