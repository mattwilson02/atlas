import { Handle, Position } from "@xyflow/react";

// Four source handles + ConnectionMode.Loose: any side connects to any side.
export function Handles() {
  return (
    <>
      <Handle id="t" type="source" position={Position.Top} />
      <Handle id="r" type="source" position={Position.Right} />
      <Handle id="b" type="source" position={Position.Bottom} />
      <Handle id="l" type="source" position={Position.Left} />
    </>
  );
}
