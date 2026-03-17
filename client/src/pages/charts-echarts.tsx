import PageHeader from "@/components/PageHeader";
import BaseEChart, { EChartSeries } from "@/components/BaseEChart";

export default function EChartsPage() {
  // Mock data for line chart
  const lineXAxis = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
  const lineSeries: EChartSeries[] = [
    {
      name: 'Active Users',
      type: 'line',
      smooth: true,
      data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 500) + 100),
      areaStyle: { opacity: 0.1 }
    },
    {
      name: 'New Signups',
      type: 'line',
      smooth: true,
      data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 100) + 20)
    }
  ];

  // Mock data for bar chart
  const barXAxis = ['Q1', 'Q2', 'Q3', 'Q4'];
  const barSeries: EChartSeries[] = [
    {
      name: 'Revenue',
      type: 'bar',
      data: [12000, 15000, 18000, 22000]
    },
    {
      name: 'Expenses',
      type: 'bar',
      data: [8000, 9000, 11000, 13000]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader crumbs={[{ label: "Apache ECharts" }]} />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold font-display text-foreground mb-1">Apache ECharts</h1>
          <p className="text-sm text-muted-foreground">
            High-performance, interactive charts using echarts-for-react.
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-medium text-foreground mb-4">Time Series Analysis</h2>
            <BaseEChart 
              title="User Engagement (30 Days)" 
              xAxisData={lineXAxis} 
              series={lineSeries} 
              height={400}
            />
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-4">Quarterly Financials</h2>
            <BaseEChart 
              title="Revenue vs Expenses" 
              xAxisData={barXAxis} 
              series={barSeries} 
              height={400}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
