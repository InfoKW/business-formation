import Link from 'next/link'
import KWHeader from '@/components/KWHeader'
import FAQAccordion from './FAQAccordion'

export const metadata = {
  title: 'Business Formation & Incorporation | KelliWorks',
}

const services = [
  {
    title: 'LLC, Corporation & Nonprofit Formation',
    desc: "We handle the complete state filing process for your new entity, so you don't have to navigate the paperwork yourself.",
  },
  {
    title: 'EIN / Federal Tax ID Number',
    desc: "We obtain your federal Employer Identification Number as part of formation, so you're ready to open a business bank account and start operating.",
  },
  {
    title: 'Registered Agent Service',
    desc: "We act as your registered agent, receiving legal and state documents on your business's behalf and keeping you compliant in every state you operate in.",
  },
  {
    title: 'Business Banking Setup',
    desc: 'We help you get your business bank account open and ready to go as soon as your entity is formed.',
  },
  {
    title: 'Compliance & Annual Report Filing',
    desc: "We track your state's filing deadlines - annual, biannual, or quarterly - and handle the ongoing filings so your business stays in good standing.",
  },
  {
    title: 'S-Corp Election & Add-On Filings',
    desc: 'Need an S-Corp election, business license research, or a BOI report? We can add these to your formation package.',
  },
  {
    title: 'Standard or Expedited Filing',
    desc: "Choose the turnaround that fits your timeline - we'll walk you through the options for your state.",
  },
  {
    title: 'One Point of Contact',
    desc: "You work directly with KelliWorks throughout formation and beyond - we coordinate everything on your behalf so you're not managing multiple vendors.",
  },
]

const steps = [
  { n: '01', title: 'Business Details', desc: 'Tell us your proposed business name, entity type, and state of formation.' },
  { n: '02', title: 'Owner Information', desc: 'Enter details for each owner or member - we collect everything NWRA needs for your filing.' },
  { n: '03', title: 'Financial Overview', desc: 'A few quick questions about your anticipated revenue, employees, and any add-ons like EIN or expedited filing.' },
  { n: '04', title: 'Secure Payment', desc: 'Pay once, securely via Stripe. Your order is submitted to our filing partner only after payment is confirmed.' },
]

export default function StartPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <KWHeader />

      {/* ── Hero ── */}
      <div className="bg-kw-forest text-white px-10 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="inline-block bg-kw-gold/20 text-kw-gold-light text-[11px] font-bold tracking-[0.14em] uppercase px-4 py-1.5 rounded-pill border border-kw-gold/30 mb-6">
            KelliWorks Services
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-normal leading-tight mb-4">
            Business Formation <span className="text-kw-gold">&amp;</span> Incorporation
          </h1>
          <p className="font-secondary text-kw-gold-light italic text-base mb-5">
            KelliWorks: Your Partner in Forming and Protecting Your Business
          </p>
          <p className="text-white/70 text-[15px] font-light leading-relaxed mb-10 max-w-xl">
            Starting a company means navigating state paperwork, licensing, and compliance rules that
            change depending on where you&apos;re forming - and getting it wrong can cost you time and money
            later. KelliWorks handles the entire formation process for you, from filing your LLC or
            corporation to keeping you compliant year after year.
          </p>
          <Link href="/apply" className="btn-gold">
            Register Now &rarr;
          </Link>
        </div>
      </div>

      {/* ── How It Works ── */}
      <section className="bg-white px-10 py-16">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-kw-gold mb-2">How It Works</p>
          <h2 className="font-display text-2xl sm:text-3xl text-kw-forest font-normal mb-10">
            Four simple steps to your new business
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {steps.map((s) => (
              <div key={s.n} className="flex gap-4">
                <div className="text-2xl font-display text-kw-gold/40 leading-none pt-0.5 w-8 flex-shrink-0">
                  {s.n}
                </div>
                <div>
                  <h3 className="font-semibold text-kw-forest text-[15px] mb-1">{s.title}</h3>
                  <p className="text-kw-text-secondary text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 pt-8 border-t border-kw-border-light">
            <Link href="/apply" className="btn-gold">
              Register Now &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── Services Grid ── */}
      <section className="bg-kw-forest px-10 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-2xl sm:text-3xl text-kw-gold font-normal text-center mb-14">
            Our Business Formation Services
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-x-12 sm:gap-y-10">
            {services.map((s) => (
              <div key={s.title} className="flex flex-col gap-3">
                <div className="font-semibold text-white text-[15px] pb-3 border-b border-kw-gold/45">
                  {s.title}
                </div>
                <p className="text-white/70 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 text-center">
            <Link href="/apply" className="btn-outline-light">
              Register Now &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-kw-cream px-10 py-16">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-kw-gold mb-2">Common Questions</p>
          <h2 className="font-display text-2xl sm:text-3xl text-kw-forest font-normal mb-8">
            Frequently Asked Questions
          </h2>
          <FAQAccordion />
        </div>
      </section>


{/* ── Footer ── */}
      <footer className="bg-kw-cream">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 max-w-4xl mx-auto px-10 py-14">
          <div>
            <div className="font-display text-xl text-kw-forest mb-2">KelliWorks</div>
            <p className="text-[12px] text-kw-text-muted italic leading-relaxed">
              KelliWorks, so you don&apos;t have to.
            </p>
          </div>

          <div>
            <h4 className="font-secondary text-[12px] font-bold text-kw-forest uppercase tracking-[0.06em] mb-3">
              New Jersey Office
            </h4>
            <address className="not-italic text-[13px] text-kw-text-secondary leading-relaxed space-y-0.5">
              <p>2000 Morris Avenue Suite #1, Union, NJ 07083</p>
              <p>info@kelliworks.com</p>
              <p>888-875-4555</p>
              <p className="mt-1">Mon–Fri, 9AM–4PM<br />By Appointment Only</p>
            </address>
          </div>

          <div>
            <h4 className="font-secondary text-[12px] font-bold text-kw-forest uppercase tracking-[0.06em] mb-3">
              Florida Office
            </h4>
            <address className="not-italic text-[13px] text-kw-text-secondary leading-relaxed space-y-0.5">
              <p>777 Brickell Ave, Suite #14, Miami, FL 33131</p>
              <p>info@kelliworks.com</p>
              <p>888-875-4555</p>
              <p className="mt-1">Mon–Fri, 9AM–4PM<br />By Appointment Only</p>
            </address>
          </div>

          <div>
            <h4 className="font-secondary text-[12px] font-bold text-kw-forest uppercase tracking-[0.06em] mb-3">
              Quick Links
            </h4>
            <ul className="space-y-1.5 mb-5">
              <li><a href="#" className="text-[13px] text-kw-text-secondary hover:text-kw-gold-dark transition-colors">Quotes</a></li>
              <li><a href="#" className="text-[13px] text-kw-text-secondary hover:text-kw-gold-dark transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-[13px] text-kw-text-secondary hover:text-kw-gold-dark transition-colors">Terms Of Use</a></li>
            </ul>
            <div className="flex flex-col gap-2">
              <input
                type="email"
                placeholder="Email"
                aria-label="Email address"
                className="px-3 py-2 border border-kw-border-mid rounded-card text-[13px] font-primary bg-white text-kw-text-primary outline-none focus:border-kw-gold"
              />
              <button className="px-3 py-2 bg-kw-gold text-kw-forest rounded-card text-[13px] font-bold uppercase tracking-[0.06em] hover:bg-kw-gold-light transition-colors">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        <div className="bg-kw-gold text-center py-3 text-[12px] text-kw-forest font-medium">
          &copy; 2026 KelliWorks. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
