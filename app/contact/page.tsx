import type { Metadata } from "next";
import { baseMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = baseMetadata({ title: "Contact" });

export default function ContactPage() {
  return (
    <div className="container max-w-2xl py-14">
      <h1 className="text-3xl font-bold tracking-tight">Contact</h1>
      <p className="mt-2 text-muted-foreground">We read every message.</p>
      <Card className="mt-8"><CardContent className="p-6 text-sm">
        <p>Email us at:</p>
        <p className="mt-1 text-base font-semibold"><a className="underline" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a></p>
        <p className="mt-4 text-muted-foreground">For provider/partnership inquiries, include your company, use case, and expected volume.</p>
      </CardContent></Card>
    </div>
  );
}
