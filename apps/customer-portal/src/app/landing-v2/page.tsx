"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { ArrowUpRight, ArrowRight } from "lucide-react";

/* -----------------------------------------------------------------------------
 * wApi — The Business Wire
 * An editorial broadsheet meets a live trading terminal.
 * Cream paper, ink, one hot cinnabar accent. Fraunces italic for the headlines,
 * Mona Sans for body, IBM Plex Mono for everything that wants to feel like data.
 * -------------------------------------------------------------------------- */

const TOKENS = {
  paper: "#F2EBD9",
  paperSoft: "#EDE4CF",
  paperDeep: "#E6DCC2",
  ink: "#0E0D0B",
  inkSoft: "#3A352C",
  inkQuiet: "#7A7163",
  rule: "rgba(14, 13, 11, 0.18)",
  ruleSoft: "rgba(14, 13, 11, 0.10)",
  accent: "#E14B27",
  accentDeep: "#B6391C",
  wire: "#13C18D",
} as const;

const grainSvg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.05  0 0 0 0 0.05  0 0 0 0 0.04  0 0 0 0.10 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const paperBg = `
  radial-gradient(1200px 600px at 88% -8%, rgba(225, 75, 39, 0.10), transparent 60%),
  radial-gradient(900px 500px at -8% 110%, rgba(19, 193, 141, 0.07), transparent 60%),
  ${TOKENS.paper}
`;

