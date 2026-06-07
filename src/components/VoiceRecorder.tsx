import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { processVoiceCommand } from "@/lib/voice.functions";
import { LANGUAGES } from "@/lib/languages";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function VoiceRecorder({
  organizationId,
  defaultLanguage,
}: {
  organizationId: string;
  defaultLanguage: string;
}) {
  const process = useServerFn(processVoiceCommand);
  const qc = useQueryClient();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [language, setLanguage] = useState(defaultLanguage);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = handleStop;
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  }

  function stop() {
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    if (tickRef.current) clearInterval(tickRef.current);
    setRecording(false);
  }

  async function handleStop() {
    setProcessing(true);
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      if (blob.size < 1000) {
        toast.error("Recording too short");
        return;
      }
      const path = `${organizationId}/instr-${crypto.randomUUID()}.webm`;
      const { error: upErr } = await supabase.storage.from("voice").upload(path, blob, {
        contentType: "audio/webm",
        upsert: false,
      });
      if (upErr) throw upErr;

      const result = await process({ data: { storagePath: path, language } });
      setLastTranscript(result.transcript);
      toast.success(`Created ${result.tasksCreated} task${result.tasksCreated === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Voice instruction</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Speak naturally. The AI will break it into tasks and assign workers.
          </p>
        </div>
        <div className="w-40">
          <Select value={language} onValueChange={setLanguage} disabled={recording || processing}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        {!recording && !processing && (
          <Button onClick={start} size="lg" className="h-16 w-16 rounded-full p-0">
            <Mic className="h-7 w-7" />
          </Button>
        )}
        {recording && (
          <Button
            onClick={stop}
            size="lg"
            variant="destructive"
            className="h-16 w-16 rounded-full p-0 animate-pulse"
          >
            <Square className="h-6 w-6" />
          </Button>
        )}
        {processing && (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        )}
        <div className="text-sm text-muted-foreground">
          {recording && `Recording… ${seconds}s — click to stop`}
          {processing && "Transcribing, extracting tasks, translating…"}
          {!recording && !processing && "Tap to record"}
        </div>
      </div>

      {lastTranscript && (
        <div className="mt-6 rounded-lg border bg-muted/30 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Last transcript
          </div>
          <p className="mt-1 text-sm">{lastTranscript}</p>
        </div>
      )}
    </div>
  );
}
