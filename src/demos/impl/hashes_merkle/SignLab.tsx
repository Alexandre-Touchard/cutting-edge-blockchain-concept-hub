// Step 4: generate a key pair, sign a message, verify it, then break verification three ways.
import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, PenLine, ShieldCheck, ShieldX } from 'lucide-react';
import EduTooltip from '../../../ui/EduTooltip';
import { define } from '../../glossary';
import { useDemoI18n } from '../../useDemoI18n';
import { cryptoAvailable, flipHexChar, generateKeyPair, signMessage, verifyMessage, type KeyPair } from './signatures';
import { CopyButton } from './ui';

type Props = {
  onVerified: () => void;
  onFailureShown: () => void;
  announce: (text: string) => void;
  pulse: (key: string) => string;
};

type Result = { ok: boolean; reasons: ('message' | 'key' | 'signature')[] };

export default function SignLab({ onVerified, onFailureShown, announce, pulse }: Props) {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const [mine, setMine] = useState<KeyPair | null>(null);
  const [other, setOther] = useState<KeyPair | null>(null);
  const [reveal, setReveal] = useState(false);
  const [message, setMessage] = useState(tr('Pay Bob 5 coins'));
  const [signed, setSigned] = useState<{ message: string; sig: string } | null>(null);
  // Verify panel inputs (start as a copy of what was signed)
  const [vMessage, setVMessage] = useState('');
  const [vSig, setVSig] = useState('');
  const [vKey, setVKey] = useState<'mine' | 'other'>('mine');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const available = cryptoAvailable();

  const generate = async () => {
    setBusy(true);
    const [k1, k2] = await Promise.all([generateKeyPair(), generateKeyPair()]);
    setMine(k1);
    setOther(k2);
    setSigned(null);
    setResult(null);
    setBusy(false);
    announce(tr('New key pair generated.'));
  };

  const sign = async () => {
    if (!mine) return;
    const sig = await signMessage(mine.privateKey, message);
    setSigned({ message, sig });
    setVMessage(message);
    setVSig(sig);
    setVKey('mine');
    setResult(null);
  };

  const verify = async (msg = vMessage, sig = vSig, key = vKey) => {
    if (!mine || !other || !signed) return;
    const ok = await verifyMessage((key === 'mine' ? mine : other).publicHex, msg, sig);
    const reasons: Result['reasons'] = [];
    if (msg !== signed.message) reasons.push('message');
    if (key !== 'mine') reasons.push('key');
    if (sig !== signed.sig) reasons.push('signature');
    setResult({ ok, reasons });
    announce(ok ? tr('Signature valid.') : tr('Signature invalid.'));
    if (ok) onVerified();
    else onFailureShown();
  };

  const breakIt = (what: 'message' | 'key' | 'signature') => {
    if (!signed) return;
    const msg = what === 'message' ? changeOneChar(signed.message) : signed.message;
    const sig = what === 'signature' ? flipHexChar(signed.sig, 20) : signed.sig;
    const key = what === 'key' ? 'other' : 'mine';
    setVMessage(msg);
    setVSig(sig);
    setVKey(key);
    void verify(msg, sig, key);
  };

  if (!available) {
    return (
      <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-100">
        {tr('Your browser only allows the Web Crypto API on secure pages (https or localhost), so signatures are unavailable here.')}
      </div>
    );
  }

  const explain: Record<Result['reasons'][number], string> = {
    message: tr('The message changed: the signature only fits the exact message that was signed, so any edit is detected.'),
    key: tr('Wrong public key: the signature was made with your private key, so only your public key accepts it. This is how a wallet checks who sent a transaction.'),
    signature: tr('The signature changed: a single altered character makes it invalid. Nobody can tweak a signature to fit another message.')
  };

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-300">
        {tr('A signature is a stamp only you can make, that anyone can check. You keep a private key secret and publish the matching public key.')}{' '}
        <EduTooltip term={tr('private key')} text={define('Private Key')} /> ·{' '}
        <EduTooltip term={tr('public key')} text={define('Public Key')} />
      </p>

      {/* 1. Keys */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <KeyRound size={16} className="text-amber-300" />
            {tr('1. Your key pair')}
          </h3>
          <button
            type="button"
            data-hint="gen-keys"
            onClick={generate}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold hover:bg-blue-500 disabled:opacity-50 ${pulse('gen-keys')}`}
          >
            <KeyRound size={14} />
            {mine ? tr('Generate a new pair') : tr('Generate key pair')}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-amber-200">
          {tr('Demo keys, generated in your browser and never stored or sent. Never use them for real funds.')}
        </p>
        {mine ? (
          <div className="mt-3 space-y-2 text-xs">
            <div>
              <div className="flex items-center gap-2 text-slate-400">
                {tr('Public key (share it)')} <CopyButton value={mine.publicHex} />
              </div>
              <code className="block break-all font-mono text-emerald-200">{mine.publicHex}</code>
            </div>
            <div>
              <div className="flex items-center gap-2 text-slate-400">
                {tr('Private key (keep it secret)')}
                <button
                  type="button"
                  onClick={() => setReveal((r) => !r)}
                  className="inline-flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
                  aria-pressed={reveal}
                >
                  {reveal ? <EyeOff size={12} /> : <Eye size={12} />}
                  {reveal ? tr('Hide') : tr('Reveal')}
                </button>
              </div>
              <code className="block break-all font-mono text-red-200">{reveal ? mine.privateHex : '•'.repeat(64)}</code>
            </div>
          </div>
        ) : null}
      </section>

      {/* 2. Sign */}
      <section className={`rounded-xl border border-slate-800 bg-slate-900/50 p-4 ${mine ? '' : 'opacity-50'}`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <PenLine size={16} className="text-blue-300" />
          {tr('2. Sign a message')}
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!mine}
            aria-label={tr('Message to sign')}
            className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
          />
          <button
            type="button"
            data-hint="sign-btn"
            onClick={sign}
            disabled={!mine}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold hover:bg-blue-500 disabled:opacity-50 ${pulse('sign-btn')}`}
          >
            <PenLine size={14} />
            {tr('Sign with my private key')}
          </button>
        </div>
        {signed ? (
          <div className="mt-2 text-xs">
            <div className="text-slate-400">{tr('Signature')}</div>
            <code className="block break-all font-mono text-blue-200">{signed.sig}</code>
            <p className="mt-1 text-slate-500">{tr('Sign the same message again and you get a different signature: ECDSA mixes in a random number each time. Both verify.')}</p>
          </div>
        ) : null}
      </section>

      {/* 3. Verify */}
      <section className={`rounded-xl border border-slate-800 bg-slate-900/50 p-4 ${signed ? '' : 'opacity-50'}`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <ShieldCheck size={16} className="text-emerald-300" />
          {tr('3. Anyone can verify')}
        </h3>
        <div className="mt-2 grid gap-2 text-xs">
          <label>
            <span className="text-slate-400">{tr('Message')}</span>
            <input
              value={vMessage}
              onChange={(e) => setVMessage(e.target.value)}
              disabled={!signed}
              className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
            />
          </label>
          <label>
            <span className="text-slate-400">{tr('Signature')}</span>
            <textarea
              value={vSig}
              onChange={(e) => setVSig(e.target.value.trim())}
              disabled={!signed}
              rows={2}
              className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs"
            />
          </label>
          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="mb-1 text-slate-400">{tr('Public key used to check')}</legend>
            <label className="inline-flex items-center gap-1">
              <input type="radio" checked={vKey === 'mine'} onChange={() => setVKey('mine')} disabled={!signed} /> {tr('Yours')}
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="radio" checked={vKey === 'other'} onChange={() => setVKey('other')} disabled={!signed} /> {tr('Someone else’s')}
            </label>
          </fieldset>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            data-hint="verify-btn"
            onClick={() => void verify()}
            disabled={!signed}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50 ${pulse('verify-btn')}`}
          >
            <ShieldCheck size={14} />
            {tr('Verify')}
          </button>
          <span className="self-center text-xs text-slate-400">{tr('Try to break it:')}</span>
          <div data-hint="break-sig" className={`flex flex-wrap gap-2 rounded-lg ${pulse('break-sig')}`}>
            <button type="button" disabled={!signed} onClick={() => breakIt('message')} className="rounded-md border border-red-800 px-2 py-1 text-xs text-red-200 hover:bg-red-950/50 disabled:opacity-50">
              {tr('Change one letter of the message')}
            </button>
            <button type="button" disabled={!signed} onClick={() => breakIt('key')} className="rounded-md border border-red-800 px-2 py-1 text-xs text-red-200 hover:bg-red-950/50 disabled:opacity-50">
              {tr('Use someone else’s public key')}
            </button>
            <button type="button" disabled={!signed} onClick={() => breakIt('signature')} className="rounded-md border border-red-800 px-2 py-1 text-xs text-red-200 hover:bg-red-950/50 disabled:opacity-50">
              {tr('Change one character of the signature')}
            </button>
          </div>
        </div>
        {result ? (
          <div
            className={`mt-3 rounded-lg border p-3 text-sm ${result.ok ? 'border-emerald-800 bg-emerald-950/30 text-emerald-100' : 'border-red-800 bg-red-950/30 text-red-100'}`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {result.ok ? <ShieldCheck size={16} /> : <ShieldX size={16} />}
              {result.ok ? tr('✓ Valid signature') : tr('✗ Invalid signature')}
            </div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
              {result.ok ? (
                <li>{tr('Whoever holds the private key approved exactly this message.')}</li>
              ) : (
                result.reasons.map((r) => <li key={r}>{explain[r]}</li>)
              )}
            </ul>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-slate-400">
          {tr('What a signature does not prove: who the key holder is in real life, or that the message is true. If someone steals your private key, their signatures look exactly like yours.')}
        </p>
      </section>
    </div>
  );
}

/** Change one letter in the middle of a message (or add one to an empty message). */
function changeOneChar(s: string): string {
  if (!s) return '!';
  const i = Math.floor(s.length / 2);
  const c = s[i];
  const repl = c === 'x' ? 'y' : /[a-z]/.test(c) ? c.toUpperCase() : c === 'X' ? 'Y' : 'x';
  return s.slice(0, i) + repl + s.slice(i + 1);
}
