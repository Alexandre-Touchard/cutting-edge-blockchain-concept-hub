import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Coins, Flame, Images, Layers, Plus, ShieldCheck } from 'lucide-react';
import EduTooltip from '../../ui/EduTooltip';
import LinkWithCopy from '../../ui/LinkWithCopy';
import { defineMaybe } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';
import { ERC_STANDARDS, type StandardId, type Standard } from '../ercStandardsConfig';

type TrFn = (english: string, opts?: Record<string, unknown>) => string;

export const demoMeta = {
  id: 'erc-standards',
  title: 'ERC Standards Playground',
  category: 'defi',
  difficulty: 'Beginner',
  thumbnail: '[ERC]',
  description:
    'Explore multiple ERC standards on one page. Start with ERC-20, ERC-721, and ERC-1155 with interactive actions, tooltips, real-world context, and further reading.',
  concepts: ['ERC Standards', 'ERC-20', 'ERC-721', 'ERC-1155', 'Approval'],
  keyTakeaways: [
    'ERC standards define interoperable interfaces so wallets, dApps, and exchanges can support assets consistently',
    'ERC-20 is fungible, ERC-721 is non-fungible, and ERC-1155 is multi-token (fungible + NFTs) in one contract',
    'Approvals/allowances are a core UX + security surface across standards'
  ],
  tags: ['Tokens', 'NFTs', 'Standards', 'EVM']
};

type Address = 'Alice' | 'Bob' | 'Carol' | 'Dex';
const ADDRESSES: Address[] = ['Alice', 'Bob', 'Carol', 'Dex'];

const T = EduTooltip;
function def(term: string): string {
  return defineMaybe(term) ?? 'Definition coming soon.';
}

const STANDARDS: Standard[] = ERC_STANDARDS;

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold mb-3 text-blue-300">{children}</h2>;
}

function AddressSelect({ value, onChange, label }: { value: Address; onChange: (v: Address) => void; label: string }) {
  return (
    <label className="text-sm text-slate-300 flex flex-col gap-1">
      <span className="text-slate-400">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as Address)} className="bg-slate-900 border border-slate-700 rounded px-3 py-2">
        {ADDRESSES.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function AmountInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <label className="text-sm text-slate-300 flex flex-col gap-1">
      <span className="text-slate-400">{label}</span>
      <input type="number" min={0} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Math.max(0, Number(e.target.value)))} className="bg-slate-900 border border-slate-700 rounded px-3 py-2" />
    </label>
  );
}

