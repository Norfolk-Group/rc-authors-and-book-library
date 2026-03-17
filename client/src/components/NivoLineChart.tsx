/**
 * NivoLineChart — A reusable Nivo line chart component.
 * 
 * Features:
 * - Uses @nivo/line
 * - Fully typed with TypeScript
 * - Responsive (ResponsiveLine)
 * - Theme-aware styling
 * 
 * Usage:
 *   <NivoLineChart 
 *     data={[{ id: 'us', data: [{ x: 'Jan', y: 10 }, { x: 'Feb', y: 20 }] }]} 
 *   />
 */
import { ResponsiveLine } from '@nivo/line';

// Define the type locally since it's not exported directly in newer versions
export interface Serie {
    id: string | number;
    data: Array<{
        x: string | number | Date;
        y: string | number | Date | null;
    }>;
}
import { useTheme } from '@/contexts/ThemeContext';

interface NivoLineChartProps {
  data: Serie[];
  height?: number | string;
  colors?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export default function NivoLineChart({ 
  data, 
  height = 400,
  colors = ['#0091AE', '#FDB817', '#F4795B', '#21B9A3', '#112548'],
  xAxisLabel = '',
  yAxisLabel = ''
}: NivoLineChartProps) {
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
    crosshair: { line: { stroke: textColor, strokeWidth: 1, strokeOpacity: 0.5 } },
  };

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-sm p-4" style={{ height }}>
      <ResponsiveLine
        data={data}
        theme={nivoTheme}
        colors={colors}
        margin={{ top: 20, right: 110, bottom: 50, left: 60 }}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false, reverse: false }}
        yFormat=" >-.2f"
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: xAxisLabel,
          legendOffset: 36,
          legendPosition: 'middle'
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: yAxisLabel,
          legendOffset: -45,
          legendPosition: 'middle'
        }}
        pointSize={8}
        pointColor={{ theme: 'background' }}
        pointBorderWidth={2}
        pointBorderColor={{ from: 'serieColor' }}
        pointLabelYOffset={-12}
        useMesh={true}
        legends={[
          {
            anchor: 'bottom-right',
            direction: 'column',
            justify: false,
            translateX: 100,
            translateY: 0,
            itemsSpacing: 0,
            itemDirection: 'left-to-right',
            itemWidth: 80,
            itemHeight: 20,
            itemOpacity: 0.75,
            symbolSize: 12,
            symbolShape: 'circle',
            symbolBorderColor: 'rgba(0, 0, 0, .5)',
            effects: [{ on: 'hover', style: { itemBackground: 'rgba(0, 0, 0, .03)', itemOpacity: 1 } }]
          }
        ]}
      />
    </div>
  );
}
