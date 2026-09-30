import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Spark } from "./icon";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`brand ${light ? "brand-light" : ""}`} aria-label={`${siteConfig.name} home`}>
      <Spark size={30} />
      <span>
        {siteConfig.logoText.toLowerCase()}
        <span className="brand-period">.</span>
      </span>
    </Link>
  );
}
