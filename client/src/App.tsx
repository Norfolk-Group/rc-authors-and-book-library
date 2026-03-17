import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import FlowbiteDemo from "./pages/FlowbiteDemo";
import Home from "./pages/Home";
import Preferences from "./pages/Preferences";
import ResearchCascade from "./pages/ResearchCascade";
import FlowEditorPage from "./pages/flow-editor";
import EChartsPage from "./pages/charts-echarts";
import NivoChartsPage from "./pages/charts-nivo";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/preferences"} component={Preferences} />
      <Route path={"/flowbite-demo"} component={FlowbiteDemo} />
      <Route path={"/research-cascade"} component={ResearchCascade} />
      <Route path={"/flow-editor"} component={FlowEditorPage} />
      <Route path={"/charts-echarts"} component={EChartsPage} />
      <Route path={"/charts-nivo"} component={NivoChartsPage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