const display = { fontFamily: "var(--font-display)" } as const;
const sans = { fontFamily: "var(--font-sans)" } as const;
const mono = { fontFamily: "var(--font-mono)" } as const;
const tnum = {
  fontVariantNumeric: "tabular-nums lining-nums",
} as const;

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function LandingV2Page() {
  return (
    <div
      className="relative min-h-screen overflow-x-clip antialiased selection:bg-[#0E0D0B] selection:text-[#F2EBD9]"
      style={{
        background: paperBg,
        color: TOKENS.ink,
        ...sans,
      }}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-[#0E0D0B] focus:px-3 focus:py-2 focus:text-[#F2EBD9]"
        style={mono}
      >
        Skip to content
      </a>

      {/* Paper grain — fixed overlay, multiply blend */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.55] mix-blend-multiply"
        style={{ backgroundImage: grainSvg, backgroundSize: "200px 200px" }}
      />

      {/* Vignette */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, transparent 55%, rgba(14,13,11,0.10) 100%)",
        }}
      />

      <div className="relative z-10">
        <Masthead />
        <main id="main">
          <Hero />
          <Numbers />
          <Pillars />
          <PullQuote />
          <SubscribeCTA />
        </main>
        <Colophon />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Masthead                                                                   */
/* -------------------------------------------------------------------------- */

function Masthead() {
  const [now, setNow] = useState<string>(() => formatNow());

  useEffect(() => {
    const id = setInterval(() => setNow(formatNow()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      className="relative border-b"
      style={{ borderColor: TOKENS.ink }}
    >
      <div className="border-b" style={{ borderColor: TOKENS.ink }}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-2 text-[10.5px] uppercase tracking-[0.22em] md:text-[11px]" style={mono}>
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-flex items-center gap-2">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: TOKENS.accent }}
              />
              <span>Tue. Edition</span>
            </span>
            <span style={{ color: TOKENS.inkQuiet }}>·</span>
            <span>Distributed from Bangalore, Bombay & Bangalore</span>
          </div>
          <div className="hidden items-center gap-4 md:flex">
            <span style={{ ...tnum }}>{now}</span>
            <span style={{ color: TOKENS.inkQuiet }}>·</span>
            <span>EUR/USD/INR · 91.12 / 100 / 8350.4</span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6 py-4 md:py-5">
        <div className="flex items-baseline gap-3">
          <span
            className="text-3xl leading-none md:text-4xl"
            style={{
              ...display,
              fontStyle: "italic",
              fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
            }}
          >
            wApi
          </span>
          <span
            className="hidden text-[10.5px] uppercase tracking-[0.28em] md:inline"
            style={{ ...mono, color: TOKENS.inkSoft }}
          >
            · The Business Wire — vol. xxv n° 06
          </span>
        </div>
        <nav
          className="flex items-center gap-5 text-[12.5px] uppercase tracking-[0.18em]"
          style={mono}
        >
          <a href="#wire" className="hidden hover:underline md:inline" style={{ textUnderlineOffset: 4 }}>
            The Wire
          </a>
          <a href="#numbers" className="hidden hover:underline md:inline" style={{ textUnderlineOffset: 4 }}>
            Numbers
          </a>
          <a href="#sections" className="hidden hover:underline md:inline" style={{ textUnderlineOffset: 4 }}>
            Sections
          </a>
          <a href="#oped" className="hidden hover:underline md:inline" style={{ textUnderlineOffset: 4 }}>
            Op-Ed
          </a>
          <a
            href="/auth/login"
            className="rounded-none border px-3 py-1.5 text-[11px] hover:bg-[#0E0D0B] hover:text-[#F2EBD9]"
            style={{ borderColor: TOKENS.ink }}
          >
            Sign in
          </a>
        </nav>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero() {
  const reduce = useReducedMotion();
  const enter = (delay = 0) =>
    reduce
      ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: {
            delay,
            duration: 0.7,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
          },
        };

  return (
    <section
      className="relative border-b"
      style={{ borderColor: TOKENS.ink }}
    >
      <div className="mx-auto max-w-[1400px] px-6 pb-16 pt-10 md:pb-24 md:pt-14">
        {/* Section header — "Vol. XXV · Page A1" */}
        <motion.div
          {...enter(0)}
          className="mb-10 flex items-baseline justify-between gap-4 border-b pb-3 text-[10.5px] uppercase tracking-[0.28em] md:mb-14"
          style={{ ...mono, borderColor: TOKENS.rule, color: TOKENS.inkSoft }}
        >
          <span>Section 01 · Page A1 · The Front</span>
          <span aria-hidden className="hidden md:inline">
            Today’s headline — read in 2 min.
          </span>
        </motion.div>

        <div className="grid grid-cols-12 gap-x-6 gap-y-12 md:gap-y-0">
          {/* LEFT — headline */}
          <div className="col-span-12 md:col-span-7 md:pr-8">
            <motion.h1
              {...enter(0.1)}
              className="text-[clamp(3.4rem,9vw,8.5rem)] leading-[0.92] tracking-[-0.02em]"
              style={{
                ...display,
                fontVariationSettings:
                  '"opsz" 144, "SOFT" 60, "WONK" 0',
                color: TOKENS.ink,
              }}
            >
              Every business
              <br />
              is a{" "}
              <span
                style={{
                  fontStyle: "italic",
                  fontVariationSettings:
                    '"opsz" 144, "SOFT" 100, "WONK" 1',
                }}
              >
                conversation.
              </span>
            </motion.h1>

            <motion.p
              {...enter(0.25)}
              className="mt-8 max-w-[36ch] text-lg leading-[1.55] md:text-[19px]"
              style={{ color: TOKENS.inkSoft }}
            >
              wApi is the inbox, the campaigns, and the storefront — all on
              WhatsApp. Built for the 2.8&nbsp;billion-strong messaging economy,
              and the businesses who are tired of pretending email still works.
            </motion.p>

            <motion.div
              {...enter(0.4)}
              className="mt-9 flex flex-wrap items-center gap-4"
            >
              <a
                href="/auth/signup"
                className="group inline-flex items-center gap-2 px-5 py-3 text-[13px] uppercase tracking-[0.18em] transition-colors"
                style={{
                  ...mono,
                  background: TOKENS.ink,
                  color: TOKENS.paper,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = TOKENS.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = TOKENS.ink;
                }}
              >
                Open an account
                <ArrowUpRight
                  size={16}
                  strokeWidth={1.75}
                  className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </a>
              <a
                href="#sections"
                className="group inline-flex items-baseline gap-2 text-[13px] uppercase tracking-[0.18em] underline decoration-1 underline-offset-[6px] hover:opacity-70"
                style={mono}
              >
                Read the manifesto
                <ArrowRight size={14} strokeWidth={1.5} />
              </a>
            </motion.div>

            <motion.div
              {...enter(0.55)}
              className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-5 text-[10.5px] uppercase tracking-[0.24em]"
              style={{ ...mono, borderColor: TOKENS.rule, color: TOKENS.inkQuiet }}
            >
              <span>BSP-certified ✓</span>
              <span aria-hidden>—</span>
              <span>SOC&nbsp;2 type II</span>
              <span aria-hidden>—</span>
              <span>RBI compliant</span>
              <span aria-hidden>—</span>
              <span>99.98% uptime</span>
            </motion.div>
          </div>

          {/* RIGHT — the Wire */}
          <div className="col-span-12 md:col-span-5">
            <motion.div {...enter(0.2)}>
              <Wire />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* The Wire — streaming editorial ticker                                       */
/* -------------------------------------------------------------------------- */

type WireRow = {
  id: number;
  time: string;
  kind: "order" | "lead" | "payment" | "template" | "cart" | "support";
  text: string;
  amount?: string;
  badge?: string;
};

const wirePool: Omit<WireRow, "id" | "time">[] = [
  { kind: "order", text: "Order #4831 confirmed via reply", amount: "₹2,450", badge: "Bombay Sweet Shop" },
  { kind: "payment", text: "Payment link → checkout completed", amount: "₹7,990", badge: "Veloura Studio" },
  { kind: "lead", text: "Lead captured — routed to SDR queue", badge: "+91 ••• ••3 12" },
  { kind: "template", text: "Template ‘shipped’ delivered to 1,284", badge: "Open 94.2%" },
  { kind: "cart", text: "Cart abandonment — reply received", amount: "₹1,820", badge: "Resumed" },
  { kind: "order", text: "Order #4832 confirmed via reply", amount: "₹540", badge: "Tea & Type" },
  { kind: "support", text: "Ticket routed → agent ‘Ananya M.’", badge: "FCR 31s" },
  { kind: "payment", text: "Refund issued — UPI", amount: "−₹220", badge: "Auto" },
  { kind: "template", text: "Drip sequence step 03 dispatched", badge: "2,041 rcv" },
  { kind: "lead", text: "Click-to-WhatsApp ad → conversation", badge: "Meta Ads" },
  { kind: "order", text: "Order #4833 paid + scheduled", amount: "₹3,120", badge: "Mehra & Co." },
  { kind: "support", text: "Sentiment ‘positive’ → CSAT triggered", badge: "9.4 / 10" },
];

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

function Wire() {
  const reduce = useReducedMotion();
  const [rows, setRows] = useState<WireRow[]>(() => {
    const now = Date.now();
    return wirePool.slice(0, 7).map((r, i) => ({
      ...r,
      id: now - i * 1700,
      time: formatTime(new Date(now - i * 1700)),
    }));
  });

  useEffect(() => {
    if (reduce) return;
    let n = 0;
    const id = setInterval(() => {
      setRows((prev) => {
        const next = wirePool[(prev[0].id + ++n) % wirePool.length];
        const head: WireRow = {
          ...next,
          id: Date.now(),
          time: formatTime(new Date()),
        };
        return [head, ...prev].slice(0, 7);
      });
    }, 1800);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div
      id="wire"
      className="relative border"
      style={{
        borderColor: TOKENS.ink,
        background: TOKENS.paperSoft,
      }}
    >
      {/* Header strip */}
      <div
        className="flex items-center justify-between border-b px-4 py-2.5 text-[10.5px] uppercase tracking-[0.24em]"
        style={{ ...mono, borderColor: TOKENS.ink, color: TOKENS.ink }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{
              background: TOKENS.wire,
              boxShadow: `0 0 0 3px ${TOKENS.wire}22`,
              animation: reduce ? undefined : "wirePulse 1.6s ease-in-out infinite",
            }}
          />
          <span>The Wire — Live</span>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <span style={{ color: TOKENS.inkQuiet }}>events / second</span>
          <span style={tnum}>1.62k</span>
        </div>
      </div>

      <ul className="relative">
        <AnimatePresence initial={false}>
          {rows.map((row, i) => (
            <motion.li
              key={row.id}
              layout
              initial={
                reduce
                  ? { opacity: 1 }
                  : { opacity: 0, y: -10, backgroundColor: "#FBF4DE" }
              }
              animate={
                reduce
                  ? { opacity: 1 }
                  : {
                      opacity: 1 - i * 0.08,
                      y: 0,
                      backgroundColor: "rgba(0,0,0,0)",
                      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
                    }
              }
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, transition: { duration: 0.3 } }}
              className="grid grid-cols-12 items-baseline gap-2 border-b px-4 py-3 text-[12.5px] leading-tight"
              style={{
                ...mono,
                borderColor: TOKENS.ruleSoft,
                color: TOKENS.ink,
              }}
            >
              <span className="col-span-3 md:col-span-2" style={{ ...tnum, color: TOKENS.inkQuiet }}>
                {row.time.slice(0, 8)}
              </span>
              <span
                aria-hidden
                className="col-span-1 -ml-1"
                style={{ color: kindColor(row.kind) }}
              >
                {kindGlyph(row.kind)}
              </span>
              <span className="col-span-6 truncate md:col-span-6" style={sans}>
                {row.text}
                {row.badge && (
                  <span className="ml-2 text-[10.5px] uppercase tracking-[0.16em]" style={{ ...mono, color: TOKENS.inkQuiet }}>
                    · {row.badge}
                  </span>
                )}
              </span>
              <span
                className="col-span-2 text-right md:col-span-3"
                style={{ ...tnum, color: row.amount?.startsWith("−") ? TOKENS.accentDeep : TOKENS.ink }}
              >
                {row.amount ?? "—"}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {/* Footer strip */}
      <div
        className="flex items-center justify-between border-t bg-[#0E0D0B] px-4 py-2 text-[10.5px] uppercase tracking-[0.24em]"
        style={{ ...mono, borderColor: TOKENS.ink, color: TOKENS.paper }}
      >
        <span>Replay 24h →</span>
        <span style={{ color: "#E14B27" }}>● Streaming from WhatsApp Cloud API</span>
      </div>

      <style>{`
        @keyframes wirePulse {
          0%, 100% { box-shadow: 0 0 0 0 ${TOKENS.wire}55; }
          50% { box-shadow: 0 0 0 8px ${TOKENS.wire}00; }
        }
      `}</style>
    </div>
  );
}

function kindGlyph(k: WireRow["kind"]) {
  switch (k) {
    case "order": return "▲";
    case "payment": return "₹";
    case "lead": return "◆";
    case "template": return "✶";
    case "cart": return "▾";
    case "support": return "✕";
  }
}

function kindColor(k: WireRow["kind"]) {
  switch (k) {
    case "order": return TOKENS.wire;
    case "payment": return TOKENS.accent;
    case "lead": return TOKENS.ink;
    case "template": return TOKENS.inkSoft;
    case "cart": return TOKENS.accentDeep;
    case "support": return TOKENS.inkQuiet;
  }
}

/* -------------------------------------------------------------------------- */
/* The Numbers                                                                */
/* -------------------------------------------------------------------------- */

const numbers = [
  { value: 10, suffix: "M+", label: "Messages routed monthly", aside: "Across 47 countries, settled in 18 currencies." },
  { value: 4.2, suffix: "×", label: "Avg. campaign return", aside: "Measured against last-touch attribution, Q3 2025." },
  { value: 94, suffix: "%", label: "Read rate on WhatsApp", aside: "vs. 21% open rate on email, same audience." },
  { value: 28, suffix: "k", label: "Sellers on the wire", aside: "From single-shop merchants to listed retailers." },
];

function Numbers() {
  return (
    <section
      id="numbers"
      className="relative border-b"
      style={{ borderColor: TOKENS.ink, background: TOKENS.paperSoft }}
    >
      <div className="mx-auto max-w-[1400px] px-6 py-14 md:py-20">
        <div
          className="mb-10 flex items-baseline justify-between gap-4 border-b pb-3 text-[10.5px] uppercase tracking-[0.28em]"
          style={{ ...mono, borderColor: TOKENS.rule, color: TOKENS.inkSoft }}
        >
          <span>Section 02 · The Numbers</span>
          <span className="hidden md:inline">Audited quarterly · last update Sep 2025</span>
        </div>

        <ul className="grid grid-cols-1 gap-y-12 md:grid-cols-4 md:gap-y-0">
          {numbers.map((n, i) => (
            <li
              key={i}
              className={`relative px-0 md:px-6 ${i !== 0 ? "md:border-l" : ""}`}
              style={{ borderColor: TOKENS.rule }}
            >
              <NumberCard {...n} index={i} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function NumberCard({
  value,
  suffix,
  label,
  aside,
  index,
}: {
  value: number;
  suffix: string;
  label: string;
  aside: string;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView || reduce) {
      if (reduce) setN(value);
      return;
    }
    const start = performance.now();
    const dur = 1100 + index * 120;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, reduce, index]);

  const display = useMemo(() => {
    if (value >= 100) return Math.round(n).toString();
    if (Number.isInteger(value)) return Math.round(n).toString();
    return n.toFixed(1);
  }, [n, value]);

  return (
    <div ref={ref}>
      <div
        className="leading-[0.88] tracking-[-0.04em]"
        style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontVariationSettings: '"opsz" 144, "SOFT" 50, "WONK" 0',
          fontSize: "clamp(4rem, 9.5vw, 9rem)",
          ...tnum,
        }}
      >
        {display}
        <span
          className="ml-1 align-baseline"
          style={{
            fontStyle: "normal",
            fontSize: "0.55em",
            color: TOKENS.accent,
            fontFamily: "var(--font-display)",
          }}
        >
          {suffix}
        </span>
      </div>
      <div
        className="mt-5 text-[11px] uppercase tracking-[0.24em]"
        style={{ ...mono, color: TOKENS.ink }}
      >
        {label}
      </div>
      <p
        className="mt-2 max-w-[26ch] text-[13.5px] leading-[1.55]"
        style={{ color: TOKENS.inkQuiet }}
      >
        {aside}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pillars — Three offerings                                                  */
/* -------------------------------------------------------------------------- */

const pillars = [
  {
    eyebrow: "01 — The Inbox",
    title: "The conversation desk.",
    body: "One inbox for the whole team. Route, reply, resolve. Every message tagged, attributed, and SLA-tracked — so your customer never repeats themselves, and your agents never lose the thread.",
    bullets: [
      "Tagged routing across 40+ agents",
      "Co-pilot replies trained on your transcripts",
      "First-response under 31 seconds (median)",
    ],
    diagram: <InboxDiagram />,
  },
  {
    eyebrow: "02 — The Campaigns",
    title: "The dispatch room.",
    body: "Schedule broadcasts, drip sequences, and Meta-approved templates that land at 94% open rate. Personalised with your CRM data, sent at the moment they’re most likely to convert.",
    bullets: [
      "Template designer with live preview",
      "Sequence builder with branching logic",
      "Send-time intelligence per contact",
    ],
    diagram: <CampaignDiagram />,
  },
  {
    eyebrow: "03 — The Storefront",
    title: "The point of sale.",
    body: "Catalog, cart, and checkout — inside the chat. Customers reply, pay, and receive without ever leaving WhatsApp. UPI, cards, COD — settled to your account by Wednesday.",
    bullets: [
      "Native WhatsApp catalog sync",
      "UPI, cards, and split payments",
      "Order tracking + post-purchase flows",
    ],
    diagram: <StoreDiagram />,
  },
];

function Pillars() {
  const reduce = useReducedMotion();
  return (
    <section id="sections" className="relative border-b" style={{ borderColor: TOKENS.ink }}>
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
        <div
          className="mb-10 flex items-baseline justify-between gap-4 border-b pb-3 text-[10.5px] uppercase tracking-[0.28em]"
          style={{ ...mono, borderColor: TOKENS.rule, color: TOKENS.inkSoft }}
        >
          <span>Section 03 · The Offering</span>
          <span className="hidden md:inline">Three ways to do business on WhatsApp</span>
        </div>

        <h2
          className="mb-14 max-w-[18ch] text-[clamp(2.4rem,5.5vw,5rem)] leading-[0.95] tracking-[-0.02em] md:mb-20"
          style={{ ...display }}
        >
          The newsroom of your
          <br />
          <span
            style={{
              fontStyle: "italic",
              fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
            }}
          >
            customer economy.
          </span>
        </h2>

        <ul className="grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-3 md:gap-y-0">
          {pillars.map((p, i) => (
            <motion.li
              key={p.eyebrow}
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 24 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{
                duration: 0.7,
                delay: i * 0.12,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`relative ${i !== 0 ? "md:pl-8 md:border-l" : "md:pr-8"} ${i === 1 ? "md:pr-8" : ""}`}
              style={{ borderColor: TOKENS.rule }}
            >
              <div
                className="text-[11px] uppercase tracking-[0.28em]"
                style={{ ...mono, color: TOKENS.accent }}
              >
                {p.eyebrow}
              </div>
              <h3
                className="mt-3 text-[clamp(1.7rem,2.4vw,2.4rem)] leading-[1.0] tracking-[-0.015em]"
                style={{
                  ...display,
                  fontStyle: "italic",
                  fontVariationSettings: '"opsz" 60, "SOFT" 100, "WONK" 0',
                }}
              >
                {p.title}
              </h3>
              <p
                className="mt-4 text-[15.5px] leading-[1.6]"
                style={{ color: TOKENS.inkSoft }}
              >
                {p.body}
              </p>
              <div className="mt-7">{p.diagram}</div>
              <ul
                className="mt-7 space-y-2 text-[12.5px] uppercase tracking-[0.16em]"
                style={mono}
              >
                {p.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-baseline gap-3 border-b pb-2"
                    style={{ borderColor: TOKENS.ruleSoft, color: TOKENS.ink }}
                  >
                    <span style={{ color: TOKENS.accent }}>—</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ----- Diagrams: tiny editorial illustrations in pure CSS/SVG --------------- */

function InboxDiagram() {
  return (
    <svg viewBox="0 0 280 110" className="block w-full" role="img" aria-label="Inbox routing diagram">
      <g fill="none" stroke={TOKENS.ink} strokeWidth="1">
        <rect x="2" y="6" width="120" height="22" />
        <rect x="2" y="34" width="120" height="22" />
        <rect x="2" y="62" width="120" height="22" fill={TOKENS.paperDeep} />
        <rect x="2" y="90" width="120" height="18" strokeDasharray="2 2" />
        <line x1="122" y1="17" x2="190" y2="17" />
        <line x1="122" y1="45" x2="190" y2="45" />
        <line x1="122" y1="73" x2="190" y2="73" />
        <circle cx="200" cy="17" r="8" fill={TOKENS.paper} />
        <circle cx="200" cy="45" r="8" fill={TOKENS.accent} stroke="none" />
        <circle cx="200" cy="73" r="8" fill={TOKENS.paper} />
        <line x1="208" y1="17" x2="268" y2="45" />
        <line x1="208" y1="45" x2="268" y2="45" />
        <line x1="208" y1="73" x2="268" y2="45" />
        <circle cx="272" cy="45" r="6" fill={TOKENS.ink} stroke="none" />
      </g>
      <g style={mono} fontSize="7" fill={TOKENS.inkQuiet} textAnchor="middle">
        <text x="62" y="100">— pending — assigned — resolved —</text>
      </g>
    </svg>
  );
}

function CampaignDiagram() {
  return (
    <svg viewBox="0 0 280 110" className="block w-full" role="img" aria-label="Campaign sequence diagram">
      <g stroke={TOKENS.ink} strokeWidth="1" fill="none">
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={i} x1={4 + i * 20} y1="6" x2={4 + i * 20} y2="76" strokeOpacity="0.12" />
        ))}
        <path d="M4 60 Q 40 8, 80 40 T 160 30 T 260 20" stroke={TOKENS.ink} strokeWidth="1.5" />
        <path d="M4 70 Q 40 50, 80 65 T 160 55 T 260 45" stroke={TOKENS.accent} strokeWidth="1.5" />
      </g>
      <g fill={TOKENS.ink}>
        <circle cx="4" cy="60" r="2.5" />
        <circle cx="80" cy="40" r="2.5" />
        <circle cx="160" cy="30" r="2.5" />
        <circle cx="260" cy="20" r="2.5" />
      </g>
      <g fill={TOKENS.accent}>
        <circle cx="4" cy="70" r="2.5" />
        <circle cx="80" cy="65" r="2.5" />
        <circle cx="160" cy="55" r="2.5" />
        <circle cx="260" cy="45" r="2.5" />
      </g>
      <g style={mono} fontSize="7" fill={TOKENS.inkQuiet}>
        <text x="4" y="98">drip · step 01</text>
        <text x="120" y="98">step 02</text>
        <text x="200" y="98">step 03 · convert</text>
      </g>
    </svg>
  );
}

function StoreDiagram() {
  return (
    <svg viewBox="0 0 280 110" className="block w-full" role="img" aria-label="Storefront order diagram">
      <g stroke={TOKENS.ink} strokeWidth="1" fill="none">
        <rect x="2" y="6" width="276" height="78" />
        <line x1="2" y1="24" x2="278" y2="24" />
        <line x1="180" y1="24" x2="180" y2="84" />
        <line x1="2" y1="44" x2="180" y2="44" strokeOpacity="0.4" />
        <line x1="2" y1="64" x2="180" y2="64" strokeOpacity="0.4" />
      </g>
      <g style={mono} fontSize="7.5" fill={TOKENS.ink}>
        <text x="8" y="18">ORDER #4831 · BOMBAY SWEET SHOP</text>
        <text x="186" y="18">SUBTOTAL</text>
        <text x="8" y="38">Kaju katli · 250 g</text>
        <text x="160" y="38" textAnchor="end" style={{ ...mono, ...tnum }}>₹ 950</text>
        <text x="8" y="58">Soan papdi · 500 g</text>
        <text x="160" y="58" textAnchor="end" style={{ ...mono, ...tnum }}>₹ 1,200</text>
        <text x="8" y="78">Delivery · Bandra W.</text>
        <text x="160" y="78" textAnchor="end" style={{ ...mono, ...tnum }}>₹ 300</text>
      </g>
      <g fill={TOKENS.ink}>
        <rect x="186" y="44" width="88" height="36" />
      </g>
      <g style={{ ...display, fontStyle: "italic" }} fontSize="22" fill={TOKENS.paper}>
        <text x="230" y="70" textAnchor="middle" style={tnum}>₹2,450</text>
      </g>
      <g style={mono} fontSize="6.5" fill={TOKENS.inkQuiet}>
        <text x="8" y="102">PAID via UPI · settled T+1 · receipt sent in-chat</text>
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Pull Quote — The Op-Ed                                                     */
/* -------------------------------------------------------------------------- */

function PullQuote() {
  const reduce = useReducedMotion();
  return (
    <section
      id="oped"
      className="relative border-b"
      style={{ borderColor: TOKENS.ink, background: TOKENS.paperSoft }}
    >
      <div className="mx-auto max-w-[1400px] px-6 py-20 md:py-28">
        <div
          className="mb-14 flex items-baseline justify-between gap-4 border-b pb-3 text-[10.5px] uppercase tracking-[0.28em]"
          style={{ ...mono, borderColor: TOKENS.rule, color: TOKENS.inkSoft }}
        >
          <span>Section 04 · From the Op-Ed</span>
          <span className="hidden md:inline">Filed for press, Mumbai · October</span>
        </div>

        <div className="grid grid-cols-12 gap-x-8 gap-y-10">
          <div className="col-span-12 md:col-span-2">
            <motion.div
              initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.92 }}
              whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                background: TOKENS.ink,
                color: TOKENS.paper,
              }}
            >
              <span
                style={{
                  ...display,
                  fontStyle: "italic",
                  fontSize: "2.2rem",
                  fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
                  lineHeight: 1,
                  paddingBottom: 4,
                }}
              >
                A
              </span>
            </motion.div>
          </div>

          <div className="col-span-12 md:col-span-10">
            <motion.div
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 20 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <span
                aria-hidden
                className="block leading-none"
                style={{
                  ...display,
                  fontStyle: "italic",
                  fontSize: "clamp(5rem, 9vw, 8rem)",
                  color: TOKENS.accent,
                  marginLeft: "-0.18em",
                  marginBottom: "-0.35em",
                  fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
                }}
              >
                “
              </span>
              <blockquote
                className="max-w-[34ch] text-[clamp(1.8rem,3.8vw,3.4rem)] leading-[1.15] tracking-[-0.015em]"
                style={{
                  ...display,
                  fontVariationSettings: '"opsz" 144, "SOFT" 50, "WONK" 0',
                }}
              >
                For the first time, our shop floor and our messages are the
                same room. We{" "}
                <span
                  style={{
                    fontStyle: "italic",
                    fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
                  }}
                >
                  close orders before the kettle boils.
                </span>
              </blockquote>
              <div
                className="mt-10 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.24em]"
                style={{ ...mono, color: TOKENS.inkSoft }}
              >
                <span>— Asha Mehta</span>
                <span style={{ color: TOKENS.inkQuiet }}>·</span>
                <span>Proprietress, Bombay Sweet Shop</span>
                <span style={{ color: TOKENS.inkQuiet }}>·</span>
                <span>On the wire since 2023</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Subscribe CTA                                                              */
/* -------------------------------------------------------------------------- */

function SubscribeCTA() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const reduce = useReducedMotion();

  return (
    <section
      className="relative border-b"
      style={{ borderColor: TOKENS.ink, background: TOKENS.ink, color: TOKENS.paper }}
    >
      <div className="mx-auto max-w-[1400px] px-6 py-20 md:py-28">
        <div
          className="mb-12 flex items-baseline justify-between gap-4 border-b pb-3 text-[10.5px] uppercase tracking-[0.28em]"
          style={{ ...mono, borderColor: "rgba(242,235,217,0.18)", color: "rgba(242,235,217,0.65)" }}
        >
          <span>Section 05 · Subscribe</span>
          <span className="hidden md:inline">Cancel by reply · no card needed</span>
        </div>

        <div className="grid grid-cols-12 gap-x-8 gap-y-10">
          <div className="col-span-12 md:col-span-7">
            <motion.h2
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 16 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(2.6rem,6.5vw,5.6rem)] leading-[0.95] tracking-[-0.02em]"
              style={{ ...display, color: TOKENS.paper }}
            >
              Subscribe
              <br />
              to the{" "}
              <span
                style={{
                  fontStyle: "italic",
                  color: TOKENS.accent,
                  fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
                }}
              >
                wire.
              </span>
            </motion.h2>
            <p
              className="mt-6 max-w-[40ch] text-[16px] leading-[1.6]"
              style={{ color: "rgba(242,235,217,0.78)" }}
            >
              Fourteen days. No credit card. Bring your number, your team, and
              your customers — keep what you build. We make money when you do.
            </p>
          </div>

          <div className="col-span-12 md:col-span-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email) setSubmitted(true);
              }}
              className="border"
              style={{ borderColor: "rgba(242,235,217,0.35)", background: "rgba(242,235,217,0.03)" }}
            >
              <div
                className="flex items-center justify-between border-b px-4 py-2.5 text-[10.5px] uppercase tracking-[0.24em]"
                style={{ ...mono, borderColor: "rgba(242,235,217,0.18)", color: "rgba(242,235,217,0.65)" }}
              >
                <span>Form · A-01</span>
                <span>Trial — 14 days</span>
              </div>
              <div className="p-5">
                <label
                  htmlFor="email"
                  className="block text-[11px] uppercase tracking-[0.22em]"
                  style={{ ...mono, color: "rgba(242,235,217,0.75)" }}
                >
                  Your work email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="asha@bombaysweetshop.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-3 w-full border-b bg-transparent pb-2 text-[18px] outline-none placeholder:text-[rgba(242,235,217,0.35)] focus:border-[#E14B27]"
                  style={{
                    borderColor: "rgba(242,235,217,0.45)",
                    color: TOKENS.paper,
                    fontFamily: "var(--font-sans)",
                  }}
                />
                <button
                  type="submit"
                  disabled={submitted}
                  className="group mt-6 flex w-full items-center justify-between border px-5 py-3.5 text-[13px] uppercase tracking-[0.18em] transition-colors disabled:opacity-60"
                  style={{
                    ...mono,
                    background: TOKENS.accent,
                    color: TOKENS.paper,
                    borderColor: TOKENS.accent,
                  }}
                  onMouseEnter={(e) => {
                    if (submitted) return;
                    e.currentTarget.style.background = TOKENS.paper;
                    e.currentTarget.style.color = TOKENS.ink;
                  }}
                  onMouseLeave={(e) => {
                    if (submitted) return;
                    e.currentTarget.style.background = TOKENS.accent;
                    e.currentTarget.style.color = TOKENS.paper;
                  }}
                >
                  <span>{submitted ? "Filed · check your inbox" : "Open my account"}</span>
                  <ArrowUpRight size={16} strokeWidth={1.75} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
                <p
                  className="mt-4 text-[11px] uppercase tracking-[0.18em]"
                  style={{ ...mono, color: "rgba(242,235,217,0.55)" }}
                >
                  By subscribing you agree to receive the wire daily. Reply
                  STOP to unsubscribe. SOC&nbsp;2 type II, DPDP compliant.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Colophon — Footer                                                          */
/* -------------------------------------------------------------------------- */

const colophon = [
  {
    head: "Sections",
    items: ["Inbox", "Campaigns", "Storefront", "Integrations", "Pricing"],
  },
  {
    head: "The Office",
    items: ["About", "Customers", "Editorial", "Careers", "Contact"],
  },
  {
    head: "The Wire",
    items: ["Status", "Changelog", "API", "Docs", "Security"],
  },
];

function Colophon() {
  return (
    <footer className="relative" style={{ borderColor: TOKENS.ink }}>
      <div className="mx-auto max-w-[1400px] px-6 py-16">
        <div className="grid grid-cols-12 gap-x-8 gap-y-12">
          <div className="col-span-12 md:col-span-5">
            <div
              className="text-[clamp(3.5rem,6vw,5rem)] leading-[0.92]"
              style={{
                ...display,
                fontStyle: "italic",
                fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
              }}
            >
              wApi
            </div>
            <p
              className="mt-4 max-w-[40ch] text-[14px] leading-[1.65]"
              style={{ color: TOKENS.inkSoft }}
            >
              The Business Wire is a daily-distributed messaging publication
              and platform. We are headquartered in Bangalore, with bureaux in
              Mumbai, Delhi NCR, and Bengaluru (yes, both).
            </p>
            <div
              className="mt-6 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.24em]"
              style={{ ...mono, color: TOKENS.inkQuiet }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: TOKENS.wire }}
              />
              <span>All systems on the wire</span>
            </div>
          </div>

          {colophon.map((col) => (
            <nav key={col.head} className="col-span-6 md:col-span-2">
              <div
                className="border-b pb-2 text-[10.5px] uppercase tracking-[0.28em]"
                style={{ ...mono, borderColor: TOKENS.rule, color: TOKENS.inkSoft }}
              >
                {col.head}
              </div>
              <ul className="mt-4 space-y-2 text-[14px]">
                {col.items.map((i) => (
                  <li key={i}>
                    <a
                      href="#"
                      className="inline-flex items-baseline gap-1 hover:underline"
                      style={{ textUnderlineOffset: 4, color: TOKENS.ink }}
                    >
                      <span style={{ color: TOKENS.accent }}>›</span> {i}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="col-span-12 md:col-span-1" />
        </div>

        <div
          className="mt-16 flex flex-col items-start justify-between gap-3 border-t pt-6 text-[10.5px] uppercase tracking-[0.22em] md:flex-row md:items-center"
          style={{ ...mono, borderColor: TOKENS.ink, color: TOKENS.inkSoft }}
        >
          <span>
            wApi Inc. · © MMXXV · Distributed daily from a cream paper press.
          </span>
          <span>
            Set in <em style={{ ...display, fontStyle: "italic" }}>Fraunces</em>{" "}
            &amp; Mona Sans. Numerals in IBM Plex Mono.
          </span>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* utils                                                                      */
/* -------------------------------------------------------------------------- */

function formatNow() {
  const d = new Date();
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
