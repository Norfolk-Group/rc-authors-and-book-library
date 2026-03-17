import PageHeader from "@/components/PageHeader";
import NivoLineChart from "@/components/NivoLineChart";
import NivoBarChart from "@/components/NivoBarChart";

export default function NivoChartsPage() {
  // Mock data for Nivo line chart
  const lineData = [
    {
      id: "organic",
      data: [
        { x: "Jan", y: 120 },
        { x: "Feb", y: 135 },
        { x: "Mar", y: 150 },
        { x: "Apr", y: 180 },
        { x: "May", y: 210 },
        { x: "Jun", y: 250 },
      ]
    },
    {
      id: "paid",
      data: [
        { x: "Jan", y: 80 },
        { x: "Feb", y: 90 },
        { x: "Mar", y: 85 },
        { x: "Apr", y: 110 },
        { x: "May", y: 140 },
        { x: "Jun", y: 130 },
      ]
    }
  ];

  // Mock data for Nivo bar chart
  const barData = [
    { region: "North America", "Q1": 120, "Q2": 140, "Q3": 160, "Q4": 190 },
    { region: "Europe", "Q1": 90, "Q2": 110, "Q3": 130, "Q4": 150 },
    { region: "Asia", "Q1": 70, "Q2": 85, "Q3": 100, "Q4": 120 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader crumbs={[{ label: "Nivo Charts" }]} />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold font-display text-foreground mb-1">Nivo Charts</h1>
          <p className="text-sm text-muted-foreground">
            Beautiful, declarative charts built on top of D3.js.
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-medium text-foreground mb-4">Traffic Sources (Line)</h2>
            <NivoLineChart 
              data={lineData} 
              height={400}
              xAxisLabel="Month"
              yAxisLabel="Visitors (k)"
            />
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-4">Regional Sales (Bar)</h2>
            <NivoBarChart 
              data={barData} 
              keys={["Q1", "Q2", "Q3", "Q4"]}
              indexBy="region"
              height={400}
              xAxisLabel="Region"
              yAxisLabel="Revenue ($k)"
            />
          </section>
        </div>
      </div>
    </div>
  );
}
