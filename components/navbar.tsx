import Link from "next/link";
import { Brand } from "./fx/brand";
import { ButtonLink } from "./fx/primitives";

const links = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Explore opportunities", href: "/dashboard/earn" },
  { label: "Need a hand?", href: "/contact" },
];

export function Navbar() {
  return (
    <header className="public-header">
      <Brand />
      <nav aria-label="Public navigation">
        {links.map((l) => (
          <Link key={l.label} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div>
        <Link href="/login" className="login-link">
          Log in
        </Link>
        <ButtonLink href="/register">Sign up</ButtonLink>
      </div>
    </header>
  );
}
