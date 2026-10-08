/* Coach DNA: cinco propuestas de logo. Todas usan currentColor + var(--logo-acc) para seguir la paleta activa. */

export type LogoKind = 'helix' | 'pizarra' | 'huella' | 'balon' | 'monograma'
export const LOGOS: LogoKind[] = ['helix']

/** Hélice mínima: dos hebras finas, una sola vuelta y dos peldaños; mide lo mismo que las mayúsculas. */
function Helix() {
  const N = 40, H = 30, W = 14, turns = 1
  const x = (t: number, s: number) => 8 + s * (W / 2) * Math.sin(t * Math.PI * 2 * turns + Math.PI / 2)
  const pts = (s: number) => Array.from({ length: N + 1 }, (_, i) => i / N).map(t => `${x(t, s).toFixed(2)},${(1 + t * H).toFixed(2)}`).join(' ')
  const rung = (t: number) => <line x1={x(t, 1)} x2={x(t, -1)} y1={1 + t * H} y2={1 + t * H} stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" opacity={0.45} />
  return (
    <svg viewBox="0 0 16 32" aria-hidden>
      {rung(0.12)}{rung(0.88)}
      <polyline points={pts(1)} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <polyline points={pts(-1)} fill="none" stroke="var(--logo-acc)" strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  )
}

/** 2 · Pizarra táctica: X y O unidos por una flecha que se enrosca como hélice. */
function Pizarra() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <rect x={2} y={2} width={44} height={44} rx={9} fill="none" stroke="currentColor" strokeWidth={2.4} />
      <path d="M10 12 l7 7 M17 12 l-7 7" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={35} cy={35} r={5} fill="none" stroke="var(--logo-acc)" strokeWidth={2.8} />
      <path d="M14 25 C 20 16, 26 34, 30 24 S 34 18, 33 28" fill="none" stroke="var(--logo-acc)" strokeWidth={2.4} strokeLinecap="round" strokeDasharray="0.1 4.2" />
      <path d="M29.5 26.5 l3.6 2.2 l1.2 -4" fill="none" stroke="var(--logo-acc)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 3 · Huella-círculo central: una huella digital que es a la vez el círculo central de la cancha. */
function Huella() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <line x1={24} y1={1} x2={24} y2={47} stroke="currentColor" strokeWidth={2} opacity={0.35} />
      {[6, 10, 14, 18, 22].map((r, i) => (
        <path key={r} d={`M ${24 - r} 24 A ${r} ${r} 0 1 1 ${24 + r * Math.cos(0.5 + i * 0.25)} ${24 + r * Math.sin(0.5 + i * 0.25)}`}
          fill="none" stroke={i === 2 ? 'var(--logo-acc)' : 'currentColor'} strokeWidth={2.3} strokeLinecap="round" />
      ))}
      <circle cx={24} cy={24} r={2.2} fill="var(--logo-acc)" />
    </svg>
  )
}

/** 4 · Balón con hélice: las costuras del balón son una doble hélice. */
function Balon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <circle cx={24} cy={24} r={21} fill="none" stroke="currentColor" strokeWidth={2.6} />
      <path d="M10 9 C 30 18, 18 30, 38 39" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M38 9 C 18 18, 30 30, 10 39" fill="none" stroke="var(--logo-acc)" strokeWidth={2.6} strokeLinecap="round" />
      {[[17.5, 14.5, 30.5, 14.5], [16.5, 24, 31.5, 24], [17.5, 33.5, 30.5, 33.5]].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={1.5} opacity={0.5} />
      ))}
    </svg>
  )
}

/** 5 · Monograma: una "C" que es el arco del área y una hélice dentro. */
function Monograma() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <path d="M40 10 A 19 19 0 1 0 40 38" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" />
      <path d="M22 14 C 34 19, 22 29, 34 34" fill="none" stroke="var(--logo-acc)" strokeWidth={3} strokeLinecap="round" />
      <path d="M34 14 C 22 19, 34 29, 22 34" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" opacity={0.75} />
      <line x1={24} y1={19.5} x2={32} y2={19.5} stroke="currentColor" strokeWidth={1.5} opacity={0.5} />
      <line x1={24} y1={28.5} x2={32} y2={28.5} stroke="currentColor" strokeWidth={1.5} opacity={0.5} />
    </svg>
  )
}

const MARKS: Record<LogoKind, () => React.ReactElement> = { helix: Helix, pizarra: Pizarra, huella: Huella, balon: Balon, monograma: Monograma }

/** Logo completo: marca + palabra "COACH DNA" (DNA en el color de acento). */
export default function Logo({ kind = 'helix', size = 34, word = true, sub }: { kind?: LogoKind; size?: number; word?: boolean; sub?: string }) {
  const M = MARKS[kind]
  return (
    <span className="logo" style={{ ['--logo-size' as string]: `${size}px` }}>
      <span className="logo-mark"><M /></span>
      {word && <span className="logo-word"><b>COACH</b><b className="logo-dna">DNA</b>{sub && <small>{sub}</small>}</span>}
    </span>
  )
}