function RealWorldApplications({
  items,
  tr
}: {
  items: Array<{ title: string; href: string; color: string; body: string }>;
  tr?: TrFn;
}) {
  const { tr: trLocal } = useDemoI18n('erc-standards');
  const trResolved = tr ?? trLocal;
  return (
    <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
      <h2 className="text-2xl font-bold mb-4 text-blue-300">{trResolved('Real-World Applications')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.title} className="bg-slate-700 rounded p-3">
            <div className={`font-bold ${it.color} flex items-center justify-between gap-3`}>
              <span>{it.title}</span>
              <LinkWithCopy href={it.href} label={<>{trResolved('Docs')}</>} className={`text-xs ${it.color} hover:opacity-90 underline`} />
            </div>
            <p className="text-xs text-slate-300 mt-1">{it.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FurtherReading({
  links,
  tr
}: {
  links: Array<{ label: string; href: string; summary: string }>;
  tr?: TrFn;
}) {
  const { tr: trLocal } = useDemoI18n('erc-standards');
  const trResolved = tr ?? trLocal;
  return (
    <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
      <h2 className="text-2xl font-bold mb-4 text-blue-300">{trResolved('Further Reading')}</h2>
      <ul className="space-y-3 text-sm">
        {links.map((l) => (
          <li key={l.href} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <div className="flex items-start justify-between gap-3">
              <LinkWithCopy
                href={l.href}
                label={<>{l.label}</>}
                className="text-blue-300 hover:text-blue-200 underline"
              />
            </div>
            <div className="mt-2 text-xs text-slate-300 leading-relaxed">{l.summary}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ImplementationApiRow =
  | { kind: string; sig: string }
  | { label: string; value: string }
  | Record<string, unknown>;

type ImplementationSectionProps =
  | {
      // Old-style: grid cards
      items: Array<{ title: string; body: React.ReactNode }>;
      title?: string;
      bullets?: never;
      api?: never;
      tr?: TrFn;
    }
  | {
      // New-style: bullets + API list
      title?: string;
      bullets: string[];
      api?: ImplementationApiRow[];
      items?: never;
      tr?: TrFn;
    };

function ImplementationSection(props: ImplementationSectionProps) {
  const { tr: trLocal } = useDemoI18n('erc-standards');
  const trResolved = props.tr ?? trLocal;

  const title = props.title ?? 'How the Standard Works (Implementation)';

  return (
    <div className="mt-6 bg-slate-900 rounded-lg p-6 border border-slate-700">
      <h3 className="text-lg font-bold mb-3 text-blue-200">{trResolved(title)}</h3>

      {'items' in props ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {props.items.map((it) => (
            <div key={it.title} className="bg-slate-800 rounded p-4 border border-slate-700">
              <div className="font-semibold text-slate-100 mb-1">{it.title}</div>
              <div className="text-sm text-slate-300 leading-relaxed">{it.body}</div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
            {props.bullets.map((b, idx) => (
              <li key={idx} className="leading-relaxed">
                {b}
              </li>
            ))}
          </ul>

          {props.api && props.api.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {props.api.map((row, idx) => {
                const label =
                  typeof (row as any).label === 'string'
                    ? (row as any).label
                    : typeof (row as any).kind === 'string'
                      ? (row as any).kind
                      : trResolved('API');
                const value =
                  typeof (row as any).value === 'string'
                    ? (row as any).value
                    : typeof (row as any).sig === 'string'
                      ? (row as any).sig
                      : '';

                return (
                  <div key={idx} className="bg-slate-800 rounded p-3 border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">{label}</div>
                    <div className="font-mono text-xs text-slate-200 break-words">{value}</div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ERC20Demo() {
  const { tr } = useDemoI18n('erc-standards');
  const [balances, setBalances] = useState<Record<Address, number>>({ Alice: 1000, Bob: 250, Carol: 0, Dex: 0 });
  const [allowances, setAllowances] = useState<Record<Address, Record<Address, number>>>(() => ({
    Alice: { Alice: 0, Bob: 0, Carol: 0, Dex: 0 },
    Bob: { Alice: 0, Bob: 0, Carol: 0, Dex: 0 },
    Carol: { Alice: 0, Bob: 0, Carol: 0, Dex: 0 },
    Dex: { Alice: 0, Bob: 0, Carol: 0, Dex: 0 }
  }));

  const [owner, setOwner] = useState<Address>('Alice');
  const [to, setTo] = useState<Address>('Bob');
  const [spender, setSpender] = useState<Address>('Dex');
  const [amount, setAmount] = useState(50);

  const totalSupply = useMemo(() => Object.values(balances).reduce((a, b) => a + b, 0), [balances]);

  function transfer() {
    if (owner === to) return;
    if (balances[owner] < amount) return;
    setBalances((b) => ({ ...b, [owner]: b[owner] - amount, [to]: b[to] + amount }));
  }

  function approve() {
    setAllowances((a) => ({ ...a, [owner]: { ...a[owner], [spender]: amount } }));
  }

  function transferFrom() {
    if (owner === to) return;
    if (balances[owner] < amount) return;
    if ((allowances[owner]?.[spender] ?? 0) < amount) return;

    setBalances((b) => ({ ...b, [owner]: b[owner] - amount, [to]: b[to] + amount }));
    setAllowances((a) => ({ ...a, [owner]: { ...a[owner], [spender]: (a[owner]?.[spender] ?? 0) - amount } }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>
          {tr('ERC-20')}: {tr('Fungible tokens')} <T text={def('ERC-20')} />
        </SectionTitle>
        <p className="text-sm text-slate-300 leading-relaxed">
          {tr('ERC-20 defines a standard interface for')} <strong>{tr('fungible')}</strong> {tr('assets.')}
          {tr("It's the backbone of stablecoins and most DeFi tokens.")}
          {tr('The critical security surface is')} <strong>{tr('approve/allowance')}</strong>. 
        </p>

        <ImplementationSection
          items={[
            {
              title: 'Core interface + events',
              body: (
                <>
                  <div><code>balanceOf(address)</code>, <code>totalSupply()</code>, <code>transfer(to, value)</code></div>
                  <div><code>approve(spender, value)</code>, <code>allowance(owner, spender)</code>, <code>transferFrom(from, to, value)</code></div>
                  <div className="mt-2">{tr('Events')}: <code>Transfer(from, to, value)</code>, <code>Approval(owner, spender, value)</code></div>
                </>
              )
            },
            {
              title: tr('State + common patterns'),
              body: (
                <>
                  <div>{tr('State is typically')} <code>mapping(address =&gt; uint256) balances</code> {tr('and')} <code>mapping(address =&gt; mapping(address =&gt; uint256)) allowances</code>.</div>
                  <div className="mt-2">{tr('Many tokens also implement')} <em>{tr('mint/burn')}</em> {tr('and')} <em>{tr('EIP-2612 permit')}</em> {tr('to reduce approval friction.')}</div>
                </>
              )
            }
          ]}
        />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">
              {tr('Total supply')} <T text={def('Total Supply')} />
            </div>
            <div className="text-2xl font-bold">{totalSupply}</div>
          </div>

          <div className="bg-slate-900 rounded p-4 border border-slate-700 md:col-span-2">
            <div className="text-xs text-slate-400 mb-2">{tr('Balances')}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {ADDRESSES.map((a) => (
                <div key={a} className="bg-slate-800 rounded p-2 border border-slate-700">
                  <div className="text-xs text-slate-400">{a}</div>
                  <div className="font-bold">{balances[a]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <AddressSelect value={owner} onChange={setOwner} label={tr('Owner (from)')} />
          <AddressSelect value={to} onChange={setTo} label={tr('Recipient (to)')} />
          <AddressSelect value={spender} onChange={setSpender} label={tr('Spender')} />
          <AmountInput value={amount} onChange={setAmount} label={tr('Amount')} />

          <div className="md:col-span-4 flex flex-wrap gap-3 mt-2">
            <button onClick={transfer} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold">
              {tr('transfer')} <T text={def('transfer')} />
            </button>
            <button onClick={approve} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-semibold">
              {tr('approve')} <T text={def('approve')} />
            </button>
            <button onClick={transferFrom} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded font-semibold">
              {tr('transferFrom')} <T text={def('transferFrom')} />
            </button>
          </div>

          <div className="md:col-span-4 mt-4 bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">
              {tr('allowance')} <T text={def('Allowance')} /> ({tr('owner to spender')})
            </div>
            <div className="text-sm text-slate-200">
              {owner} {tr('allows')} {spender}: <span className="font-bold">{allowances[owner]?.[spender] ?? 0}</span>
            </div>
          </div>
        </div>
      </Card>

      <RealWorldApplications
        items={[
          {
            title: tr('Stablecoins (USDC/DAI)'),
            href: 'https://ethereum.org/en/stablecoins/',
            color: 'text-blue-300',
            body: tr('Fungible balances with transfer/approve flow; integrated across exchanges and wallets.')
          },
          {
            title: tr('DEX trading (Uniswap)'),
            href: 'https://docs.uniswap.org/',
            color: 'text-purple-300',
            body: tr('Users approve a router to spend tokens; swaps call transferFrom under the hood.')
          },
          {
            title: tr('Governance tokens'),
            href: 'https://ethereum.org/en/dao/',
            color: 'text-pink-300',
            body: tr('Voting power is often represented as ERC-20 balances (or snapshot-compatible variants).')
          }
        ]}
      />

      <FurtherReading
        links={[
          {
            label: tr('EIP-20: Token Standard'),
            href: 'https://eips.ethereum.org/EIPS/eip-20',
            summary:
              tr('The canonical specification for ERC-20: required functions/events, optional metadata, and the allowance-based spending model used by most DeFi protocols.')
          },
          {
            label: tr('OpenZeppelin ERC-20 guide'),
            href: 'https://docs.openzeppelin.com/contracts/5.x/erc20',
            summary:
              tr('Practical implementation guidance and common extensions (minting, pausing, permit). Helpful for understanding how production ERC-20s are typically built.')
          },
          {
            label: tr('Ethereum.org ERC-20 overview'),
            href: 'https://ethereum.org/en/developers/docs/standards/tokens/erc-20/',
            summary:
              tr('High-level explanation of ERC-20 and how transfers/approvals work from a developer and user perspective.')
          }
        ]}
      />
    </div>
  );
}

function ERC721Demo() {
  const { tr } = useDemoI18n('erc-standards');
  const [owners, setOwners] = useState<Record<number, Address>>({ 1: 'Alice', 2: 'Bob' });
  const [approved, setApproved] = useState<Record<number, Address | null>>({ 1: null, 2: null });
  const [nextId, setNextId] = useState(3);

  const tokenIds = useMemo(() => Object.keys(owners).map(Number).sort((a, b) => a - b), [owners]);

  const [selectedId, setSelectedId] = useState<number>(1);
  const [caller, setCaller] = useState<Address>('Alice');
  const [to, setTo] = useState<Address>('Carol');

  const ownerOf = owners[selectedId];

  function mint() {
    const id = nextId;
    setNextId((n) => n + 1);
    setOwners((o) => ({ ...o, [id]: to }));
    setApproved((a) => ({ ...a, [id]: null }));
    setSelectedId(id);
  }

  function approve() {
    if (!ownerOf) return;
    if (caller !== ownerOf) return;
    setApproved((a) => ({ ...a, [selectedId]: to }));
  }

  function transfer() {
    if (!ownerOf) return;
    const isOwner = caller === ownerOf;
    const isApproved = approved[selectedId] === caller;
    if (!isOwner && !isApproved) return;

    setOwners((o) => ({ ...o, [selectedId]: to }));
    setApproved((a) => ({ ...a, [selectedId]: null }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>
          {tr('ERC-721')}: {tr('NFTs')} <T text={def('ERC-721')} />
        </SectionTitle>
        <p className="text-sm text-slate-300 leading-relaxed">
          {tr('ERC-721 tracks ownership per')} <strong>{tr('tokenId')}</strong>. {tr('Approvals can be per-token or per-operator in the full standard')} ({tr('this simplified demo shows per-token approvals')}).
        </p>

        <ImplementationSection
          items={[
            {
              title: tr('Core interface + events'),
              body: (
                <>
                  <div><code>ownerOf(tokenId)</code>, <code>balanceOf(owner)</code>, <code>approve(to, tokenId)</code>, <code>getApproved(tokenId)</code></div>
                  <div><code>setApprovalForAll(operator, approved)</code>, <code>isApprovedForAll(owner, operator)</code></div>
                  <div><code>safeTransferFrom(from, to, tokenId[, data])</code>, <code>transferFrom(from, to, tokenId)</code></div>
                  <div className="mt-2">{tr('Events')}: <code>Transfer(from, to, tokenId)</code>, <code>Approval(owner, approved, tokenId)</code>, <code>ApprovalForAll(owner, operator, approved)</code></div>
                </>
              )
            },
            {
              title: tr('Storage + receiver check'),
              body: (
                <>
                  <div>{tr('Common storage')}: <code>mapping(uint256 =&gt; address) ownerOf</code>, <code>mapping(address =&gt; uint256) balance</code>, {tr('plus approvals mappings.')}</div>
                  <div className="mt-2"><code>safeTransferFrom</code> {tr('must call')} <code>onERC721Received</code> {tr('on contracts to prevent tokens being locked in non-receiver contracts.')}</div>
                </>
              )
            }
          ]}
        />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">{tr('Tokens')}</div>
            <div className="flex flex-wrap gap-2">
              {tokenIds.map((id) => (
                <button
                  key={id}
                  onClick={() => setSelectedId(id)}
                  className={`px-3 py-2 rounded border text-sm ${id === selectedId ? 'bg-blue-700 border-blue-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                >
                  #{id}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">{tr('Selected token')}</div>
            <div className="text-sm">
              ownerOf({selectedId}) <T text={def('ownerOf')} /> = <span className="font-bold">{ownerOf ?? '-'}</span>
            </div>
            <div className="text-sm mt-1">
              approved({selectedId}) <T text={def('approve')} /> = <span className="font-bold">{approved[selectedId] ?? '-'}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <AddressSelect value={caller} onChange={setCaller} label={tr('Caller')} />
          <AddressSelect value={to} onChange={setTo} label={tr('To (recipient / approved)')} />
          <label className="text-sm text-slate-300 flex flex-col gap-1">
            <span className="text-slate-400">{tr('Token ID')} <T text={def('Token ID')} /></span>
            <select value={selectedId} onChange={(e) => setSelectedId(Number(e.target.value))} className="bg-slate-900 border border-slate-700 rounded px-3 py-2">
              {tokenIds.map((id) => (
                <option key={id} value={id}>#{id}</option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-3 md:col-span-4 mt-2">
            <button onClick={mint} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded font-semibold inline-flex items-center gap-2">
              <Plus size={16} /> {tr('mint')} <T text={def('mint')} />
            </button>
            <button onClick={approve} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-semibold">
              {tr('approve')} <T text={def('approve')} />
            </button>
            <button onClick={transfer} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold">
              {tr('safeTransferFrom')} <T text={def('safeTransferFrom')} />
            </button>
          </div>

          <div className="md:col-span-4 mt-4 text-xs text-slate-400">
            {tr('Tip')}: {tr('to simulate an approved transfer, set Caller to the approved address and click safeTransferFrom.')}
          </div>
        </div>
      </Card>

      <RealWorldApplications
        items={[
          { title: tr('Art & collectibles'), href: 'https://ethereum.org/en/nft/', color: 'text-blue-300', body: tr('Unique token IDs represent unique items; marketplaces rely on standard calls.') },
          { title: tr('Gaming items'), href: 'https://docs.opensea.io/', color: 'text-purple-300', body: tr('Ownership and transfers are composable across games, wallets, and marketplaces.') },
          { title: tr('Membership / access'), href: 'https://eips.ethereum.org/EIPS/eip-721', color: 'text-pink-300', body: tr('NFT ownership can gate access to communities, content, or events.') }
        ]}
      />

      <FurtherReading
        links={[
          {
            label: tr('EIP-721: Non-Fungible Token Standard'),
            href: 'https://eips.ethereum.org/EIPS/eip-721',
            summary:
              tr('Defines NFT ownership, transfer rules, and approval mechanisms. Also documents safe transfer checks for contract recipients.')
          },
          {
            label: tr('OpenZeppelin ERC-721 guide'),
            href: 'https://docs.openzeppelin.com/contracts/5.x/erc721',
            summary:
              tr('Shows standard ERC-721 implementations and common patterns like enumerable extensions, metadata URIs, and safe transfers.')
          },
          {
            label: tr('Ethereum.org ERC-721 overview'),
            href: 'https://ethereum.org/en/developers/docs/standards/tokens/erc-721/',
            summary:
              tr('Explains NFTs and how wallets/marketplaces rely on standard methods like ownerOf, approve, and safeTransferFrom.')
          }
        ]}
      />
    </div>
  );
}

function ERC1155Demo() {
  const { tr } = useDemoI18n('erc-standards');
  const [balances, setBalances] = useState<Record<Address, Record<number, number>>>(() => ({
    Alice: { 1: 100, 2: 1 },
    Bob: { 1: 30, 2: 0 },
    Carol: { 1: 0, 2: 0 },
    Dex: { 1: 0, 2: 0 }
  }));

  const [from, setFrom] = useState<Address>('Alice');
  const [to, setTo] = useState<Address>('Bob');
  const [tokenId, setTokenId] = useState<number>(1);
  const [amount, setAmount] = useState<number>(10);

  const tokenIds = useMemo(() => {
    const ids = new Set<number>();
    for (const perAddr of Object.values(balances)) {
      for (const id of Object.keys(perAddr)) ids.add(Number(id));
    }
    return Array.from(ids).sort((a, b) => a - b);
  }, [balances]);

  function getBal(a: Address, id: number) {
    return balances[a]?.[id] ?? 0;
  }

  function setBal(a: Address, id: number, v: number) {
    setBalances((b) => ({ ...b, [a]: { ...b[a], [id]: v } }));
  }

  function mint() {
    setBal(to, tokenId, getBal(to, tokenId) + amount);
  }

  function burn() {
    const cur = getBal(from, tokenId);
    if (cur < amount) return;
    setBal(from, tokenId, cur - amount);
  }

  function transfer() {
    if (from === to) return;
    const cur = getBal(from, tokenId);
    if (cur < amount) return;
    setBal(from, tokenId, cur - amount);
    setBal(to, tokenId, getBal(to, tokenId) + amount);
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>
          {tr('ERC-1155')}: {tr('Multi-token')} <T text={def('ERC-1155')} />
        </SectionTitle>
        <p className="text-sm text-slate-300 leading-relaxed">
          {tr('ERC-1155 represents many token IDs within one contract. Each id has an amount per owner. This enables batch transfers and efficient games/collections.')}
        </p>

        <ImplementationSection
          items={[
            {
              title: 'Core interface + events',
              body: (
                <>
                  <div><code>balanceOf(account, id)</code>, <code>balanceOfBatch(accounts, ids)</code></div>
                  <div><code>safeTransferFrom(from, to, id, amount, data)</code>, <code>safeBatchTransferFrom(...)</code></div>
                  <div><code>setApprovalForAll(operator, approved)</code>, <code>isApprovedForAll(owner, operator)</code></div>
                  <div className="mt-2">{tr('Events')}: <code>TransferSingle</code>, <code>TransferBatch</code>, <code>ApprovalForAll</code>, <code>URI</code></div>
                </>
              )
            },
            {
              title: tr('IDs + receiver checks'),
              body: (
                <>
                  <div>{tr('Balances are per (owner, id)')}: {tr('typically')} <code>mapping(uint256 =&gt; mapping(address =&gt; uint256))</code>.</div>
                  <div className="mt-2">{tr('Like ERC-721, safe transfers require contract recipients to implement')} <code>IERC1155Receiver</code> (onERC1155Received/onERC1155BatchReceived).</div>
                </>
              )
            }
          ]}
        />

        <div className="mt-4 bg-slate-900 rounded p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-2">{tr('Balances (tokenId to amount)')}</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {ADDRESSES.map((a) => (
              <div key={a} className="bg-slate-800 rounded p-3 border border-slate-700">
                <div className="text-xs text-slate-400 mb-2">{a}</div>
                <div className="space-y-1 text-sm">
                  {tokenIds.map((id) => (
                    <div key={id} className="flex items-center justify-between">
                      <span className="text-slate-400">#{id}</span>
                      <span className="font-bold">{getBal(a, id)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <AddressSelect value={from} onChange={setFrom} label={tr('From')} />
          <AddressSelect value={to} onChange={setTo} label={tr('To')} />

          <label className="text-sm text-slate-300 flex flex-col gap-1">
            <span className="text-slate-400">{tr('Token ID')} <T text={def('Token ID')} /></span>
            <select value={tokenId} onChange={(e) => setTokenId(Number(e.target.value))} className="bg-slate-900 border border-slate-700 rounded px-3 py-2">
              {tokenIds.map((id) => (
                <option key={id} value={id}>#{id}</option>
              ))}
              <option value={999}>#999 ({tr('new')})</option>
            </select>
          </label>

          <AmountInput value={amount} onChange={setAmount} label={tr('Amount')} />

          <div className="md:col-span-4 flex flex-wrap gap-3 mt-2">
            <button onClick={mint} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded font-semibold inline-flex items-center gap-2">
              <Plus size={16} /> {tr('mint')} <T text={def('mint')} />
            </button>
            <button onClick={burn} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold inline-flex items-center gap-2">
              <Flame size={16} /> {tr('burn')} <T text={def('burn')} />
            </button>
            <button onClick={transfer} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold">
              {tr('safeTransferFrom')} <T text={def('safeTransferFrom')} />
            </button>
          </div>
        </div>
      </Card>

      <RealWorldApplications
        items={[
          { title: tr('On-chain games'), href: 'https://eips.ethereum.org/EIPS/eip-1155', color: 'text-blue-300', body: tr('Batch transfers and multiple IDs reduce gas for inventories and crafting.') },
          { title: tr('Semi-fungible tickets'), href: 'https://ethereum.org/en/nft/', color: 'text-purple-300', body: tr('A token ID can represent a ticket class; amounts track remaining supply.') },
          { title: tr('Marketplace listings'), href: 'https://docs.opensea.io/', color: 'text-pink-300', body: tr('Marketplaces can support multiple asset types with a single standard interface.') }
        ]}
      />

      <FurtherReading
        links={[
          {
            label: tr('EIP-1155: Multi Token Standard'),
            href: 'https://eips.ethereum.org/EIPS/eip-1155',
            summary:
              tr('Specifies a single contract managing many token IDs with per-ID balances, plus safe transfer acceptance checks and batch operations.')
          },
          {
            label: tr('OpenZeppelin ERC-1155 guide'),
            href: 'https://docs.openzeppelin.com/contracts/5.x/erc1155',
            summary:
              tr('Practical implementation guidance and APIs. Useful for understanding how games and marketplaces implement multi-token inventories.')
          },
          {
            label: tr('Ethereum.org token standards'),
            href: 'https://ethereum.org/en/developers/docs/standards/tokens/',
            summary:
              tr('Overview page that situates ERC-20/721/1155 and related token standards in the ecosystem.')
          }
        ]}
      />
    </div>
  );
}


function ERC1400Demo() {
  const { tr } = useDemoI18n('erc-standards');
  type Partition = 'COMMON' | 'RESTRICTED';
  const [balances, setBalances] = useState<Record<Partition, Record<Address, number>>>(() => ({
    COMMON: { Alice: 1000, Bob: 200, Carol: 0, Dex: 0 },
    RESTRICTED: { Alice: 100, Bob: 0, Carol: 0, Dex: 0 }
  }));

  const [whitelist, setWhitelist] = useState<Record<Address, boolean>>({
    Alice: true,
    Bob: true,
    Carol: false,
    Dex: true
  });

  const [partition, setPartition] = useState<Partition>('COMMON');
  const [from, setFrom] = useState<Address>('Alice');
  const [to, setTo] = useState<Address>('Bob');
  const [amount, setAmount] = useState(50);

  function bal(p: Partition, a: Address) {
    return balances[p][a] ?? 0;
  }

  function setBal(p: Partition, a: Address, v: number) {
    setBalances((b) => ({ ...b, [p]: { ...b[p], [a]: v } }));
  }

  function toggleWhitelist(a: Address) {
    setWhitelist((w) => ({ ...w, [a]: !w[a] }));
  }

  function transfer() {
    if (from === to) return;
    if (bal(partition, from) < amount) return;

    // Simple compliance rule: RESTRICTED partition can only be transferred to whitelisted addresses.
    if (partition === 'RESTRICTED' && !whitelist[to]) return;

    setBal(partition, from, bal(partition, from) - amount);
    setBal(partition, to, bal(partition, to) + amount);
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>
          {tr('ERC-1400')}: {tr('Security tokens (partitions + compliance)')}
        </SectionTitle>
        <p className="text-sm text-slate-300 leading-relaxed">
          <strong>{tr('ERC-1400')}</strong> {tr('is a family of proposals for')} <strong>{tr('security tokens')}</strong>: {tr('tokens that need')}
          {tr('transfer restrictions (KYC/AML, jurisdiction rules, lockups). A common pattern is splitting balances into')}
          <strong> {tr('partitions')} </strong>
          <T text={def('Partition')} /> {tr('and enforcing rules per partition.')}
        </p>

        <ImplementationSection
          items={[
            {
              title: tr('Partitions + transfer methods'),
              body: (
                <>
                  <div>{tr('Balances are tracked per partition')} ({tr('often')} <code>bytes32</code> {tr('IDs')}): <code>balanceOfByPartition(partition, holder)</code>.</div>
                  <div className="mt-2">{tr('Transfers include the partition')}: <code>transferByPartition(partition, to, value, data)</code> ({tr('and operator variants in some implementations')}).</div>
                </>
              )
            },
            {
              title: tr('Compliance rules + reporting'),
              body: (
                <>
                  <div>{tr('Transfers can enforce KYC/allowlists, lockups, or jurisdiction rules at the token layer.')}</div>
                  <div className="mt-2">{tr('Many security-token stacks add reason codes / controllers to explain or override failed transfers for regulated workflows.')}</div>
                </>
              )
            }
          ]}
        />

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">{tr('Whitelist (KYC)')}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {ADDRESSES.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleWhitelist(a)}
                  className={`p-2 rounded border text-sm ${
                    whitelist[a] ? 'bg-emerald-700/30 border-emerald-600' : 'bg-red-700/20 border-red-700'
                  }`}
                >
                  <div className="text-xs text-slate-400">{a}</div>
                  <div className={`font-bold ${whitelist[a] ? 'text-emerald-200' : 'text-red-200'}`}>
                    {whitelist[a] ? tr('Whitelisted') : tr('Blocked')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">{tr('Partition balances')}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(['COMMON', 'RESTRICTED'] as const).map((p) => (
                <div key={p} className="bg-slate-800 rounded p-3 border border-slate-700">
                  <div className="text-sm font-semibold mb-2 inline-flex items-center gap-2">
                    {p}{' '}
                    <T
                      text={
                        p === 'RESTRICTED'
                          ? tr('Restricted partition enforces KYC/lockup rules.')
                          : tr('Common partition is freely transferable in this simplified model.')
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {ADDRESSES.map((a) => (
                      <div key={a} className="flex items-center justify-between">
                        <span className="text-slate-400">{a}</span>
                        <span className="font-bold">{bal(p, a)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <label className="text-sm text-slate-300 flex flex-col gap-1">
            <span className="text-slate-400">{tr('Partition')} <T text={def('Partition')} /></span>
            <select
              value={partition}
              onChange={(e) => setPartition(e.target.value as Partition)}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2"
            >
              <option value="COMMON">COMMON</option>
              <option value="RESTRICTED">RESTRICTED</option>
            </select>
          </label>
          <AddressSelect value={from} onChange={setFrom} label={tr('From')} />
          <AddressSelect value={to} onChange={setTo} label={tr('To')} />
          <AmountInput value={amount} onChange={setAmount} label={tr('Amount')} />

          <div className="md:col-span-4 flex flex-wrap gap-3 mt-2">
            <button onClick={transfer} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold">
              {tr('transferByPartition')} <T text={def('transferByPartition')} />
            </button>
          </div>

          <div className="md:col-span-4 mt-4 text-xs text-slate-400">
            {tr('Rule in this demo')}: <strong>RESTRICTED</strong> {tr('transfers only succeed if the recipient is whitelisted.')}
          </div>
        </div>
      </Card>

      <RealWorldApplications
        items={[
          {
            title: tr('Regulated tokenized equity'),
            href: 'https://eips.ethereum.org/EIPS/eip-1400',
            color: 'text-blue-300',
            body: tr('Securities require transfer restrictions (jurisdiction, KYC, lockups). Partitions help model these rules.')
          },
          {
            title: tr('Private funds / cap tables'),
            href: 'https://ethereum.org/en/enterprise/',
            color: 'text-purple-300',
            body: tr('Investor eligibility and lockups can be enforced at transfer time rather than off-chain agreements.')
          },
          {
            title: tr('Tokenized bonds'),
            href: 'https://www.bis.org/publ/othp72.htm',
            color: 'text-pink-300',
            body: tr('Coupon/settlement flows can be tokenized while keeping compliance constraints.')
          }
        ]}
      />

      <FurtherReading
        links={[
          {
            label: 'EIP-1400: Security Tokens',
            href: 'https://eips.ethereum.org/EIPS/eip-1400',
            summary:
              'Defines a family of interfaces for security tokens: partitions, issuance/redemption hooks, and compliance-friendly transfer workflows.'
          },
          {
            label: 'Ethereum.org enterprise overview',
            href: 'https://ethereum.org/en/enterprise/',
            summary:
              'A broad overview of enterprise/regulated use-cases for Ethereum, including permissioning, privacy, and integration considerations.'
          },
          {
            label: 'BIS: tokenisation in financial markets (overview)',
            href: 'https://www.bis.org/publ/othp72.htm',
            summary:
              'Background on tokenisation, market structure impacts, and key risks (settlement, custody, compliance) in traditional finance.'
          }
        ]}
      />
    </div>
  );
}

function ERC777Demo() {
  const { tr } = useDemoI18n('erc-standards');
  const [balances, setBalances] = useState<Record<Address, number>>({ Alice: 1000, Bob: 250, Carol: 0, Dex: 0 });
  const [operators, setOperators] = useState<Record<Address, Record<Address, boolean>>>(() => ({
    Alice: { Alice: true, Bob: false, Carol: false, Dex: false },
    Bob: { Alice: false, Bob: true, Carol: false, Dex: false },
    Carol: { Alice: false, Bob: false, Carol: true, Dex: false },
    Dex: { Alice: false, Bob: false, Carol: false, Dex: true }
  }));

  const [sender, setSender] = useState<Address>('Alice');
  const [recipient, setRecipient] = useState<Address>('Bob');
  const [operator, setOperator] = useState<Address>('Dex');
  const [amount, setAmount] = useState(50);

  // Hook simulation
  const [senderHook, setSenderHook] = useState(true);
  const [recipientHook, setRecipientHook] = useState(true);
  const [log, setLog] = useState<string[]>([]);

  function push(msg: string) {
    setLog((l) => [msg, ...l].slice(0, 8));
  }

  function isOp(tokenHolder: Address, op: Address) {
    return operators[tokenHolder]?.[op] ?? false;
  }

  function toggleOperator() {
    setOperators((o) => ({
      ...o,
      [sender]: { ...o[sender], [operator]: !isOp(sender, operator) }
    }));
  }

  function send() {
    if (sender === recipient) return;
    if (balances[sender] < amount) return;

    if (senderHook) push(tr('tokensToSend hook called for {{sender}}', { sender }));

    // recipient hook could reject; simulate reject when recipientHook disabled
    if (!recipientHook) {
      push(tr('tokensReceived hook rejected for {{recipient}}', { recipient }));
      return;
    }

    setBalances((b) => ({ ...b, [sender]: b[sender] - amount, [recipient]: b[recipient] + amount }));
    push(tr('send: {{sender}} -> {{recipient}} ({{amount}})', { sender, recipient, amount }));
    push(tr('tokensReceived hook called for {{recipient}}', { recipient }));
  }

  function operatorSend() {
    if (!isOp(sender, operator)) return;
    if (sender === recipient) return;
    if (balances[sender] < amount) return;

    if (senderHook) push(tr('tokensToSend hook called for {{sender}} (via operator {{operator}})', { sender, operator }));

    if (!recipientHook) {
      push(tr('tokensReceived hook rejected for {{recipient}}', { recipient }));
      return;
    }

    setBalances((b) => ({ ...b, [sender]: b[sender] - amount, [recipient]: b[recipient] + amount }));
    push(tr('operatorSend: {{operator}} moved {{amount}} from {{sender}} -> {{recipient}}', { operator, amount, sender, recipient }));
    push(tr('tokensReceived hook called for {{recipient}}', { recipient }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>
          {tr('ERC-777')}: {tr('Operators + hooks')}
        </SectionTitle>
        <p className="text-sm text-slate-300 leading-relaxed">
          <strong>{tr('ERC-777')}</strong> {tr('is a fungible token standard that adds')} <strong>{tr('operators')}</strong>
          <T text={def('Operator')} /> {tr('and')} <strong>{tr('hooks')}</strong> (<code>tokensToSend</code>/<code>tokensReceived</code>). {tr('Hooks enable richer UX,')}
          {tr('but also introduce re-entrancy and integration complexity.')}
        </p>

        <ImplementationSection
          items={[
            {
              title: tr('Operator model'),
              body: (
                <>
                  <div><code>authorizeOperator(op)</code> / <code>revokeOperator(op)</code> {tr('grant operator permissions.')}</div>
                  <div className="mt-2">{tr('Operators use')} <code>operatorSend(from, to, amount, data, operatorData)</code> {tr('without ERC-20 allowances.')}</div>
                </>
              )
            },
            {
              title: tr('Hooks via ERC-1820 registry'),
              body: (
                <>
                  <div>{tr('ERC-777 relies on the')} <code>ERC1820Registry</code> {tr('to detect whether addresses implement hook interfaces.')}</div>
                  <div className="mt-2">{tr('During send/mint/burn it calls')} <code>tokensToSend</code> {tr('and')} <code>tokensReceived</code> {tr('if registered (careful: this is reentrancy-sensitive).')}</div>
                </>
              )
            }
          ]}
        />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">{tr('Balances')}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {ADDRESSES.map((a) => (
                <div key={a} className="bg-slate-800 rounded p-2 border border-slate-700">
                  <div className="text-xs text-slate-400">{a}</div>
                  <div className="font-bold">{balances[a]}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">{tr('Hook simulation')}</div>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={senderHook} onChange={(e) => setSenderHook(e.target.checked)} />
                {tr('tokensToSend enabled')}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={recipientHook} onChange={(e) => setRecipientHook(e.target.checked)} />
                {tr('tokensReceived enabled (if unchecked, transfer reverts)')}
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <AddressSelect value={sender} onChange={setSender} label={tr('Token holder')} />
          <AddressSelect value={recipient} onChange={setRecipient} label={tr('Recipient')} />
          <AddressSelect value={operator} onChange={setOperator} label={tr('Operator')} />
          <AmountInput value={amount} onChange={setAmount} label={tr('Amount')} />

          <div className="md:col-span-4 flex flex-wrap gap-3 mt-2">
            <button onClick={toggleOperator} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-semibold">
              {isOp(sender, operator) ? tr('Revoke operator') : tr('Authorize operator')} <T text={def('authorizeOperator')} />
            </button>
            <button onClick={send} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold">
              {tr('send')} <T text={def('send')} />
            </button>
            <button onClick={operatorSend} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded font-semibold">
              {tr('operatorSend')} <T text={def('operatorSend')} />
            </button>
          </div>

          <div className="md:col-span-4 mt-4 bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">
              {tr('Operator status')}: {sender} {tr('to')} {operator}:{' '}
              <span className="font-bold">{isOp(sender, operator) ? tr('Authorized') : tr('Not authorized')}</span>
            </div>
            <div className="text-xs text-slate-400 mb-2">{tr('Event log')}</div>
            <div className="space-y-1">
              {log.length === 0 ? <div className="text-sm text-slate-400">{tr('No events yet.')}</div> : null}
              {log.map((l, i) => (
                <div key={i} className="text-sm text-slate-200">- {l}</div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <RealWorldApplications
        items={[
          {
            title: tr('Token UX with hooks'),
            href: 'https://eips.ethereum.org/EIPS/eip-777',
            color: 'text-blue-300',
            body: tr('Hooks allow contracts to react on send/receive (e.g., automatic accounting, vault deposits).')
          },
          {
            title: tr('Operator-based spending'),
            href: 'https://eips.ethereum.org/EIPS/eip-777',
            color: 'text-purple-300',
            body: tr('Operators can move tokens without the ERC-20 allowance pattern (different security model).')
          },
          {
            title: tr('Compatibility concerns'),
            href: 'https://docs.openzeppelin.com/contracts/5.x/erc777',
            color: 'text-pink-300',
            body: tr('More moving parts can mean more integration risk compared to plain ERC-20.')
          }
        ]}
      />

      <FurtherReading
        links={[
          {
            label: tr('EIP-777: Token Standard'),
            href: 'https://eips.ethereum.org/EIPS/eip-777',
            summary:
              tr('Specifies ERC-777 send/burn, operator permissions, and the hook mechanism that notifies sender/recipient contracts via ERC-1820 interface lookups.')
          },
          {
            label: tr('OpenZeppelin ERC-777 guide'),
            href: 'https://docs.openzeppelin.com/contracts/5.x/erc777',
            summary:
              tr('Implementation notes and cautions (hook reentrancy, integration compatibility). Good for understanding what production-ready ERC-777 looks like.')
          },
          {
            label: tr('ERC-1820 registry (used by ERC-777)'),
            href: 'https://eips.ethereum.org/EIPS/eip-1820',
            summary:
              tr('The on-chain registry ERC-777 uses to discover whether an address implements tokensToSend/tokensReceived hooks.')
          }
        ]}
      />
    </div>
  );
}

function ERC998Demo() {
  const { tr } = useDemoI18n('erc-standards');
  type Node = { id: number; owner: Address; children: number[]; name: string };
  const [nodes, setNodes] = useState<Record<number, Node>>({
    1: { id: 1, owner: 'Alice', children: [2], name: 'Parent NFT #1' },
    2: { id: 2, owner: 'Alice', children: [], name: 'Child NFT #2' },
    3: { id: 3, owner: 'Bob', children: [], name: 'Loose NFT #3' }
  });

  const [selectedParent, setSelectedParent] = useState<number>(1);
  const [selectedChild, setSelectedChild] = useState<number>(3);
  const [caller, setCaller] = useState<Address>('Alice');

  const ids = useMemo(() => Object.keys(nodes).map(Number).sort((a, b) => a - b), [nodes]);

  function attach() {
    const parent = nodes[selectedParent];
    const child = nodes[selectedChild];
    if (!parent || !child) return;
    if (parent.id === child.id) return;

    // Simplified rule: caller must own both to compose
    if (caller !== parent.owner || caller !== child.owner) return;

    setNodes((n) => {
      const next: Record<number, Node> = { ...n };
      next[parent.id] = { ...parent, children: Array.from(new Set([...parent.children, child.id])) };
      return next;
    });
  }

  function detach() {
    const parent = nodes[selectedParent];
    if (!parent) return;

    if (caller !== parent.owner) return;

    setNodes((n) => {
      const next: Record<number, Node> = { ...n };
      next[parent.id] = { ...parent, children: parent.children.filter((c) => c !== selectedChild) };
      return next;
    });
  }

  function transferParent(to: Address) {
    const parent = nodes[selectedParent];
    if (!parent) return;
    if (caller !== parent.owner) return;

    // transfer parent also changes ownership of subtree in this simplified model
    const subtree = new Set<number>();
    const stack = [parent.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (subtree.has(id)) continue;
      subtree.add(id);
      for (const c of nodes[id]?.children ?? []) stack.push(c);
    }

    setNodes((n) => {
      const next: Record<number, Node> = { ...n };
      for (const id of subtree) {
        next[id] = { ...next[id], owner: to };
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>
          {tr('ERC-998')}: {tr('Composable NFTs')}
        </SectionTitle>
        <p className="text-sm text-slate-300 leading-relaxed">
          <strong>{tr('ERC-998')}</strong> {tr('proposes a way for an NFT to')} <strong>{tr('own other tokens')}</strong> ({tr('NFTs or ERC-20')}), {tr('enabling')}
          <strong> {tr('composability')}</strong> <T text={def('Composable NFT')} />. {tr('This demo models a parent NFT that can have child NFTs.')}
        </p>

        <ImplementationSection
          items={[
            {
              title: tr('Top-down vs bottom-up'),
              body: (
                <>
                  <div>{tr('Composable ownership needs a rule for representing nesting: parent holds children (top-down) or children point to a parent (bottom-up).')}</div>
                  <div className="mt-2">{tr('Both approaches must define how approvals and transfers propagate to nested assets.')}</div>
                </>
              )
            },
            {
              title: tr('Market/wallet compatibility'),
              body: (
                <>
                  <div>{tr('Indexing nested ownership is hard: UIs need to know which assets are inside a token to display and transfer them safely.')}</div>
                  <div className="mt-2">{tr('Many projects instead model composition via ERC-6551 (token-bound accounts) for simpler integration.')}</div>
                </>
              )
            }
          ]}
        />

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">{tr('NFTs')}</div>
            <div className="space-y-2">
              {ids.map((id) => (
                <div key={id} className="bg-slate-800 rounded p-3 border border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{nodes[id].name}</div>
                    <div className="text-xs text-slate-400">{tr('owner')}: <span className="font-bold text-slate-200">{nodes[id].owner}</span></div>
                  </div>
                  <div className="text-xs text-slate-400 mt-2">{tr('children')}: {nodes[id].children.length === 0 ? tr('none') : nodes[id].children.map((c) => `#${c}`).join(', ')}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">{tr('Actions')}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <AddressSelect value={caller} onChange={setCaller} label={tr('Caller')} />

              <label className="text-sm text-slate-300 flex flex-col gap-1">
                <span className="text-slate-400">{tr('Parent NFT')}</span>
                <select value={selectedParent} onChange={(e) => setSelectedParent(Number(e.target.value))} className="bg-slate-900 border border-slate-700 rounded px-3 py-2">
                  {ids.map((id) => (
                    <option key={id} value={id}>#{id}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-slate-300 flex flex-col gap-1">
                <span className="text-slate-400">{tr('Child NFT')}</span>
                <select value={selectedChild} onChange={(e) => setSelectedChild(Number(e.target.value))} className="bg-slate-900 border border-slate-700 rounded px-3 py-2">
                  {ids.map((id) => (
                    <option key={id} value={id}>#{id}</option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-3 md:col-span-2 mt-2">
                <button onClick={attach} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded font-semibold">
                  {tr('Attach child')}
                </button>
                <button onClick={detach} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-semibold">
                  {tr('Detach child')}
                </button>
              </div>

              <div className="md:col-span-2 mt-4">
                <div className="text-xs text-slate-400 mb-2">{tr('Transfer parent (moves whole subtree in this simplified model)')}</div>
                <div className="flex flex-wrap gap-2">
                  {ADDRESSES.map((a) => (
                    <button key={a} onClick={() => transferParent(a)} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold">
                      {tr('To')} {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 mt-4 text-xs text-slate-400">
                {tr('Rule in this demo')}: {tr('caller must own both parent and child to attach, and must own the parent to detach/transfer.')}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <RealWorldApplications
        items={[
          { title: tr('Avatar + inventory'), href: 'https://eips.ethereum.org/EIPS/eip-998', color: 'text-blue-300', body: tr('A character NFT could own item NFTs, bundling them for transfers and marketplaces.') },
          { title: tr('DAO memberships'), href: 'https://ethereum.org/en/dao/', color: 'text-purple-300', body: tr('A membership NFT could contain nested badges/permissions represented as child tokens.') },
          { title: tr('Complex financial positions'), href: 'https://eips.ethereum.org/EIPS/eip-998', color: 'text-pink-300', body: tr('A position NFT could hold LP NFTs or other tokens as components.') }
        ]}
      />

      <FurtherReading
        links={[
          {
            label: tr('EIP-998: Composable Non-Fungible Tokens'),
            href: 'https://eips.ethereum.org/EIPS/eip-998',
            summary:
              tr('Defines patterns for NFTs that can own other ERC-20/ERC-721 assets. Useful for understanding the composability goal and why implementation complexity is high.')
          },
          {
            label: tr('Ethereum.org NFTs overview'),
            href: 'https://ethereum.org/en/nft/',
            summary:
              tr('A beginner-friendly explanation of NFTs, marketplaces, and typical NFT mechanics that composable NFTs build on top of.')
          }
        ]}
      />
    </div>
  );
}

// INSERT_NEXT3_BEGIN

function ERC4626Demo() {
  const { tr } = useDemoI18n('erc-standards');
  const [assets, setAssets] = useState<Record<Address, number>>({ Alice: 1000, Bob: 200, Carol: 0, Dex: 0 });
  const [shares, setShares] = useState<Record<Address, number>>({ Alice: 0, Bob: 0, Carol: 0, Dex: 0 });
  const [vaultAssets, setVaultAssets] = useState(0);
  const [vaultShares, setVaultShares] = useState(0);
  const [from, setFrom] = useState<Address>('Alice');
  const [amount, setAmount] = useState(100);

  const sharePrice = vaultShares === 0 ? 1 : vaultAssets / vaultShares;

  function deposit() {
    if (assets[from] < amount) return;
    const mintedShares = vaultShares === 0 ? amount : Math.floor(amount / sharePrice);
    if (mintedShares <= 0) return;

    setAssets((a) => ({ ...a, [from]: a[from] - amount }));
    setShares((s) => ({ ...s, [from]: s[from] + mintedShares }));
    setVaultAssets((x) => x + amount);
    setVaultShares((x) => x + mintedShares);
  }

  function withdraw() {
    const neededShares = vaultShares === 0 ? 0 : Math.ceil(amount / sharePrice);
    if (neededShares <= 0) return;
    if (shares[from] < neededShares) return;
    if (vaultAssets < amount) return;

    setShares((s) => ({ ...s, [from]: s[from] - neededShares }));
    setAssets((a) => ({ ...a, [from]: a[from] + amount }));
    setVaultAssets((x) => x - amount);
    setVaultShares((x) => x - neededShares);
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>
          {tr('ERC-4626')}: {tr('Tokenized vaults')} <T text={def('ERC-4626')} />
        </SectionTitle>
        <p className="text-sm text-slate-300 leading-relaxed">
          {tr('ERC-4626 standardizes vaults that accept an')} <strong>{tr('asset')}</strong> {tr('token and issue')} <strong>{tr('share')}</strong> {tr('tokens.')}
          {tr('Deposits mint shares; withdrawals burn shares. The standard also defines preview/convert functions so UIs can')}
          {tr('estimate outcomes.')}
        </p>

        <ImplementationSection
          bullets={[
            tr("Vault shares are ERC-20 tokens representing a proportional claim on the vault's underlying assets."),
            tr('deposit/mint increase share supply; withdraw/redeem decrease share supply (often with fees).'),
            tr('preview* and convert* helpers let integrators quote expected outcomes (still sensitive to rounding/fees).'),
          ]}
          api={[
            { kind: 'function', sig: 'asset() -> address' },
            { kind: 'function', sig: 'totalAssets() -> uint256' },
            { kind: 'function', sig: 'deposit(uint256 assets, address receiver) -> uint256 shares' },
            { kind: 'function', sig: 'withdraw(uint256 assets, address receiver, address owner) -> uint256 shares' },
            { kind: 'function', sig: 'redeem(uint256 shares, address receiver, address owner) -> uint256 assets' },
            { kind: 'function', sig: 'convertToShares/convertToAssets + preview*' }
          ]}
        />

        <ImplementationSection
          title="How the Standard Works (Implementation)"
          bullets={[
            tr('Vault is an ERC-20 share token; it holds an underlying ERC-20 asset.'),
            'Core entrypoints: deposit(assets, receiver), mint(shares, receiver), withdraw(assets, receiver, owner), redeem(shares, receiver, owner).',
            tr('Conversion helpers: convertToShares, convertToAssets + previewDeposit/previewWithdraw for quoting.'),
            tr('Events: Deposit(sender, owner, assets, shares) and Withdraw(sender, receiver, owner, assets, shares).')
          ]}
          api={[
            { label: 'State', value: 'asset() address, totalAssets() uint256, totalSupply() shares' },
            { label: 'Core', value: 'deposit/mint/withdraw/redeem' },
            { label: 'Views', value: 'convertToShares/convertToAssets, preview*' }
          ]}
        />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">{tr('Vault assets')}</div>
            <div className="text-2xl font-bold">{vaultAssets}</div>
          </div>
          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">{tr('Vault shares')}</div>
            <div className="text-2xl font-bold">{vaultShares}</div>
          </div>
          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">{tr('Share price')}</div>
            <div className="text-2xl font-bold">{sharePrice.toFixed(3)}</div>
          </div>
        </div>

        <div className="mt-4 bg-slate-900 rounded p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-2">{tr('User balances')}</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {ADDRESSES.map((a) => (
              <div key={a} className="bg-slate-800 rounded p-2 border border-slate-700">
                <div className="text-xs text-slate-400">{a}</div>
                <div className="text-sm">assets: <span className="font-bold">{assets[a]}</span></div>
                <div className="text-sm">shares: <span className="font-bold">{shares[a]}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <AddressSelect value={from} onChange={setFrom} label={tr('User')} />
          <AmountInput value={amount} onChange={setAmount} label={tr('Amount')} />
          <div className="flex gap-3">
            <button onClick={deposit} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded font-semibold">
              {tr('deposit')} <T text={def('deposit')} />
            </button>
            <button onClick={withdraw} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold">
              {tr('withdraw')} <T text={def('withdraw')} />
            </button>
          </div>
        </div>
      </Card>

      <RealWorldApplications
        items={[
          {
            title: 'Vault ecosystems (Yearn / Beefy / similar)',
            href: 'https://docs.yearn.fi/',
            color: 'text-blue-300',
            body:
              'Benefits: standardized share accounting and deposit/withdraw UX makes integrations easier for dashboards and routers. Adoption: strong at the interface level across many modern vault designs. Drawbacks: vault risks are strategy-dependent (smart contract + market + oracle), not removed by the standard.'
          },
          {
            title: 'Tokenized yield positions',
            href: 'https://ethereum.org/en/defi/',
            color: 'text-purple-300',
            body:
              'Shares can be used as composable building blocks (collateral, accounting, portfolio tracking). Known issues: rounding + donation/inflation attacks in naive implementations; preview functions reduce integration mistakes but do not eliminate risk.'
          },
          {
            title: 'Integrators (wallets, aggregators, risk tools)',
            href: 'https://eips.ethereum.org/EIPS/eip-4626',
            color: 'text-pink-300',
            body:
              'Improvement needed: more consistent fee modeling and clearer edge-case guidance (limits, slippage, rounding) so UIs can quote expected shares/assets reliably. The standard helps, but integrations still require per-vault due diligence.'
          }
        ]}
      />

      <FurtherReading
        links={[
          {
            label: tr('EIP-4626: Tokenized Vault Standard'),
            href: 'https://eips.ethereum.org/EIPS/eip-4626',
            summary:
              'Defines the vault interface (deposit/mint/withdraw/redeem), conversion helpers (convertToShares/convertToAssets), and preview functions. The goal is consistent integration for vaults across the ecosystem.'
          },
          {
            label: tr('OpenZeppelin ERC-4626 guide'),
            href: 'https://docs.openzeppelin.com/contracts/5.x/erc4626',
            summary:
              tr('Practical implementation reference. Discusses rounding behavior, limits, and extension points. Useful when comparing how real vaults implement fees and how integrators should call preview functions.')
          },
          {
            label: 'Yearn documentation',
            href: 'https://docs.yearn.fi/',
            summary:
              'A real vault ecosystem showing the share model in practice. Good for seeing why standardized share accounting (ERC-4626) reduces bespoke integration code and quoting mistakes.'
          },
          {
            label: 'Ethereum.org DeFi overview',
            href: 'https://ethereum.org/en/defi/',
            summary:
              'High-level context for yield strategies and DeFi risk. Helps interpret why vault standards matter but do not guarantee safety.'
          }
        ]}
      />
    </div>
  );
}

function ERC223Demo() {
  const { tr } = useDemoI18n('erc-standards');
  const [balances, setBalances] = useState<Record<Address, number>>({ Alice: 500, Bob: 0, Carol: 0, Dex: 0 });
  const [to, setTo] = useState<Address>('Dex');
  const [from, setFrom] = useState<Address>('Alice');
  const [amount, setAmount] = useState(50);
  const [isContract, setIsContract] = useState<Record<Address, boolean>>({ Alice: false, Bob: false, Carol: false, Dex: true });
  const [dexAccepts, setDexAccepts] = useState(true);

  function transfer223() {
    if (balances[from] < amount) return;
    if (isContract[to] && !dexAccepts) return;
    setBalances((b) => ({ ...b, [from]: b[from] - amount, [to]: b[to] + amount }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>
          {tr('ERC-223')}: {tr('Safer transfers to contracts')} <T text={def('ERC-223')} />
        </SectionTitle>
        <p className="text-sm text-slate-300 leading-relaxed">
          {tr('ERC-223 tries to prevent accidental token transfers to contracts that cannot handle them. When sending to a')}
          {tr('contract, the token calls')} <code>tokenFallback</code> {tr('on the recipient.')}
        </p>

        <ImplementationSection
          title="How the Standard Works (Implementation)"
          bullets={[
            'transfer(to,value,data) triggers a recipient callback if `to` is a contract.',
            'Recipient contracts implement tokenFallback(address from, uint value, bytes data).',
            'If the callback reverts, the transfer should revert (avoiding stuck tokens).',
            'Requires reliable contract detection (extcodesize) which has edge-cases (during construction, proxies).'
          ]}
          api={[
            { label: 'Core', value: 'transfer(to,value[,data])' },
            { label: 'Receiver', value: 'tokenFallback(from,value,data)' },
            { label: 'Events', value: 'Transfer(from,to,value[,data])' }
          ]}
        />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2">
          {ADDRESSES.map((a) => (
            <div key={a} className="bg-slate-900 rounded p-3 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">{a}</div>
                <span className={`text-xs px-2 py-1 rounded ${isContract[a] ? 'bg-purple-700' : 'bg-slate-700'}`}>
                  {isContract[a] ? tr('contract') : tr('EOA')}
                </span>
              </div>
              <div className="text-xl font-bold mt-1">{balances[a]}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <AddressSelect value={from} onChange={setFrom} label={tr('From')} />
          <AddressSelect value={to} onChange={setTo} label={tr('To')} />
          <AmountInput value={amount} onChange={setAmount} label={tr('Amount')} />

          <div className="md:col-span-4 flex flex-wrap items-center gap-4 mt-2">
            <label className="text-sm text-slate-300 flex items-center gap-2">
              <input
                type="checkbox"
                checked={isContract.Dex}
                onChange={(e) => setIsContract((s) => ({ ...s, Dex: e.target.checked }))}
              />
              {tr('Treat Dex as contract')}
            </label>
            <label className="text-sm text-slate-300 flex items-center gap-2">
              <input type="checkbox" checked={dexAccepts} onChange={(e) => setDexAccepts(e.target.checked)} />
              {tr('Dex implements tokenFallback (accepts)')}
            </label>

            <button onClick={transfer223} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold">
              {tr('transfer (ERC-223)')}
            </button>

            {isContract[to] && !dexAccepts ? (
              <div className="text-sm text-red-300">{tr('Transfer would fail: tokenFallback rejected')}</div>
            ) : null}
          </div>
        </div>
      </Card>

      <RealWorldApplications
        items={[
          {
            title: tr('Stuck-token mitigation (original motivation)'),
            href: 'https://eips.ethereum.org/EIPS/eip-223',
            color: 'text-blue-300',
            body:
              tr('Problem: ERC-20 transfers can send tokens to a contract that cannot handle them, effectively locking funds. ERC-223 adds tokenFallback(receiver) to make transfers revert unless the receiver can accept. Adoption: limited; the ecosystem standardized on ERC-721/1155 receiver checks instead.')
          },
          {
            title: tr('Wallet + exchange compatibility'),
            href: 'https://ethereum.org/en/developers/docs/standards/tokens/erc-20/',
            color: 'text-purple-300',
            body:
              tr('Drawback: changing transfer semantics breaks expectations and tooling built around ERC-20. Most wallets/exchanges standardized on ERC-20 + safe patterns (checks, UIs, and standards like ERC-721/1155) rather than adopting ERC-223 broadly.')
          },
          {
            title: tr('Modern alternative: safe transfers'),
            href: 'https://eips.ethereum.org/EIPS/eip-1155',
            color: 'text-pink-300',
            body:
              tr('ERC-721/1155 include safeTransferFrom with explicit receiver interfaces (onERC721Received / IERC1155Receiver). This became the widely-adopted "receiver-aware" transfer pattern.')
          }
        ]}
      />

      <FurtherReading
        links={[
          {
            label: tr('EIP-223: Token Standard'),
            href: 'https://eips.ethereum.org/EIPS/eip-223',
            summary:
              tr('Defines tokenFallback and the idea that transfers to contracts should call a receiver hook (or revert). Good to understand why "stuck tokens" was a persistent ERC-20 UX issue.')
          },
          {
            label: 'Ethereum.org ERC-20 overview (contrast)',
            href: 'https://ethereum.org/en/developers/docs/standards/tokens/erc-20/',
            summary:
              tr('Baseline ERC-20 semantics: transfer does not distinguish EOAs vs contracts. Helps compare why later standards added explicit receiver interfaces.')
          },
          {
            label: 'EIP-721 (onERC721Received)',
            href: 'https://eips.ethereum.org/EIPS/eip-721',
            summary:
              tr('Shows the safeTransferFrom pattern that became the mainstream "receiver-aware" transfer mechanism for NFTs.')
          },
          {
            label: 'EIP-1155 (IERC1155Receiver)',
            href: 'https://eips.ethereum.org/EIPS/eip-1155',
            summary:
              tr('Defines the multi-token safe transfer acceptance checks. Useful as the modern, widely-adopted solution to prevent accidental token loss.')
          }
        ]}
      />
    </div>
  );
}

function ERC827Demo() {
  const { tr } = useDemoI18n('erc-standards');
  const [balances, setBalances] = useState<Record<Address, number>>({ Alice: 400, Bob: 0, Carol: 0, Dex: 0 });
  const [from, setFrom] = useState<Address>('Alice');
  const [to, setTo] = useState<Address>('Dex');
  const [amount, setAmount] = useState(50);
  const [callData, setCallData] = useState('swapExactTokensForTokens(...)');
  const [allowCall, setAllowCall] = useState(true);
  const [lastCall, setLastCall] = useState<string | null>(null);

  function transferAndCall() {
    if (balances[from] < amount) return;
    if (!allowCall) {
      setLastCall(tr('CALL REVERTED'));
      return;
    }
    setBalances((b) => ({ ...b, [from]: b[from] - amount, [to]: b[to] + amount }));
    setLastCall(tr('Executed call on {{to}} with data: {{callData}}', { to, callData }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>
          {tr('ERC-827')}: {tr('ERC-20 with call data')} <T text={def('ERC-827')} />
        </SectionTitle>
        <p className="text-sm text-slate-300 leading-relaxed">
          {tr('ERC-827 extends ERC-20 by allowing extra')} <strong>{tr('call data')}</strong> {tr('to be executed as part of a transfer/approval.')}
          {tr('This can reduce multi-step UX but increases complexity and risk.')}
        </p>

        <ImplementationSection
          bullets={[
            'Adds methods like transferAndCall / approveAndCall that perform an ERC-20 action then execute an extra call.',
            'Because it introduces external calls inside token logic, it increases reentrancy risk and auditing complexity.',
            'Most production systems prefer routers/multicall + minimal ERC-20 tokens for compatibility.'
          ]}
          api={[
            { kind: 'function', sig: 'transferAndCall(address to, uint256 value, bytes data) -> bool' },
            { kind: 'function', sig: 'approveAndCall(address spender, uint256 value, bytes data) -> bool' }
          ]}
        />

        <ImplementationSection
          title="How the Standard Works (Implementation)"
          bullets={[
            'Adds methods like transferAndCall(to, value, data) and approveAndCall(spender, value, data).',
            'After state updates, the token executes an external call using provided calldata.',
            'This couples token transfer logic with arbitrary execution; auditing and reentrancy considerations increase.',
            'Many integrations prefer explicit router contracts + ERC-20 approvals for clearer separation.'
          ]}
          api={[
            { label: 'Core', value: 'transferAndCall / transferFromAndCall / approveAndCall' },
            { label: 'Risks', value: 'external calls, reentrancy, unexpected execution paths' }
          ]}
        />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2">
          {ADDRESSES.map((a) => (
            <div key={a} className="bg-slate-900 rounded p-3 border border-slate-700">
              <div className="text-xs text-slate-400">{a}</div>
              <div className="text-xl font-bold">{balances[a]}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <AddressSelect value={from} onChange={setFrom} label={tr('From')} />
          <AddressSelect value={to} onChange={setTo} label={tr('To')} />
          <AmountInput value={amount} onChange={setAmount} label={tr('Amount')} />

          <label className="md:col-span-3 text-sm text-slate-300 flex flex-col gap-1">
            <span className="text-slate-400">{tr('Call data (example)')}</span>
            <input
              value={callData}
              onChange={(e) => setCallData(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2"
            />
          </label>

          <div className="md:col-span-3 flex flex-wrap items-center gap-4 mt-1">
            <label className="text-sm text-slate-300 flex items-center gap-2">
              <input type="checkbox" checked={allowCall} onChange={(e) => setAllowCall(e.target.checked)} />
              {tr('Contract call succeeds')}
            </label>
            <button onClick={transferAndCall} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold">
              {tr('transferAndCall')}
            </button>
            {lastCall ? <div className="text-xs text-slate-300">{lastCall}</div> : null}
          </div>
        </div>
      </Card>

      <RealWorldApplications
        items={[
          {
            title: tr('Meta-actions / bundled calls'),
            href: 'https://eips.ethereum.org/EIPS/eip-827',
            color: 'text-blue-300',
            body:
              tr('Idea: attach calldata to transfer/approve so the token contract can call another contract as part of the action (transferAndCall / approveAndCall). Benefit: fewer user transactions. Drawbacks: larger attack surface and unexpected execution paths.')
          },
          {
            title: 'Real-world pattern: routers',
            href: 'https://docs.uniswap.org/',
            color: 'text-purple-300',
            body:
              'Adoption note: the dominant ecosystem pattern kept ERC-20 tokens minimal and pushed complex execution into routers (DEX routers, permit flows, multicalls). This improves compatibility across wallets and infra.'
          },
          {
            title: tr('Security + audit complexity'),
            href: 'https://consensys.io/diligence/',
            color: 'text-pink-300',
            body:
              tr('Known issues: external calls during token operations can enable reentrancy or surprising control flow. Improvements needed: better, composable transaction-bundling primitives without changing token core semantics.')
          }
        ]}
      />

      <FurtherReading
        links={[
          {
            label: tr('EIP-827: Token Standard'),
            href: 'https://eips.ethereum.org/EIPS/eip-827',
            summary:
              tr('Proposes adding calldata parameters to ERC-20 operations so the token can execute an additional call. Good for learning why bundling was attractive and why it is risky inside token logic.')
          },
          {
            label: 'Uniswap docs (router pattern)',
            href: 'https://docs.uniswap.org/',
            summary:
              'Concrete example of the ecosystem approach: keep tokens simple, put complex interactions into routers. This maximizes compatibility with wallets, exchanges, and indexers.'
          },
          {
            label: 'ConsenSys Diligence (security resources)',
            href: 'https://consensys.io/diligence/',
            summary:
              'Security education and audit writeups. Useful to understand why "tokens that call arbitrary contracts" increases risk (reentrancy, approvals, unexpected callbacks).' 
          }
        ]}
      />
    </div>
  );
}

// INSERT_NEXT3_END

// INSERT_4337_864_865_BEGIN

function ERC4337Demo() {
  const { tr } = useDemoI18n('erc-standards');
  const [hasPaymaster, setHasPaymaster] = useState(true);
  const [mode, setMode] = useState<'passwordless' | 'sessionKey'>('passwordless');
  const [log, setLog] = useState<string[]>([]);

  function push(s: string) {
    setLog((l) => [s, ...l].slice(0, 8));
  }

  function simulate() {
    push(tr('UserOperation created (callData = execute(target,value,data)).'));
    push(tr('Signed by smart account owner (or by session key depending on mode).'));
    push(tr('Bundler includes UserOperation in an EntryPoint.handleOps call.'));
    if (hasPaymaster) push(tr('Paymaster sponsors gas (or validates a token-based payment).'));
    push(tr('EntryPoint calls validateUserOp then executes the account call.'));
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>
          {tr('ERC-4337')}: {tr('Account Abstraction')} <T text={def('ERC-4337')} />
        </SectionTitle>
        <p className="text-sm text-slate-300 leading-relaxed">
          {tr('ERC-4337 lets users have smart contract accounts without changing L1 consensus.')}
          {tr('Users submit a UserOperation to a mempool; the Bundler packages them; the EntryPoint verifies and executes.')}
        </p>

        <ImplementationSection
          bullets={[
            tr('Core contract: EntryPoint. Smart accounts implement validation logic (validateUserOp) and execution (execute).'),
            tr('Bundlers submit handleOps(UserOperation[]) to EntryPoint - no EOA transaction per user action required.'),
            tr('Paymasters can sponsor gas or accept ERC-20 payments; aggregators can bundle signatures.')
          ]}
          api={[
            { kind: 'contract', sig: 'EntryPoint (handleOps, getUserOpHash, deposit/stake)' },
            { kind: 'struct', sig: 'UserOperation { sender, nonce, initCode, callData, gasLimits, paymasterAndData, signature }' },
            { kind: 'function', sig: 'validateUserOp(UserOperation, bytes32 userOpHash, uint256 missingFunds)' }
          ]}
        />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm text-slate-300 flex flex-col gap-1">
            <span className="text-slate-400">{tr('Auth mode')}</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2"
            >
              <option value="passwordless">{tr('Passkeys / social login')}</option>
              <option value="sessionKey">{tr('Session key (limited permissions)')}</option>
            </select>
          </label>

          <label className="text-sm text-slate-300 flex items-center gap-2 mt-6">
            <input type="checkbox" checked={hasPaymaster} onChange={(e) => setHasPaymaster(e.target.checked)} />
            <span>{tr('Use paymaster sponsorship')}</span>
          </label>

          <button
            onClick={simulate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold h-11 self-end"
          >
            {tr('Simulate user op')}
          </button>
        </div>

        <div className="mt-4 bg-slate-900 rounded p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-2">{tr('Event log')}</div>
          {log.length === 0 ? <div className="text-sm text-slate-400">{tr('Run a simulation to see steps.')}</div> : null}
          <div className="space-y-1">
            {log.map((l, i) => (
              <div key={i} className="text-sm text-slate-200">- {l}</div>
            ))}
          </div>
        </div>
      </Card>

      <RealWorldApplications
        items={[
          {
            title: 'Smart wallets (Safe, Argent)',
            href: 'https://eips.ethereum.org/EIPS/eip-4337',
            color: 'text-blue-300',
            body: 'Programmable accounts enable batched actions, recovery, and flexible authentication. Adoption is growing via L2s and wallet providers.'
          },
          {
            title: 'Gas sponsorship',
            href: 'https://docs.alchemy.com/docs/account-abstraction-overview',
            color: 'text-purple-300',
            body: 'Paymasters can sponsor fees so users can onboard without holding ETH. Drawback: paymasters add trust/complexity and need careful abuse controls.'
          },
          {
            title: 'Session keys for apps',
            href: 'https://docs.zerodev.app/',
            color: 'text-pink-300',
            body: 'Apps can grant limited permissions (time, targets, spending limits) for smoother UX. Risk: authorization bugs or overly-permissive sessions.'
          }
        ]}
      />

      <FurtherReading
        links={[
          {
            label: 'EIP-4337: Account Abstraction',
            href: 'https://eips.ethereum.org/EIPS/eip-4337',
            summary:
              'The canonical spec: defines UserOperation, bundlers, EntryPoint and paymasters. Best for understanding the architecture and why it avoids protocol changes.'
          },
          {
            label: 'Alchemy AA overview',
            href: 'https://docs.alchemy.com/docs/account-abstraction-overview',
            summary:
              'Practical guide to deploying AA wallets, using paymasters, and integrating with dapps. Good adoption snapshot and engineering trade-offs.'
          },
          {
            label: 'ZeroDev docs (AA SDK)',
            href: 'https://docs.zerodev.app/',
            summary:
              'A production SDK perspective: kernel accounts, session keys, and paymasters. Shows what real integrations look like.'
          }
        ]}
      />
    </div>
  );
}

function ERC864Demo() {
  const { tr } = useDemoI18n('erc-standards');
  const [owner, setOwner] = useState<Address>('Alice');
  const [delegate, setDelegate] = useState<Address>('Dex');
  const [limit, setLimit] = useState(100);
  const [spent, setSpent] = useState(0);

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>{tr('ERC-864')}: {tr('Delegated Transfers')}</SectionTitle>
        <p className="text-sm text-slate-300 leading-relaxed">
          {tr('ERC-864 proposes a pattern for reusable delegated approvals.')}
          {tr('Think: a delegation object with constraints (limit, expiry, nonce) that a delegate can use to move tokens on your behalf.')}
        </p>

        <ImplementationSection
          bullets={[
            'Defines delegation objects and a transferFrom-like flow that checks delegation constraints.',
            'The goal is richer, safer approvals than raw ERC-20 allowance (e.g., one-time or bounded permissions).',
            'Not widely adopted - apps commonly rely on ERC-20 permit (EIP-2612) or custom signatures.'
          ]}
          api={[
            { kind: 'concept', sig: 'Delegation { owner, delegate, token, maxAmount, expiry, nonce, signature }' },
            { kind: 'function', sig: 'transferFromDelegation(Delegation, to, amount) -> bool' }
          ]}
        />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <AddressSelect value={owner} onChange={setOwner} label={tr('Owner')} />
          <AddressSelect value={delegate} onChange={setDelegate} label={tr('Delegate')} />
          <AmountInput value={limit} onChange={setLimit} label={tr('Delegation limit')} />
          <button
            onClick={() => setSpent((s) => Math.min(limit, s + 25))}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold h-11"
          >
            {tr('Spend 25')}
          </button>
        </div>

        <div className="mt-4 bg-slate-900 rounded p-4 border border-slate-700">
          <div className="text-sm text-slate-200">{tr('{{delegate}} can spend up to {{limit}} from {{owner}}.', { delegate, limit, owner })}</div>
          <div className="text-sm text-slate-400 mt-1">{tr('Spent so far: {{spent}} (remaining: {{remaining}})', { spent, remaining: Math.max(0, limit - spent) })}</div>
        </div>
      </Card>

      <RealWorldApplications
        items={[
          {
            title: tr('Spending limits'),
            href: 'https://eips.ethereum.org/',
            color: 'text-blue-300',
            body: tr('Wallets implement similar ideas via session keys and policy modules (limits, allowlists). Adoption mostly happens through AA wallets instead of ERC-864.')
          },
          {
            title: tr('Safer approvals'),
            href: 'https://eips.ethereum.org/EIPS/eip-2612',
            color: 'text-purple-300',
            body: tr('The ecosystem adopted permit-style signatures for gasless approval, but still struggles with overly-broad approvals in ERC-20 allowances.')
          },
          {
            title: tr('Batching / intent systems'),
            href: 'https://docs.safe.global/',
            color: 'text-pink-300',
            body: tr('Smart accounts can enforce delegation rules in contract logic today. Drawback: standards fragmentation across implementations.')
          }
        ]}
      />

      <FurtherReading
        links={[
          {
            label: tr('EIP index (search ERC-864)'),
            href: 'https://eips.ethereum.org/',
            summary:
              tr('ERC-864 is less commonly used; the EIP index is the most reliable place to find the original proposal and related discussions.')
          },
          {
            label: 'EIP-2612: ERC-20 Permit',
            href: 'https://eips.ethereum.org/EIPS/eip-2612',
            summary:
              tr('The widely adopted signature-based approval mechanism. Shows how the ecosystem evolved to reduce approval friction without new token standards.')
          }
        ]}
      />
    </div>
  );
}

function ERC865Demo() {
  const { tr } = useDemoI18n('erc-standards');
  const [from, setFrom] = useState<Address>('Alice');
  const [to, setTo] = useState<Address>('Bob');
  const [amount, setAmount] = useState(10);
  const [relayer, setRelayer] = useState<Address>('Dex');
  const [signed, setSigned] = useState(false);
  const [executed, setExecuted] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>{tr('ERC-865')}: {tr('Meta-Transactions for ERC-20')}</SectionTitle>
        <p className="text-sm text-slate-300 leading-relaxed">
          {tr('ERC-865 proposes a meta-transaction flow: the user signs a transfer message off-chain, and a relayer submits it on-chain paying gas. Useful for onboarding and gas abstraction.')}
        </p>

        <ImplementationSection
          bullets={[
            tr('Defines a signed message format for token transfers (and possibly approvals).'),
            tr('A relayer submits the signature to the token contract which verifies it and executes the transfer.'),
            tr('Modern ecosystems often use permit (EIP-2612) + relayers, or ERC-4337 paymasters instead.')
          ]}
          api={[
            { kind: 'concept', sig: 'SignedTransfer { from, to, value, fee, nonce, signature }' },
            { kind: 'function', sig: 'transferPreSigned(bytes signature, address to, uint256 value, uint256 fee, uint256 nonce)' }
          ]}
        />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <AddressSelect value={from} onChange={setFrom} label={tr('From (signer)')} />
          <AddressSelect value={to} onChange={setTo} label={tr('To')} />
          <AmountInput value={amount} onChange={setAmount} label={tr('Amount')} />
          <AddressSelect value={relayer} onChange={setRelayer} label={tr('Relayer')} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => {
              setSigned(true);
              setExecuted(false);
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-semibold"
          >
            {tr('Sign off-chain')}
          </button>
          <button
            onClick={() => {
              if (!signed) return;
              setExecuted(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold"
          >
            {tr('Relayer executes')}
          </button>
        </div>

        <div className="mt-4 bg-slate-900 rounded p-4 border border-slate-700">
          <div className="text-sm text-slate-200">
            {tr('Signed status phrase', {
              signed: signed ? tr('yes') : tr('no'),
              executed: executed ? tr('yes') : tr('no')
            })}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {tr('In production this requires replay protection (nonce) and careful fee design. Relayers also need anti-abuse protections.')}
          </div>
        </div>
      </Card>

      <RealWorldApplications
        items={[
          {
            title: tr('Gasless onboarding'),
            href: 'https://eips.ethereum.org/EIPS/eip-2612',
            color: 'text-blue-300',
            body: tr('Meta-tx flows help new users interact without holding ETH. Today this is often achieved via permit + relayers or ERC-4337 paymasters.')
          },
          {
            title: tr('Sponsored actions'),
            href: 'https://eips.ethereum.org/EIPS/eip-4337',
            color: 'text-purple-300',
            body: tr('Apps sponsor specific actions (claim rewards, mint) with policy controls. Drawback: sponsorship can be abused without rate limits.')
          },
          {
            title: tr('Replay protection'),
            href: 'https://consensys.io/diligence/',
            color: 'text-pink-300',
            body: tr('Meta-tx design must handle nonces and signature malleability. Many historical issues came from weak replay protection.')
          }
        ]}
      />

      <FurtherReading
        links={[
          {
            label: tr('EIP index (search ERC-865)'),
            href: 'https://eips.ethereum.org/',
            summary:
              tr('ERC-865 is an older proposal; use the EIP index to locate the exact draft and discussions. Modern practice often superseded it.')
          },
          {
            label: 'EIP-2612: Permit',
            href: 'https://eips.ethereum.org/EIPS/eip-2612',
            summary:
              tr('Shows the mainstream signature-based approval method used with relayers for gasless UX.')
          },
          {
            label: 'EIP-4337',
            href: 'https://eips.ethereum.org/EIPS/eip-4337',
            summary:
              tr('Modern account abstraction approach: bundlers + paymasters can accomplish gasless UX in a standardized way.')
          }
        ]}
      />
    </div>
  );
}

// INSERT_4337_864_865_END

function ComingSoon({ standard, tr }: { standard: Standard; tr: TrFn }) {
  const Icon = standard.icon;
  return (
    <Card>
      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <Icon size={18} /> {standard.name}
        </span>
      </SectionTitle>
      <p className="text-sm text-slate-300">{standard.summary}</p>
      <div className="mt-4 bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
        <div className="text-sm font-semibold text-blue-300 mb-1">{tr('Coming soon')}</div>
        <p className="text-sm text-slate-300">{tr('This interactive demo will be added next. For now, you can still explore the EIP/spec.')}</p>
        {standard.eipUrl ? (
          <div className="mt-3">
            <LinkWithCopy href={standard.eipUrl} label={<>{tr('Read the spec')}</>} className="text-blue-300 hover:text-blue-200 underline" />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default function ERCStandardsShowcase() {
  const { tr } = useDemoI18n('erc-standards');
  const [selected, setSelected] = useState<StandardId>('erc20');

  const selectedStandard = STANDARDS.find((s) => s.id === selected) ?? STANDARDS[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2">{tr('ERC Standards Playground')}</h1>
          <p className="text-slate-300 max-w-3xl">
            {tr(
              'Pick a standard and interact with its core mechanics. This is a conceptual simulation (not on-chain), focused on understanding interfaces, approvals, and common UX/security pitfalls.'
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-300">
            <span>
              {tr('Key idea')}: <strong>{tr('interfaces enable interoperability')}</strong> - {tr('the same wallet UI can work with many tokens.')}
            </span>
            <T text={def('ERC Standards')} />
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6">
          <div className="text-sm text-slate-300 mb-3">{tr('Choose a standard')}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {STANDARDS.map((s) => {
              const Icon = s.icon;
              const isActive = s.id === selected;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  className={`text-left p-4 rounded-lg border transition-colors ${
                    isActive ? 'bg-blue-900/30 border-blue-600' : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 font-semibold">
                      <Icon size={18} /> {s.name}
                    </div>
                    {s.status === 'coming_soon' ? (
                      <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200">{tr('Coming soon')}</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded bg-emerald-700/40 text-emerald-200">{tr('Ready')}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{s.summary}</div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedStandard.id === 'erc20' ? (
          <ERC20Demo />
        ) : selectedStandard.id === 'erc721' ? (
          <ERC721Demo />
        ) : selectedStandard.id === 'erc1155' ? (
          <ERC1155Demo />
        ) : selectedStandard.id === 'erc1400' ? (
          <ERC1400Demo />
        ) : selectedStandard.id === 'erc777' ? (
          <ERC777Demo />
        ) : selectedStandard.id === 'erc998' ? (
          <ERC998Demo />
        ) : selectedStandard.id === 'erc4626' ? (
          <ERC4626Demo />
        ) : selectedStandard.id === 'erc223' ? (
          <ERC223Demo />
        ) : selectedStandard.id === 'erc827' ? (
          <ERC827Demo />
        ) : selectedStandard.id === 'erc4337' ? (
          <ERC4337Demo />
        ) : selectedStandard.id === 'erc864' ? (
          <ERC864Demo />
        ) : selectedStandard.id === 'erc865' ? (
          <ERC865Demo />
        ) : (
          <ComingSoon standard={selectedStandard} tr={tr} />
        )}
      </div>
    </div>
  );
}

