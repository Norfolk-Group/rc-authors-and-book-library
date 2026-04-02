/**
 * TagStatisticsCard.tsx
 * Bar chart showing per-tag usage counts, split by Authors vs Books.
 * Uses recharts BarChart with a horizontal layout for readability.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export function TagStatisticsCard() {
  const { data: usageCounts = [], isLoading } = trpc.tags.getUsageCounts.useQuery(undefined, {
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Tag Usage Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (usageCounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Tag Usage Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No tags found. Create tags in the Tag Management section below.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show top 20 tags by total usage to keep the chart readable
  const chartData = usageCounts.slice(0, 20).map((t) => ({
    name: t.name.length > 18 ? t.name.slice(0, 16) + "…" : t.name,
    fullName: t.name,
    Authors: t.authors,
    Books: t.books,
    total: t.total,
    color: t.color ?? "#6366F1",
  }));

  const totalTagged = usageCounts.reduce((acc, t) => acc + t.total, 0);
  const totalWithUsage = usageCounts.filter((t) => t.total > 0).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">Tag Usage Statistics</CardTitle>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{totalWithUsage}</span> / {usageCounts.length} tags in use
            </span>
            <span>
              <span className="font-medium text-foreground">{totalTagged}</span> total assignments
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 28)}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            barCategoryGap="30%"
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 11, fill: "var(--foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "12px",
                color: "var(--popover-foreground)",
              }}
              formatter={(value, name) => [value, name]}
              labelFormatter={(label: unknown, payload: readonly { payload?: { fullName?: string } }[]) => {
                return payload?.[0]?.payload?.fullName ?? String(label);
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
            />
            <Bar dataKey="Authors" stackId="a" fill="#0091AE" />
            <Bar dataKey="Books" stackId="a" fill="#FDB817" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {usageCounts.length > 20 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Showing top 20 of {usageCounts.length} tags by usage
          </p>
        )}
      </CardContent>
    </Card>
  );
}
