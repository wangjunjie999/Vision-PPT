import { useData } from '@/contexts/useData';
import { DraggableLayoutCanvas } from './DraggableLayoutCanvas';

export function WorkstationCanvas() {
  const { selectedWorkstationId, workstations } = useData();

  const workstation = workstations.find(ws => ws.id === selectedWorkstationId);
  if (!workstation) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DraggableLayoutCanvas workstationId={selectedWorkstationId!} />
    </div>
  );
}

