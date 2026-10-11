import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth-forms";

// Auth forms carry no indexable content.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function RegisterPage() { return <RegisterForm />; }
