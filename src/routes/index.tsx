import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Mic, Languages, Users, Activity, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Staff Broker — Multilingual AI Workforce Supervisor" },
      { name: "description", content: "Speak in your language. AI Staff Broker's AI Supervisor turns voice instructions into translated tasks for every worker." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Mic className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight">AI Staff Broker</span>
          </div>
          <Link to="/auth">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Voice-first · 11 Indian languages
          </div>
          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl">
            Your AI Supervisor —{" "}
            <span className="text-primary">in every language your team speaks.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Speak instructions once. AI Staff Broker breaks them into tasks, picks the right workers, and delivers translated voice instructions to each one — Telugu, Tamil, Hindi, Kannada, and more.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Mic, title: "Voice in, tasks out", body: "Record one instruction. The AI extracts every actionable task and prioritizes it." },
              { icon: Languages, title: "Native-language delivery", body: "Each worker hears their tasks in their preferred language — no manual translation." },
              { icon: Users, title: "Smart assignment", body: "Tasks go to the right worker based on skill, language, and availability." },
              { icon: Activity, title: "Live status board", body: "Owners and supervisors see pending, in-progress, and completed tasks in realtime." },
              { icon: Languages, title: "Two-way voice", body: "Workers reply with voice updates — translated back to your language automatically." },
              { icon: Users, title: "Built for the floor", body: "Designed for warehouses, retail, factories, hospitals, and construction sites." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} AI Staff Broker · Multilingual workforce coordination
        </div>
      </footer>
    </div>
  );
}
