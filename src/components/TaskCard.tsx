import { useState } from "react";
import { Play, Pause, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  translated_title: string | null;
  translated_description: string | null;
  translated_audio_url: string | null;
  assigned_worker_id: string | null;
  created_at: string;
};

const STATUS_VARIANT: Record<Task["status"], "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  assigned: "secondary",
  in_progress: "default",
  completed: "default",
  cancelled: "destructive",
};

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  low: "text-muted-foreground",
  medium: "text-foreground",
  high: "text-amber-600 dark:text-amber-400",
  urgent: "text-destructive",
};

export function TaskCard({
  task,
  workerView = false,
  workerName,
  onStatusChange,
}: {
  task: Task;
  workerView?: boolean;
  workerName?: string;
  onStatusChange?: (status: Task["status"]) => void;
}) {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function togglePlay() {
    if (!task.translated_audio_url) return;
    if (!audio) {
      const a = new Audio(task.translated_audio_url);
      a.onended = () => setPlaying(false);
      a.play();
      setAudio(a);
      setPlaying(true);
    } else if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }

  const title = workerView && task.translated_title ? task.translated_title : task.title;
  const description = workerView && task.translated_description ? task.translated_description : task.description;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold leading-tight">{title}</h3>
            {task.priority !== "medium" && (
              <span className={`text-xs font-medium uppercase ${PRIORITY_COLOR[task.priority]}`}>
                {task.priority === "urgent" && <AlertCircle className="inline h-3 w-3 mr-1" />}
                {task.priority}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
          {!workerView && workerName && (
            <p className="mt-2 text-xs text-muted-foreground">Assigned to {workerName}</p>
          )}
        </div>
        <Badge variant={STATUS_VARIANT[task.status]} className="capitalize whitespace-nowrap">
          {task.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {task.translated_audio_url && (
          <Button size="sm" variant="outline" onClick={togglePlay} className="gap-2">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pause" : "Play instruction"}
          </Button>
        )}
        {onStatusChange && (
          <Select value={task.status} onValueChange={(v) => onStatusChange(v as Task["status"])}>
            <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(task.created_at).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

export type { Task };
