import Link from 'next/link';

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(1200px 600px at 20% -20%, rgba(255,255,255,0.15), transparent), #0b0b0b',
        color: '#fff',
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 860,
          display: 'grid',
          gap: 20,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
          Retell ↔ HeyGen Avatar — Controls
        </h1>
        <p style={{ marginTop: 4, opacity: 0.8 }}>
          This is your helper homepage. Use the links below to test or embed the working
          avatar UI.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          <Card
            title="Open Embed UI"
            desc="The production embed used on your WordPress site. Includes poster, in-video controls, chat overlay, and mic."
            href="/embed"
            cta="Open /embed"
          />

          <Card
            title="Avatar Test"
            desc="Legacy test page used earlier in setup. Handy for basic checks if needed."
            href="/avatar"
            cta="Open /avatar"
          />

          <Card
            title="Diagnostics"
            desc="Basic route checks (tokens, session). Useful if something stops working."
            href="/diagnostics"
            cta="Run diagnostics"
          />
        </div>

        <div
          style={{
            marginTop: 12,
            padding: '12px 14px',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            fontSize: 14,
            lineHeight: 1.4,
          }}
        >
          <strong>Reminder:</strong> your WordPress site loads the <code>/embed</code>{' '}
          page inside an iframe via <code>public/widget.js</code>. If you ever need to
          tweak UI/behavior, edit <code>app/embed/page.tsx</code> and redeploy.
        </div>
      </div>
    </main>
  );
}

function Card({
  title,
  desc,
  href,
  cta,
}: {
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: 14,
        padding: 16,
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 18 }}>{title}</div>
      <div style={{ opacity: 0.85, fontSize: 14, lineHeight: 1.45 }}>{desc}</div>
      <div style={{ marginTop: 'auto' }}>
        <Link
          href={href}
          style={{
            display: 'inline-block',
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {cta} →
        </Link>
      </div>
    </div>
  );
}
