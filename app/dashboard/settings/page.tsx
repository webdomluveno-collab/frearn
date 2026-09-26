import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <Card><CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Email verification: coming soon (Supabase Auth).</p>
          <p>Google login: planned.</p>
          <p>Delete account: contact support.</p>
        </CardContent>
      </Card>
    </div>
  );
}
