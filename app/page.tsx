export default function Home() {
  return (
    <main style={{minHeight:'100vh', background:'#0b0e14', color:'#fff', padding:'80px 20px'}}>
      <section style={{maxWidth:980, margin:'0 auto', textAlign:'center'}}>
        <h1 style={{fontSize:48, margin:0, letterSpacing:.3}}>Coach your visitors at scale</h1>
        <p style={{fontSize:18, opacity:.85, marginTop:12}}>
          A high-leverage avatar that presents, answers, and books — like your best sales coach on autoplay.
        </p>
        <div style={{marginTop:24, display:'flex', gap:12, justifyContent:'center'}}>
          <a href="#demo" style={cta}>See it in action</a>
          <a href="mailto:hello@yourdomain" style={ghost}>Book a call</a>
        </div>
      </section>
    </main>
  );
}

const cta   = { padding:'12px 18px', background:'#1e90ff', color:'#fff', borderRadius:10, textDecoration:'none' };
const ghost = { padding:'12px 18px', border:'1px solid #2a2f3a', color:'#e2e8f0', borderRadius:10, textDecoration:'none' };
