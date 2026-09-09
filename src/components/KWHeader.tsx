import Link from 'next/link'

export default function KWHeader() {
  return (
    <header className="bg-kw-forest text-white px-6 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link href="https://kelliworks.com" className="font-display text-xl text-kw-gold no-underline">
          KelliWorks
        </Link>
        <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-white/50">
          Business Formation Portal
        </span>
      </div>
    </header>
  )
}
