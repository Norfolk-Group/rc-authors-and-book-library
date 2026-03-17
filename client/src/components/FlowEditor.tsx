/**
 * FlowEditor — A reusable React Flow component for interactive diagrams.
 * 
 * Features:
 * - Minimal set of nodes and edges (simple linear flow)
 * - Zoom, pan, controls, and minimap
 * - Handlers for onNodesChange, onEdgesChange, and onConnect
 * - Responsive to available viewport
 * 
 * Usage:
 *   <FlowEditor />
 */
import { useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes: Node[] = [
  { id: '1', position: { x: 250, y: 50 }, data: { label: 'Start Node' }, type: 'input' },
  { id: '2', position: { x: 250, y: 150 }, data: { label: 'Process Node' } },
  { id: '3', position: { x: 250, y: 250 }, data: { label: 'End Node' }, type: 'output' },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3' },
];

export default function FlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="w-full h-full min-h-[500px] bg-background border border-border rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        className="bg-muted/10"
      >
        <Controls className="bg-background border-border fill-foreground" />
        <MiniMap 
          nodeStrokeColor="var(--border)"
          nodeColor="var(--card)"
          maskColor="var(--muted)"
          className="bg-background border-border"
        />
        <Background color="var(--muted-foreground)" gap={16} />
      </ReactFlow>
    </div>
  );
}
