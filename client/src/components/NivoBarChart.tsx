/**
 * NivoBarChart — A reusable Nivo bar chart component.
 * 
 * Features:
 * - Uses @nivo/bar
 * - Fully typed with TypeScript
 * - Responsive (ResponsiveBar)
 * - Theme-aware styling
 * 
 * Usage:
 *   <NivoBarChart 
 *     data={[{ country: 'AD', 'hot dog': 120 }]} 
 *     keys={['hot dog']} 
 *     indexBy="country" 
 *   />
 */
import { ResponsiveBar, BarDatum } from '@nivo/bar';
import { useTheme } from '@/contexts/ThemeContext';

interface NivoBarChartProps {
  data: BarDatum[];
  keys: string[];
  indexBy: string;
  height?: number | string;
  colors?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  layout?: 'horizontal' | 'vertical';
}

export default function NivoBarChart({ 
  data, 
  keys,
  indexBy,
  height = 400,
  colors = ['#0091AE', '#FDB817', '#F4795B', '#21B9A3', '#112548'],
  xAxisLabel = '',
  yAxisLabel = '',
  layout = 'vertical'
}: NivoBarChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const textColor = isDark ? '#e2e8f0' : '#334155';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';

  const nivoTheme = {
    text: { fill: textColor, fontSize: 12, fontFamily: 'var(--font-sans)' },
    axis: {
      domain: { line: { stroke: gridColor, strokeWidth: 1 } },
      legend: { text: { fill: textColor, fontSize: 13, fontWeight: 600 } },
      ticks: { line: { stroke: gridColor, strokeWidth: 1 }, text: { fill: textColor } },
    },
    grid: { line: { stroke: gridColor, strokeWidth: 1, strokeDasharray: '4 4' } },
    tooltip: {
      container: { background: tooltipBg, color: textColor, fontSize: 12, borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    },
  };

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-sm p-4" style={{ height }}>
      <ResponsiveBar
        data={data}
        keys={keys}
        indexBy={indexBy}
        theme={nivoTheme}
        colors={colors}
        layout={layout}
        margin={{ top: 20, right: 130, bottom: 50, left: 60 }}
        padding={0.3}
        valueScale={{ type: 'linear' }}
        indexScale={{ type: 'band', round: true }}
        borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: xAxisLabel,
          legendPosition: 'middle',
          legendOffset: 36
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: yAxisLabel,
          legendPosition: 'middle',
          legendOffset: -45
        }}
        labelSkipWidth={12}
        labelSkipHeight={12}
        labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
        legends={[
          {
            dataFrom: 'keys',
            anchor: 'bottom-right',
            direction: 'column',
            justify: false,
            translateX: 120,
            translateY: 0,
            itemsSpacing: 2,
            itemWidth: 100,
            itemHeight: 20,
            itemDirection: 'left-to-right',
            itemOpacity: 0.85,
            symbolSize: 20,
            effects: [{ on: 'hover', style: { itemOpacity: 1 } }]
          }
        ]}
        role="application"
        ariaLabel="Nivo bar chart"
      />
    </div>
  );
}
