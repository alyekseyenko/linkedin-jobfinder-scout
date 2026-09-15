import { Player } from '@lottiefiles/react-lottie-player';

interface LottieLoaderProps {
  type?: 'analyzing' | 'success' | 'empty';
  size?: number;
  className?: string;
}

// Inline minimal Lottie JSONs (lightweight, no external fetch needed)
const ANIMATIONS = {
  analyzing: {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 200,
    h: 200,
    nm: 'Neural Pulse',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0, ind: 1, ty: 4, nm: 'Ring 1', sr: 1,
        ks: { o: { a: 1, k: [{ t: 0, s: [30] }, { t: 30, s: [80] }, { t: 60, s: [30] }] }, r: { a: 1, k: [{ t: 0, s: [0] }, { t: 60, s: [360] }] }, p: { a: 0, k: [100, 100, 0] }, s: { a: 0, k: [100, 100, 100] } },
        ao: 0,
        shapes: [{ ty: 'el', s: { a: 0, k: [80, 80] }, p: { a: 0, k: [0, 0] }, nm: 'E', mn: 'ADBE Vector Shape - Ellipse' }, { ty: 'st', c: { a: 0, k: [0, 1, 0.61, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 2 } }, { ty: 'fl', c: { a: 0, k: [0, 0, 0, 0] }, o: { a: 0, k: 0 } }, { ty: 'tr', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] } }],
        ip: 0, op: 60, st: 0, bm: 0
      }
    ]
  },
  success: {
    v: '5.7.4',
    fr: 30, ip: 0, op: 45, w: 200, h: 200,
    nm: 'Check', ddd: 0, assets: [],
    layers: [
      {
        ddd: 0, ind: 1, ty: 4, nm: 'Check', sr: 1,
        ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [100, 100, 0] }, s: { a: 0, k: [100, 100, 100] } },
        ao: 0,
        shapes: [
          { ty: 'sh', ks: { a: 1, k: [{ t: 0, s: [{ i: [[0,0],[0,0],[0,0]], o: [[0,0],[0,0],[0,0]], v: [[100,100],[100,100],[100,100]], c: false }] }, { t: 45, s: [{ i: [[0,0],[0,0],[0,0]], o: [[0,0],[0,0],[0,0]], v: [[60,105],[85,130],[140,70]], c: false }] }] } },
          { ty: 'st', c: { a: 0, k: [0, 1, 0.61, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 4 }, lc: 2, lj: 2 },
          { ty: 'tr', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] } }
        ],
        ip: 0, op: 45, st: 0, bm: 0
      }
    ]
  },
  empty: {
    v: '5.7.4',
    fr: 30, ip: 0, op: 120, w: 200, h: 200,
    nm: 'Float', ddd: 0, assets: [],
    layers: [
      {
        ddd: 0, ind: 1, ty: 4, nm: 'Orb', sr: 1,
        ks: { o: { a: 0, k: 30 }, r: { a: 0, k: 0 }, p: { a: 1, k: [{ t: 0, s: [100, 110, 0] }, { t: 60, s: [100, 90, 0] }, { t: 120, s: [100, 110, 0] }] }, s: { a: 0, k: [100, 100, 100] } },
        ao: 0,
        shapes: [{ ty: 'el', s: { a: 0, k: [60, 60] }, p: { a: 0, k: [0, 0] } }, { ty: 'fl', c: { a: 0, k: [0, 0.82, 0.61, 1] }, o: { a: 0, k: 100 } }, { ty: 'tr', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] } }],
        ip: 0, op: 120, st: 0, bm: 0
      }
    ]
  }
};

export default function LottieLoader({ type = 'analyzing', size = 80, className = '' }: LottieLoaderProps) {
  return (
    <Player
      autoplay
      loop
      src={ANIMATIONS[type] as any}
      style={{ width: size, height: size }}
      className={className}
    />
  );
}
