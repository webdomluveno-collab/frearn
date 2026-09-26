"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      <p className="text-sm text-muted-foreground">Only the details needed for matching. Additional provider questions can be added here later.</p>
      <Card><CardHeader><CardTitle>Demographics</CardTitle><CardDescription>Used to match relevant opportunities.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
            <div><Label htmlFor="p-country">Country</Label><Input id="p-country" placeholder="Country" /></div>
            <div><Label htmlFor="p-dob">Date of birth</Label><Input id="p-dob" type="date" /></div>
            <div><Label htmlFor="p-gender">Gender</Label><Input id="p-gender" placeholder="Female / Male / Non-binary / Prefer not to say" /></div>
            <div><Label htmlFor="p-employment">Employment status</Label><Input id="p-employment" placeholder="e.g. Employed, Student" /></div>
            <div><Label htmlFor="p-education">Education</Label><Input id="p-education" placeholder="e.g. Bachelor's degree" /></div>
            <div><Label htmlFor="p-household">Household size</Label><Input id="p-household" type="number" min={1} placeholder="e.g. 3" /></div>
            <Button type="submit">Save profile</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
