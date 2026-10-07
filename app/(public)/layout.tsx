import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PublicFrame } from "@/components/public-frame";
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicFrame header={<Navbar />} footer={<Footer />}>{children}</PublicFrame>;
}
