import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/app/toast';
import { classifyAddress, shortAddress } from '@/core/keys';
import { isPayLink, parsePayLink } from '@/core/stellar';
import { CloseButton, Header, Screen } from '@/ui/Screen';
import { IconCheck, IconTorch } from '@/ui/Icons';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

function getDetector(): BarcodeDetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return w.BarcodeDetector ?? null;
}

/**
 * Camera QR scanner using the browser's BarcodeDetector (Chrome, Edge, Android,
 * recent Safari). Where it isn't available the screen says so and offers paste.
 */
export function Scan() {
  const navigate = useNavigate();
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [supported] = useState(() => !!getDetector() && !!navigator.mediaDevices?.getUserMedia);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'denied' | 'error'>('starting');
  const [found, setFound] = useState<{ to: string; query: string } | null>(null);
  const [torch, setTorch] = useState(false);
  const [torchOk, setTorchOk] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    let raf = 0;
    const Detector = getDetector()!;
    const detector = new Detector({ formats: ['qr_code'] });
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorchOk(!!caps.torch);
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setStatus('scanning');
        const loop = async () => {
          if (cancelled) return;
          try {
            if (v.readyState >= 2) {
              const codes = await detector.detect(v);
              const hit = codes.find((c) => c.rawValue);
              if (hit) {
                handle(hit.rawValue);
                return;
              }
            }
          } catch {
            /* keep scanning */
          }
          raf = window.setTimeout(loop, 250) as unknown as number;
        };
        void loop();
      } catch (e) {
        setStatus((e as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'error');
      }
    })();
    const handle = (raw: string) => {
      const s = raw.trim();
      if (isPayLink(s)) {
        const p = parsePayLink(s);
        if ('error' in p) {
          toast(p.error, 'warn');
          return;
        }
        const q = new URLSearchParams({ to: p.destination });
        if (p.amount) q.set('amount', p.amount);
        if (p.memo && p.memoType === 'text') q.set('memo', p.memo);
        if (p.asset.issuer) q.set('asset', `${p.asset.code}:${p.asset.issuer}`);
        setFound({ to: p.destination, query: q.toString() });
        return;
      }
      const addr = s.replace(/^stellar:/i, '');
      if (classifyAddress(addr) === 'valid') {
        setFound({ to: addr, query: new URLSearchParams({ to: addr }).toString() });
        return;
      }
      toast("That QR code isn't a Stellar address or payment link.", 'warn');
    };
    return () => {
      cancelled = true;
      window.clearTimeout(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [supported, toast]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch((t) => !t);
    } catch {
      toast('Torch not available on this camera', 'warn');
    }
  };

  const title = found ? 'Stellar address found' : !supported ? 'Scanning needs a newer browser' : status === 'denied' ? 'Camera blocked' : status === 'error' ? "Couldn't start the camera" : 'Point at a Stellar QR code';
  const text = found
    ? "Checked: it's a valid public address."
    : !supported
      ? 'This browser has no built-in QR detector. Chrome, Edge and recent Safari do. You can paste the address instead.'
      : status === 'denied'
        ? 'Allow camera access in your browser settings, or paste the address instead.'
        : "Works with any wallet's receive code. Payment links with an amount fill in the send form for you.";

  return (
    <Screen>
      <Header
        left={<CloseButton to="/home" />}
        title="Scan"
        right={
          torchOk ? (
            <button type="button" onClick={toggleTorch} aria-label="Toggle torch" aria-pressed={torch} className="icon-btn">
              <IconTorch />
            </button>
          ) : undefined
        }
      />
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 py-4">
        <div className="relative h-[260px] w-[260px] overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_50%_40%,#26262F_0%,#121216_70%)]">
          {supported && <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />}
          <span className="absolute left-[18px] top-[18px] h-9 w-9 rounded-tl-xl border-l-[3px] border-t-[3px] border-accent" />
          <span className="absolute right-[18px] top-[18px] h-9 w-9 rounded-tr-xl border-r-[3px] border-t-[3px] border-accent" />
          <span className="absolute bottom-[18px] left-[18px] h-9 w-9 rounded-bl-xl border-b-[3px] border-l-[3px] border-accent" />
          <span className="absolute bottom-[18px] right-[18px] h-9 w-9 rounded-br-xl border-b-[3px] border-r-[3px] border-accent" />
          {status === 'scanning' && !found && <span className="absolute left-[30px] right-[30px] top-1/2 h-0.5 bg-accent opacity-70 animate-pulse-soft" />}
          {found && (
            <span className="absolute inset-0 flex items-center justify-center bg-ground/60 text-good animate-pop">
              <IconCheck className="h-14 w-14" strokeWidth={3} />
            </span>
          )}
        </div>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <span className="text-[17px] font-semibold">{title}</span>
          <span className="max-w-[280px] text-sm leading-relaxed text-muted">{text}</span>
        </div>
        {found && (
          <div className="card flex items-center gap-2.5 px-3.5 py-3 animate-pop">
            <span className="font-mono text-[13px]">{shortAddress(found.to)}</span>
            <button type="button" onClick={() => navigate(`/send?${found.query}`)} className="btn-primary ml-auto h-10 px-3.5 text-sm">
              Send to this address
            </button>
          </div>
        )}
      </main>
      <footer className="flex flex-col gap-2 px-4 pb-6 pt-2">
        <Link to="/send" className="btn-secondary">
          Paste an address instead
        </Link>
      </footer>
    </Screen>
  );
}
