import Link from "next/link";

export function Logo() {
  return (
    <Link className="logo" href="/" aria-label="Soil Intelligence home">
      <img className="logo-mark" src="/logo.png" alt="" />
      <span>Soil Intelligence</span>
    </Link>
  );
}
