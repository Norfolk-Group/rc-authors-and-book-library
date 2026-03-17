import PageHeader from "@/components/PageHeader";
import FlowEditor from "@/components/FlowEditor";

export default function FlowEditorPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageHeader crumbs={[{ label: "Flow Editor" }]} />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold font-display text-foreground mb-1">Flow Editor</h1>
          <p className="text-sm text-muted-foreground">
            Interactive diagramming using React Flow.
          </p>
        </div>
        <div className="h-[calc(100vh-180px)] w-full">
          <FlowEditor />
        </div>
      </div>
    </div>
  );
}
