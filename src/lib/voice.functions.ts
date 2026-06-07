import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateObject } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProcessInput = z.object({
  storagePath: z.string().min(1), // path in the "voice" bucket
  language: z.string().min(2).max(10).default("en"),
});

// Extracted task shape returned by the LLM.
const ExtractedTask = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  required_skills: z.array(z.string()).max(8).default([]),
});
const ExtractionSchema = z.object({ tasks: z.array(ExtractedTask).max(10) });

export const processVoiceCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProcessInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    console.log("[Voice Processing] Starting processVoiceCommand. storagePath:", data.storagePath, "language:", data.language, "userId:", userId);

    // Manager check + org
    console.log("[Voice Processing] Fetching profile for user:", userId);
    const { data: profile, error: profileErr } = await supabase
      .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    if (profileErr) {
      console.error("[Voice Processing] Error fetching profile:", profileErr);
      throw new Error("Failed to fetch user profile: " + profileErr.message);
    }
    const orgId = profile?.organization_id;
    console.log("[Voice Processing] User Org ID:", orgId);
    if (!orgId) {
      console.error("[Voice Processing] No organization found for user:", userId);
      throw new Error("No organization found for your profile");
    }

    console.log("[Voice Processing] Fetching user roles in org:", orgId);
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("organization_id", orgId);
    if (rolesErr) {
      console.error("[Voice Processing] Error fetching roles:", rolesErr);
      throw new Error("Failed to verify manager roles: " + rolesErr.message);
    }
    const isManager = (roles ?? []).some(
      (r: { role: string }) => r.role === "owner" || r.role === "supervisor",
    );
    console.log("[Voice Processing] Roles found:", roles, "Is Manager:", isManager);
    if (!isManager) {
      console.error("[Voice Processing] User is not a manager");
      throw new Error("Only owners and supervisors can record instructions");
    }

    // 1) Download the uploaded audio via signed URL (admin)
    console.log("[Voice Processing] Generating signed URL for:", data.storagePath);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signErr } = await supabaseAdmin
      .storage.from("voice").createSignedUrl(data.storagePath, 300);
    if (signErr || !signed) {
      console.error("[Voice Processing] Failed to create signed URL:", signErr);
      throw new Error("Failed to access audio: " + (signErr?.message ?? "unknown storage error"));
    }
    console.log("[Voice Processing] Signed URL generated successfully. Downloading audio...");
    
    let audioBlob;
    try {
      const audioRes = await fetch(signed.signedUrl);
      if (!audioRes.ok) {
        throw new Error(`HTTP ${audioRes.status} ${audioRes.statusText}`);
      }
      const audioBuf = await audioRes.arrayBuffer();
      audioBlob = new Blob([audioBuf], { type: audioRes.headers.get("content-type") ?? "audio/webm" });
      console.log("[Voice Processing] Audio downloaded successfully, size in bytes:", audioBlob.size);
    } catch (fetchErr) {
      console.error("[Voice Processing] Fetching audio failed:", fetchErr);
      throw new Error("Failed to download audio from storage: " + (fetchErr instanceof Error ? fetchErr.message : String(fetchErr)));
    }
    
    const publicPath = supabaseAdmin.storage.from("voice").getPublicUrl(data.storagePath).data.publicUrl;
    console.log("[Voice Processing] Public URL for audio:", publicPath);

    // 2) Sarvam STT
    console.log("[Voice Processing] Calling Sarvam STT model saarika:v2.5...");
    const { sarvamSTT, sarvamTranslate, sarvamTTS } = await import("./sarvam.server");
    let stt;
    try {
      stt = await sarvamSTT({ audio: audioBlob, language: data.language });
      console.log("[Voice Processing] Sarvam STT result:", stt);
    } catch (sttErr) {
      console.error("[Voice Processing] Sarvam STT failed:", sttErr);
      throw new Error("Speech-to-text transcription failed: " + (sttErr instanceof Error ? sttErr.message : String(sttErr)));
    }
    const transcript = stt.transcript;
    console.log("[Voice Processing] Final transcript:", transcript);

    // 3) Save voice_message
    console.log("[Voice Processing] Inserting voice message into DB...");
    const { error: vmErr } = await supabase.from("voice_messages").insert({
      organization_id: orgId,
      sender_id: userId,
      audio_url: publicPath,
      transcript,
      language: data.language,
      kind: "instruction",
    });
    if (vmErr) {
      console.error("[Voice Processing] Error inserting voice message:", vmErr);
    } else {
      console.log("[Voice Processing] Voice message inserted successfully.");
    }

    // 4) Translate transcript to English for the LLM
    let transcriptForLLM = transcript;
    if (data.language !== "en") {
      console.log("[Voice Processing] Translating transcript to English for LLM...");
      try {
        transcriptForLLM = await sarvamTranslate({
          input: transcript, sourceLanguage: data.language, targetLanguage: "en",
        });
        console.log("[Voice Processing] Translation for LLM success:", transcriptForLLM);
      } catch (e) {
        console.warn("[Voice Processing] Translate to English failed, using original transcript:", e);
      }
    }

    // 5) LLM extracts tasks
    console.log("[Voice Processing] Loading AI key...");
    const lovableKey = process.env.LOVABLE_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    let model;
    if (lovableKey) {
      console.log("[Voice Processing] Using Lovable AI Gateway...");
      const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
      const gateway = createLovableAiGatewayProvider(lovableKey);
      model = gateway("google/gemini-3-flash-preview");
    } else if (geminiKey) {
      console.log("[Voice Processing] Using direct Google Gemini API (via compatible wrapper)...");
      const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
      const provider = createOpenAICompatible({
        name: "gemini",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
        headers: {
          Authorization: `Bearer ${geminiKey}`,
        },
      });
      model = provider("gemini-1.5-flash");
    } else if (openaiKey) {
      console.log("[Voice Processing] Using direct OpenAI API...");
      const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
      const provider = createOpenAICompatible({
        name: "openai",
        baseURL: "https://api.openai.com/v1",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
      });
      model = provider("gpt-4o-mini");
    } else {
      console.error("[Voice Processing] No AI API keys found in environment variables");
      throw new Error("Missing AI API Key. Please configure LOVABLE_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in your .env file.");
    }

    console.log("[Voice Processing] Calling generateObject to extract tasks...");
    let extracted;
    try {
      const { object } = await generateObject({
        model,
        schema: ExtractionSchema,
        system:
          "You are an operations supervisor. Convert the spoken instruction into a clean list of actionable tasks. " +
          "You must respond with a JSON object containing a 'tasks' array. Each task MUST have the following keys:\n" +
          "- 'title': A short imperative title (under 12 words)\n" +
          "- 'description': A one-line description with concrete details\n" +
          "- 'priority': One of 'low', 'medium', 'high', 'urgent'\n" +
          "- 'required_skills': A list of 0-5 short skill keywords (single words, lowercase, e.g. 'inventory', 'cleaning')\n" +
          "Respond in JSON format matching this schema.",
        prompt: `Spoken instruction (translated to English if needed):\n"""${transcriptForLLM}"""`,
      });
      extracted = object;
      console.log("[Voice Processing] Tasks extracted successfully:", JSON.stringify(extracted));
    } catch (llmErr) {
      console.error("[Voice Processing] generateObject failed:", llmErr);
      throw new Error("AI task extraction failed: " + (llmErr instanceof Error ? llmErr.message : String(llmErr)));
    }

    // 6) Get candidate workers
    console.log("[Voice Processing] Fetching workers for organization:", orgId);
    const { data: workers, error: workersErr } = await supabase
      .from("profiles")
      .select("id, full_name, preferred_language, skills, availability")
      .eq("organization_id", orgId);
    if (workersErr) {
      console.error("[Voice Processing] Fetching workers failed:", workersErr);
      throw new Error("Failed to fetch workers: " + workersErr.message);
    }
    console.log("[Voice Processing] Workers in org:", workers);

    console.log("[Voice Processing] Fetching worker roles in org:", orgId);
    const { data: workerRoles, error: wRolesErr } = await supabase
      .from("user_roles").select("user_id, role").eq("organization_id", orgId);
    if (wRolesErr) {
      console.error("[Voice Processing] Fetching worker roles failed:", wRolesErr);
      throw new Error("Failed to fetch worker roles: " + wRolesErr.message);
    }
    const workerIds = new Set(
      (workerRoles ?? []).filter((r) => r.role === "worker").map((r) => r.user_id),
    );
    const availableWorkers = (workers ?? []).filter(
      (w: { id: string; availability: boolean }) => workerIds.has(w.id) && w.availability,
    );
    console.log("[Voice Processing] Available workers with 'worker' role:", availableWorkers);

    function pickWorker(skills: string[]): typeof availableWorkers[number] | undefined {
      if (availableWorkers.length === 0) return undefined;
      let best = availableWorkers[0];
      let bestScore = -1;
      for (const w of availableWorkers) {
        const wSkills = (w.skills ?? []).map((s: string) => s.toLowerCase());
        const score = skills.reduce(
          (acc, s) => acc + (wSkills.includes(s.toLowerCase()) ? 1 : 0),
          0,
        );
        if (score > bestScore) {
          best = w;
          bestScore = score;
        }
      }
      return bestScore >= 0 ? best : undefined;
    }

    // 7) Create each task + translate + TTS
    console.log("[Voice Processing] Starting loop to create tasks in database...");
    const created: Array<{ id: string; title: string; assigned_to: string | null }> = [];
    for (const t of extracted.tasks) {
      const worker = pickWorker(t.required_skills);
      const targetLang = worker?.preferred_language ?? "en";
      console.log(`[Voice Processing] Task: "${t.title}". Assigned to worker:`, worker?.full_name, "Target Language:", targetLang);

      console.log(`[Voice Processing] Translating title and description to:`, targetLang);
      const [translatedTitle, translatedDescription] = await Promise.all([
        sarvamTranslate({ input: t.title, sourceLanguage: "en", targetLanguage: targetLang }).catch((e) => {
          console.warn("[Voice Processing] Title translation failed, using original:", e);
          return t.title;
        }),
        sarvamTranslate({ input: t.description, sourceLanguage: "en", targetLanguage: targetLang }).catch((e) => {
          console.warn("[Voice Processing] Description translation failed, using original:", e);
          return t.description;
        }),
      ]);
      console.log(`[Voice Processing] Translation complete. Title:`, translatedTitle, "Description:", translatedDescription);

      let translatedAudioUrl: string | null = null;
      try {
        console.log(`[Voice Processing] Generating TTS for task audio in language:`, targetLang);
        const audioData = await sarvamTTS({
          text: `${translatedTitle}. ${translatedDescription}`,
          language: targetLang,
        });
        console.log(`[Voice Processing] TTS generated successfully. Uploading audio to storage...`);
        
        const audioBuffer = Uint8Array.from(
          atob(audioData.split(",")[1]),
          (c) => c.charCodeAt(0),
        );
        const ttsPath = `${orgId}/tts-${crypto.randomUUID()}.wav`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("voice")
          .upload(ttsPath, audioBuffer, { contentType: "audio/wav" });
        if (!upErr) {
          translatedAudioUrl = supabaseAdmin.storage.from("voice").getPublicUrl(ttsPath).data.publicUrl;
          console.log(`[Voice Processing] TTS audio uploaded. Public URL:`, translatedAudioUrl);
        } else {
          console.error(`[Voice Processing] TTS storage upload failed:`, upErr);
        }
      } catch (e) {
        console.warn("[Voice Processing] TTS generation/upload failed for task:", e);
      }

      console.log(`[Voice Processing] Inserting task into database table...`);
      const { data: insertedTask, error: taskErr } = await supabase
        .from("tasks")
        .insert({
          organization_id: orgId,
          title: t.title,
          description: t.description,
          priority: t.priority,
          source_language: data.language,
          source_audio_url: publicPath,
          source_transcript: transcript,
          created_by: userId,
          assigned_worker_id: worker?.id ?? null,
          status: worker ? "assigned" : "pending",
          target_language: targetLang,
          translated_title: translatedTitle,
          translated_description: translatedDescription,
          translated_audio_url: translatedAudioUrl,
        })
        .select("id, title")
        .single();
      if (taskErr) {
        console.error("[Voice Processing] Failed to insert task row in DB:", taskErr);
        continue;
      }
      console.log(`[Voice Processing] Task inserted with ID:`, insertedTask.id);

      console.log(`[Voice Processing] Inserting task history entry...`);
      const { error: historyErr } = await supabase.from("task_history").insert({
        task_id: insertedTask.id,
        organization_id: orgId,
        actor_id: userId,
        status: worker ? "assigned" : "pending",
        note: worker ? `Auto-assigned to ${worker.full_name ?? "worker"}` : "Unassigned — no matching worker",
      });
      if (historyErr) {
        console.error("[Voice Processing] Failed to insert task history row in DB:", historyErr);
      } else {
        console.log("[Voice Processing] Task history inserted.");
      }

      created.push({ id: insertedTask.id, title: insertedTask.title, assigned_to: worker?.id ?? null });
    }

    console.log("[Voice Processing] Voice command processing finished successfully. Created tasks:", created);
    return {
      transcript,
      tasksCreated: created.length,
      tasks: created,
    };
  });
