// Step 1: type text and watch its SHA-256 fingerprint; compare two near-identical inputs bit by bit;
// unlock the four properties with one-click experiments; optional proof-of-work teaser.
import React, { useEffect, useRef, useState } from 'react';
import { Fingerprint, Hammer, Lock, LockOpen } from 'lucide-react';
import EduTooltip from '../../../ui/EduTooltip';
import { define } from '../../glossary';
import { useDemoI18n } from '../../useDemoI18n';
import { leadingZeros, sha256Hex } from './sha256';
import { BitGrid, BitsChanged, CopyButton, HexDiff } from './ui';

const SECRET = 'pizza';
const SECRET_HASH = sha256Hex(SECRET);
const POW_ZEROS = 3;

type Props = {
  /** Called once two different inputs are compared side by side. */
  onAvalanche: () => void;
  announce: (text: string) => void;
  pulse: (key: string) => string;
};

export default function HashPlayground({ onAvalanche, announce, pulse }: Props) {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const LONG = tr(
    'A hash function turns any input, a word, a contract or a whole film, into a fingerprint of the same size. Change a single comma anywhere in this paragraph and the fingerprint becomes unrecognisable, yet anyone can recompute it and check that nothing was altered.'
  );
  const [a, setA] = useState('hello');
  const [b, setB] = useState('Hello');
  const [compare, setCompare] = useState(false);
  const [unlocked, setUnlocked] = useState({ deterministic: false, fixed: false, oneWay: false, collision: false });
  const [rehash, setRehash] = useState<string | null>(null);
  const [guess, setGuess] = useState('');
  const [guessResult, setGuessResult] = useState<'right' | 'wrong' | null>(null);
  const ha = sha256Hex(a);
  const hb = sha256Hex(b);

  useEffect(() => {
    if (compare && a !== b) onAvalanche();
  }, [compare, a, b, onAvalanche]);

  const preset = (x: string, y?: string) => {
    setA(x);
    if (y !== undefined) {
      setB(y);
      setCompare(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Single input */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <label className="text-sm font-semibold text-slate-200" htmlFor="hm-input-a">
          {compare ? tr('Input A') : tr('Your text')}
        </label>
        <textarea
          id="hm-input-a"
          value={a}
          onChange={(e) => setA(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">SHA-256</span>
          <CopyButton value={ha} />
          <span className="text-[11px] text-slate-500">{tr('{{n}} characters in → 64 hex characters out (256 bits)', { n: a.length })}</span>
        </div>
        <HexDiff value={ha} other={compare ? hb : undefined} className={compare ? '' : 'text-emerald-200'} />

        {compare ? (
          <div className="mt-4 border-t border-slate-800 pt-3">
            <label className="text-sm font-semibold text-slate-200" htmlFor="hm-input-b">
              {tr('Input B')}
            </label>
            <textarea
              id="hm-input-b"
              value={b}
              onChange={(e) => setB(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
            />
            <div className="mt-2 text-xs text-slate-400">SHA-256</div>
            <HexDiff value={hb} other={ha} />
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <BitGrid a={ha} b={hb} />
              <div className="max-w-sm space-y-2 text-sm text-slate-300">
                <BitsChanged a={ha} b={hb} />
                <p>
                  {a === b
                    ? tr('Same input, same fingerprint: every bit matches.')
                    : tr('The inputs differ by a little, the fingerprints by a lot: about half of the bits flip. This is the avalanche effect.')}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            data-hint="preset-hello"
            onClick={() => preset('hello', 'Hello')}
            className={`rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold hover:bg-blue-500 ${pulse('preset-hello')}`}
          >
            {tr('“hello” vs “Hello”')}
          </button>
          <button type="button" onClick={() => preset('')} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800">
            {tr('Empty text')}
          </button>
          <button
            type="button"
            onClick={() => {
              preset(LONG);
              setUnlocked((u) => ({ ...u, fixed: true }));
            }}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800"
          >
            {tr('A long paragraph')}
          </button>
          <button
            type="button"
            onClick={() => setCompare((c) => !c)}
            aria-pressed={compare}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800"
          >
            {compare ? tr('Hide comparison') : tr('Compare two inputs')}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {tr('A hash is not encryption: there is no key and no way to turn the fingerprint back into the text.')}
        </p>
      </div>

      {/* Property cards */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Fingerprint size={16} className="text-blue-300" />
          {tr('Four properties, four experiments')}
          <EduTooltip text={define('Hash Function')} />
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <PropertyCard
            title={tr('Deterministic')}
            unlocked={unlocked.deterministic}
            text={tr('The same input always gives the same fingerprint, on any computer.')}
          >
            <button
              type="button"
              onClick={() => {
                setRehash(sha256Hex(a));
                setUnlocked((u) => ({ ...u, deterministic: true }));
              }}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
            >
              {tr('Hash my text again')}
            </button>
            {rehash ? (
              <div className="mt-1 text-xs text-emerald-300">
                ✓ {rehash === ha ? tr('Identical: {{h}}…', { h: rehash.slice(0, 16) }) : tr('Your text changed since; hash it again.')}
              </div>
            ) : null}
          </PropertyCard>
          <PropertyCard
            title={tr('Fixed size')}
            unlocked={unlocked.fixed}
            text={tr('One letter or a whole book: the fingerprint is always 256 bits (64 hex characters).')}
          >
            <button
              type="button"
              onClick={() => {
                preset(LONG);
                setUnlocked((u) => ({ ...u, fixed: true }));
              }}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
            >
              {tr('Hash a long paragraph')}
            </button>
            {unlocked.fixed ? <div className="mt-1 text-xs text-emerald-300">✓ {tr('{{n}} characters in, still 64 out.', { n: LONG.length })}</div> : null}
          </PropertyCard>
          <PropertyCard
            title={tr('One-way')}
            unlocked={unlocked.oneWay}
            text={tr('You can’t work backwards from a fingerprint. The only way is to guess inputs and hash them.')}
          >
            <div className="text-xs text-slate-300">
              {tr('Which word (a 5-letter food) has this fingerprint?')}
              <code className="mt-1 block break-all font-mono text-[11px] text-amber-200">{SECRET_HASH}</code>
            </div>
            <form
              className="mt-1 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const ok = sha256Hex(guess.trim().toLowerCase()) === SECRET_HASH;
                setGuessResult(ok ? 'right' : 'wrong');
                setUnlocked((u) => ({ ...u, oneWay: true }));
                announce(ok ? tr('Correct guess.') : tr('Wrong guess.'));
              }}
            >
              <input
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                aria-label={tr('Your guess')}
                className="w-28 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              />
              <button type="submit" className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800">
                {tr('Check my guess')}
              </button>
            </form>
            {guessResult ? (
              <div className={`mt-1 text-xs ${guessResult === 'right' ? 'text-emerald-300' : 'text-amber-200'}`}>
                {guessResult === 'right'
                  ? tr('✓ Right, but only because the list of 5-letter foods is short. With a long random input, guessing is hopeless.')
                  : tr('✗ No match. The fingerprint gives no hint about how close you are: you can only keep guessing.')}
              </div>
            ) : null}
          </PropertyCard>
          <PropertyCard
            title={tr('Collision resistant')}
            unlocked={unlocked.collision}
            text={tr('Nobody can find two different inputs with the same fingerprint, though they must exist in theory.')}
          >
            <button
              type="button"
              onClick={() => setUnlocked((u) => ({ ...u, collision: true }))}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
            >
              {tr('Why can’t we find one?')}
            </button>
            {unlocked.collision ? (
              <div className="mt-1 text-xs text-slate-300">
                {tr(
                  'With 2²⁵⁶ possible fingerprints, finding a collision takes about 2¹²⁸ tries. Even a billion computers doing a billion hashes per second would need far longer than the age of the universe.'
                )}
              </div>
            ) : null}
          </PropertyCard>
        </div>
      </div>

      <PowTeaser />
    </div>
  );
}

function PropertyCard({ title, text, unlocked, children }: { title: string; text: string; unlocked: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 ${unlocked ? 'border-emerald-800 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/50'}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        {unlocked ? <LockOpen size={14} className="text-emerald-300" aria-hidden /> : <Lock size={14} className="text-slate-500" aria-hidden />}
        {title}
      </div>
      <p className="mt-1 text-xs text-slate-300">{text}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** "Find an input whose hash starts with 000": counts attempts, mines in chunks so the page stays responsive. */
function PowTeaser() {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const [text, setText] = useState(tr('My block'));
  const [nonce, setNonce] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [mining, setMining] = useState(false);
  const stop = useRef(false);
  const hash = sha256Hex(`${text}${nonce}`);
  const found = leadingZeros(hash) >= POW_ZEROS;

  const mine = () => {
    stop.current = false;
    setMining(true);
    let n = nonce;
    let tries = 0;
    const chunk = () => {
      for (let k = 0; k < 500; k++) {
        tries++;
        if (leadingZeros(sha256Hex(`${text}${n}`)) >= POW_ZEROS) {
          setNonce(n);
          setAttempts((x) => x + tries);
          setMining(false);
          return;
        }
        n++;
      }
      setNonce(n);
      setAttempts((x) => x + tries);
      tries = 0;
      if (!stop.current) window.setTimeout(chunk, 0);
      else setMining(false);
    };
    chunk();
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Hammer size={16} className="text-amber-300" />
        {tr('Bonus: find a fingerprint that starts with 000')}
        <EduTooltip text={define('Nonce')} />
      </h3>
      <p className="mt-1 text-xs text-slate-400">
        {tr('Since you can’t predict a hash, the only way is to try: add a number (the nonce) and count up until you get lucky. That is proof of work.')}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAttempts(0);
          }}
          aria-label={tr('Block text')}
          className="w-40 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
        />
        <span className="text-xs text-slate-400">+ {tr('nonce')}</span>
        <input
          type="number"
          min={0}
          value={nonce}
          onChange={(e) => setNonce(Math.max(0, Number(e.target.value) || 0))}
          aria-label={tr('Nonce')}
          className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => (mining ? (stop.current = true) : mine())}
          disabled={found && !mining}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500 disabled:opacity-40"
        >
          <Hammer size={14} />
          {mining ? tr('Stop') : tr('Mine (try nonces)')}
        </button>
        <span className="text-xs text-slate-400">{tr('Attempts: {{n}}', { n: attempts.toLocaleString() })}</span>
      </div>
      <code className={`mt-2 block break-all font-mono text-xs ${found ? 'text-emerald-300' : 'text-slate-400'}`}>
        <span className={found ? 'rounded bg-emerald-500/20 font-bold' : ''}>{hash.slice(0, POW_ZEROS)}</span>
        {hash.slice(POW_ZEROS)}
      </code>
      {found ? (
        <p className="mt-1 text-xs text-emerald-300">
          {tr('✓ Found! On average it takes 4,096 tries (16 × 16 × 16). Real blockchains ask for many more zeros.')}{' '}
          <a href="/demo/ethereum-blockchain" className="underline hover:text-emerald-200">
            {tr('Mine real blocks in the Minimal Ethereum demo →')}
          </a>
        </p>
      ) : null}
    </div>
  );
}
