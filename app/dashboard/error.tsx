"use client";

import { Button, ButtonLink, EmptyState } from "@/components/fx/primitives";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="dashboard-error" role="alert">
      <EmptyState icon="wifi" title="A little pause. Try again." description="We couldn’t load this page. Check your connection and give it another moment.">
        <div className="error-actions"><Button onClick={reset}>Try again</Button><ButtonLink href="/contact" variant="secondary">Get help</ButtonLink></div>
      </EmptyState>
    </section>
  );
}
