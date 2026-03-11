import { useState } from "react";

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  evm:  { hi: "#818cf8", mid: "#6366f1", dim: "#3730a3", bg: "#0d0b1e", card: "#13102b", border: "#2e2a5e" },
  svm:  { hi: "#34d399", mid: "#10b981", dim: "#065f46", bg: "#051a12", card: "#071f16", border: "#0d4f34" },
  text: { bright: "#f1f5f9", mid: "#94a3b8", dim: "#475569", xdim: "#1e293b" },
  tag:  { keyword: "#f472b6", type: "#60a5fa", string: "#a3e635", comment: "#6b7280",
          number: "#fb923c", fn: "#facc15", decorator: "#c084fc", macro: "#f87171", attr: "#67e8f9" },
};

// ── Syntax Token Types ────────────────────────────────────────────────────────
const T = {
  kw:   (t) => ({ type: "kw", text: t }),
  ty:   (t) => ({ type: "ty", text: t }),
  fn:   (t) => ({ type: "fn", text: t }),
  str:  (t) => ({ type: "str", text: t }),
  num:  (t) => ({ type: "num", text: t }),
  cmt:  (t) => ({ type: "cmt", text: t }),
  deco: (t) => ({ type: "deco", text: t }),
  mac:  (t) => ({ type: "mac", text: t }),
  attr: (t) => ({ type: "attr", text: t }),
  pl:   (t) => ({ type: "pl",  text: t }),   // plain
};

function tok(type, text) {
  const colorMap = { kw: C.tag.keyword, ty: C.tag.type, fn: C.tag.fn, str: C.tag.string,
    num: C.tag.number, cmt: C.tag.comment, deco: C.tag.decorator, mac: C.tag.macro,
    attr: C.tag.attr, pl: C.text.bright };
  return <span style={{ color: colorMap[type] ?? C.text.bright }}>{text}</span>;
}

// ── Code snippets ─────────────────────────────────────────────────────────────
// Each line is an array of [type, text] pairs + optional annotation
const EXAMPLES = [
  {
    id: "counter",
    label: "Counter",
    subtitle: "Increment a stored number",
    complexity: 1,
    evm: {
      lang: "Solidity",
      lines: [
        [ [T.cmt("// SPDX-License-Identifier: MIT")] ],
        [ [T.kw("pragma "), T.ty("solidity"), T.pl(" ^0.8.0;")] ],
        [ [] ],
        [ [T.kw("contract "), T.ty("Counter"), T.pl(" {")] ],
        [ [T.pl("  "), T.ty("uint256"), T.kw(" public "), T.pl("count;")] ],
        [ [] ],
        [ [T.pl("  "), T.kw("function "), T.fn("increment"), T.pl("() "), T.kw("external"), T.pl(" {")] ],
        [ [T.pl("    count"), T.pl("++"), T.pl(";")] ],
        [ [T.pl("  }")] ],
        [ [T.pl("}")] ],
      ],
      annotations: {
        4: { text: "State lives inside the contract itself", color: C.evm.hi },
        6: { text: "No account declarations needed", color: C.evm.hi },
      },
      linesOfCode: 10,
    },
    svm: {
      lang: "Rust (Anchor)",
      lines: [
        [ [T.kw("use "), T.ty("anchor_lang"), T.pl("::"), T.kw("prelude"), T.pl("::*;")] ],
        [ [] ],
        [ [T.deco("#[program]")] ],
        [ [T.kw("pub mod "), T.ty("counter"), T.pl(" {")] ],
        [ [T.pl("  "), T.kw("use super"), T.pl("::*;")] ],
        [ [T.pl("  "), T.kw("pub fn "), T.fn("increment"), T.pl("(ctx: "), T.ty("Context"), T.pl("<"), T.ty("Increment"), T.pl(">) -> "), T.ty("Result"), T.pl("<()> {")] ],
        [ [T.pl("    ctx.accounts.counter.count "), T.pl("+= 1"), T.pl(";")] ],
        [ [T.pl("    "), T.ty("Ok"), T.pl("(())")] ],
        [ [T.pl("  }")] ],
        [ [T.pl("}")] ],
        [ [] ],
        [ [T.deco("#[derive(Accounts)]")] ],
        [ [T.kw("pub struct "), T.ty("Increment"), T.pl("<"), T.attr("'info"), T.pl("> {")] ],
        [ [T.pl("  "), T.deco("#[account(mut)]")] ],
        [ [T.pl("  "), T.kw("pub "), T.pl("counter: "), T.ty("Account"), T.pl("<"), T.attr("'info"), T.pl(", "), T.ty("Counter"), T.pl(">")] ],
        [ [T.pl("}")] ],
        [ [] ],
        [ [T.deco("#[account]")] ],
        [ [T.kw("pub struct "), T.ty("Counter"), T.pl(" { "), T.kw("pub "), T.pl("count: "), T.ty("u64"), T.pl(" }")] ],
      ],
      annotations: {
        12: { text: "Must declare ALL accounts upfront", color: "#f59e0b" },
        13: { text: "Lifetime annotations for account refs", color: "#f59e0b" },
        17: { text: "State is a separate Account struct", color: "#f59e0b" },
      },
      linesOfCode: 19,
    },
  },
  {
    id: "transfer",
    label: "Token Transfer",
    subtitle: "Send tokens between wallets",
    complexity: 2,
    evm: {
      lang: "Solidity (ERC-20)",
      lines: [
        [ [T.kw("contract "), T.ty("Token"), T.pl(" {")] ],
        [ [T.pl("  mapping("), T.ty("address "), T.pl("=> "), T.ty("uint256"), T.pl(") "), T.kw("public "), T.pl("balances;")] ],
        [ [] ],
        [ [T.pl("  "), T.kw("function "), T.fn("transfer"), T.pl("(")] ],
        [ [T.pl("    "), T.ty("address "), T.pl("to,")] ],
        [ [T.pl("    "), T.ty("uint256 "), T.pl("amount")] ],
        [ [T.pl("  ) "), T.kw("external"), T.pl(" {")] ],
        [ [T.pl("    "), T.kw("require"), T.pl("(balances["), T.kw("msg.sender"), T.pl("] >= amount, "), T.str('"insufficient"'), T.pl(");")] ],
        [ [T.pl("    balances["), T.kw("msg.sender"), T.pl("] -= amount;")] ],
        [ [T.pl("    balances[to] += amount;")] ],
        [ [T.pl("  }")] ],
        [ [T.pl("}")] ],
      ],
      annotations: {
        1:  { text: "Global mapping — all balances in one place", color: C.evm.hi },
        7:  { text: "msg.sender is implicit — no declaration", color: C.evm.hi },
      },
      linesOfCode: 12,
    },
    svm: {
      lang: "Rust (Anchor)",
      lines: [
        [ [T.deco("#[derive(Accounts)]")] ],
        [ [T.kw("pub struct "), T.ty("Transfer"), T.pl("<"), T.attr("'info"), T.pl("> {")] ],
        [ [T.pl("  "), T.deco("#[account(mut, has_one = owner)]")] ],
        [ [T.pl("  "), T.kw("pub "), T.pl("from_token: "), T.ty("Account"), T.pl("<"), T.attr("'info"), T.pl(", "), T.ty("TokenAccount"), T.pl(">")] ],
        [ [T.pl("  "), T.deco("#[account(mut)]")] ],
        [ [T.pl("  "), T.kw("pub "), T.pl("to_token:   "), T.ty("Account"), T.pl("<"), T.attr("'info"), T.pl(", "), T.ty("TokenAccount"), T.pl(">")] ],
        [ [T.pl("  "), T.kw("pub "), T.pl("owner:      "), T.ty("Signer"), T.pl("<"), T.attr("'info"), T.pl(">")] ],
        [ [T.pl("  "), T.kw("pub "), T.pl("token_prog: "), T.ty("Program"), T.pl("<"), T.attr("'info"), T.pl(", "), T.ty("Token"), T.pl(">")] ],
        [ [T.pl("}")] ],
        [ [] ],
        [ [T.kw("pub fn "), T.fn("transfer"), T.pl("(ctx: "), T.ty("Context"), T.pl("<"), T.ty("Transfer"), T.pl(">, amount: "), T.ty("u64"), T.pl(") -> "), T.ty("Result"), T.pl("<()> {")] ],
        [ [T.pl("  "), T.kw("let "), T.pl("cpi_ctx = "), T.ty("CpiContext"), T.pl("::"), T.fn("new"), T.pl("(")] ],
        [ [T.pl("    ctx.accounts.token_prog."), T.fn("to_account_info"), T.pl("(),")] ],
        [ [T.pl("    "), T.ty("token::Transfer"), T.pl(" { from: ..., to: ..., authority: ... }")] ],
        [ [T.pl("  );")] ],
        [ [T.pl("  "), T.ty("token"), T.pl("::"), T.fn("transfer"), T.pl("(cpi_ctx, amount)")] ],
        [ [T.pl("}")] ],
      ],
      annotations: {
        2:  { text: "Every account must be listed explicitly", color: "#f59e0b" },
        6:  { text: "Signer also declared as an account", color: "#f59e0b" },
        7:  { text: "Even the Token Program is an account!", color: "#f59e0b" },
        10: { text: "CPI (cross-program invocation) boilerplate", color: "#f59e0b" },
      },
      linesOfCode: 17,
    },
  },
  {
    id: "init",
    label: "Account Init",
    subtitle: "Create & allocate on-chain state",
    complexity: 3,
    evm: {
      lang: "Solidity",
      lines: [
        [ [T.kw("contract "), T.ty("Vault"), T.pl(" {")] ],
        [ [T.pl("  mapping("), T.ty("address "), T.pl("=> "), T.ty("uint256"), T.pl(") "), T.kw("public "), T.pl("deposits;")] ],
        [ [] ],
        [ [T.pl("  "), T.kw("function "), T.fn("deposit"), T.pl("() "), T.kw("external payable"), T.pl(" {")] ],
        [ [T.pl("    deposits["), T.kw("msg.sender"), T.pl("] += "), T.kw("msg.value"), T.pl(";")] ],
        [ [T.pl("  }")] ],
        [ [] ],
        [ [T.cmt("  // No initialization step needed —")] ],
        [ [T.cmt("  // mapping slots spring into existence")] ],
        [ [T.pl("}")] ],
      ],
      annotations: {
        1:  { text: "State stored in contract's own storage", color: C.evm.hi },
        7:  { text: "Zero-init is free, no rent to pay", color: C.evm.hi },
      },
      linesOfCode: 10,
    },
    svm: {
      lang: "Rust (Anchor)",
      lines: [
        [ [T.deco("#[derive(Accounts)]")] ],
        [ [T.kw("pub struct "), T.ty("InitVault"), T.pl("<"), T.attr("'info"), T.pl("> {")] ],
        [ [T.pl("  "), T.deco('#[account(init, payer = user, space = 8 + 32 + 8,')]  ],
        [ [T.pl("    "), T.deco("seeds = [b\"vault\", user.key().as_ref()],")]  ],
        [ [T.pl("    "), T.deco("bump)]")] ],
        [ [T.pl("  "), T.kw("pub "), T.pl("vault:      "), T.ty("Account"), T.pl("<"), T.attr("'info"), T.pl(", "), T.ty("Vault"), T.pl(">")] ],
        [ [T.pl("  "), T.deco("#[account(mut)]")] ],
        [ [T.pl("  "), T.kw("pub "), T.pl("user:       "), T.ty("Signer"), T.pl("<"), T.attr("'info"), T.pl(">")] ],
        [ [T.pl("  "), T.kw("pub "), T.pl("system_prog:"), T.ty("Program"), T.pl("<"), T.attr("'info"), T.pl(", "), T.ty("System"), T.pl(">")] ],
        [ [T.pl("}")] ],
        [ [] ],
        [ [T.kw("pub fn "), T.fn("init_vault"), T.pl("(ctx: "), T.ty("Context"), T.pl("<"), T.ty("InitVault"), T.pl(">) -> "), T.ty("Result"), T.pl("<()> {")] ],
        [ [T.pl("  ctx.accounts.vault.owner = ctx.accounts.user."), T.fn("key"), T.pl("();")] ],
        [ [T.pl("  "), T.ty("Ok"), T.pl("(())")] ],
        [ [T.pl("}")] ],
        [ [] ],
        [ [T.deco("#[account]")] ],
        [ [T.kw("pub struct "), T.ty("Vault"), T.pl(" { "), T.kw("pub "), T.pl("owner: "), T.ty("Pubkey"), T.pl(", "), T.kw("pub "), T.pl("lamports: "), T.ty("u64"), T.pl(" }")] ],
      ],
      annotations: {
        2:  { text: "Must pre-calculate exact byte size for rent", color: "#f59e0b" },
        3:  { text: "PDA seeds — deterministic address derivation", color: "#f59e0b" },
        8:  { text: "System program needed to create accounts", color: "#f59e0b" },
        11: { text: "Logic is just 1 line — rest is account setup", color: "#f59e0b" },
      },
      linesOfCode: 18,
    },
  },
];

// ── Complexity badges ─────────────────────────────────────────────────────────
const COMPLEXITY_LABELS = ["", "Simple", "Moderate", "Complex"];
const COMPLEXITY_COLORS = ["", "#22c55e", "#f59e0b", "#ef4444"];

// ── CodePanel ─────────────────────────────────────────────────────────────────
function CodePanel({ side, data, annotations = {} }) {
  const isEvm = side === "evm";
  const pal   = isEvm ? C.evm : C.svm;

  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: pal.bg,
      border: `1px solid ${pal.border}`,
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* header */}
      <div style={{
        padding: "10px 16px",
        background: `${pal.card}`,
        borderBottom: `1px solid ${pal.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: pal.mid, boxShadow: `0 0 8px ${pal.mid}` }} />
          <span style={{ color: pal.hi, fontSize: 11, fontWeight: 700, letterSpacing: 2, fontFamily: "monospace" }}>
            {isEvm ? "⬡ EVM" : "◎ SVM"}
          </span>
        </div>
        <span style={{ color: C.text.dim, fontSize: 10, fontFamily: "monospace" }}>{data.lang}</span>
        <span style={{
          background: `${pal.mid}22`, color: pal.hi,
          padding: "2px 8px", borderRadius: 4, fontSize: 10, fontFamily: "monospace",
        }}>{data.linesOfCode} lines</span>
      </div>

      {/* code */}
      <div style={{ padding: "14px 0", overflowX: "auto", flex: 1 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.7 }}>
          <tbody>
            {data.lines.map((line, i) => {
              const ann = annotations[i];
              return (
                <tr key={i} style={{
                  background: ann ? `${ann.color}12` : "transparent",
                  transition: "background 0.2s",
                }}>
                  {/* line number */}
                  <td style={{
                    width: 36, textAlign: "right", paddingRight: 14, paddingLeft: 8,
                    color: C.text.xdim, userSelect: "none", verticalAlign: "top",
                    borderRight: ann ? `2px solid ${ann.color}` : "2px solid transparent",
                    fontSize: 11,
                  }}>{i + 1}</td>
                  {/* code */}
                  <td style={{ paddingLeft: 14, paddingRight: 16, whiteSpace: "pre", verticalAlign: "top" }}>
                    {line.map((token, j) => (
                      <span key={j} style={{ color: token.type === "pl" ? C.text.bright : undefined }}>
                        {tok(token.type, token.text)}
                      </span>
                    ))}
                  </td>
                  {/* annotation */}
                  <td style={{ paddingRight: 14, verticalAlign: "middle", minWidth: ann ? 170 : 0 }}>
                    {ann && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: `${ann.color}20`,
                        border: `1px solid ${ann.color}55`,
                        borderRadius: 4, padding: "2px 8px",
                        color: ann.color, fontSize: 10, fontFamily: "monospace",
                        whiteSpace: "nowrap",
                      }}>
                        ← {ann.text}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ComplexityMeter ───────────────────────────────────────────────────────────
function ComplexityMeter({ evmLines, svmLines, complexity }) {
  const ratio = svmLines / evmLines;
  return (
    <div style={{
      background: "#0a0e1a", border: "1px solid #1e293b",
      borderRadius: 12, padding: "16px 20px", marginBottom: 20,
      display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ color: C.text.dim, fontSize: 10, fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>LINES OF CODE COMPARISON</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: C.evm.hi, fontSize: 11, fontFamily: "monospace" }}>EVM</span>
              <span style={{ color: C.evm.hi, fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>{evmLines}</span>
            </div>
            <div style={{ background: "#1e293b", borderRadius: 4, height: 8 }}>
              <div style={{ width: `${(evmLines / svmLines) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.evm.dim}, ${C.evm.mid})`, borderRadius: 4 }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: C.svm.hi, fontSize: 11, fontFamily: "monospace" }}>SVM</span>
              <span style={{ color: C.svm.hi, fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>{svmLines}</span>
            </div>
            <div style={{ background: "#1e293b", borderRadius: 4, height: 8 }}>
              <div style={{ width: "100%", height: "100%", background: `linear-gradient(90deg, ${C.svm.dim}, ${C.svm.mid})`, borderRadius: 4 }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { label: "Boilerplate ratio", value: `${ratio.toFixed(1)}×`, color: "#f59e0b" },
          { label: "Complexity", value: COMPLEXITY_LABELS[complexity], color: COMPLEXITY_COLORS[complexity] },
          { label: "Account decls", value: "Required in SVM", color: "#a78bfa" },
        ].map(m => (
          <div key={m.label} style={{ textAlign: "center" }}>
            <div style={{ color: m.color, fontFamily: "monospace", fontWeight: 700, fontSize: 18 }}>{m.value}</div>
            <div style={{ color: C.text.dim, fontSize: 10, marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Key Concepts sidebar ──────────────────────────────────────────────────────
const CONCEPTS = [
  {
    title: "Account Model",
    evm: "State lives inside the contract. msg.sender, msg.value are implicit. Mappings auto-initialize.",
    svm: "State lives in separate Account structs. Every account your code touches must be declared upfront and passed in.",
    evmColor: C.evm.hi, svmColor: C.svm.hi,
  },
  {
    title: "Rent & Space",
    evm: "Storage slots exist implicitly. No pre-allocation needed. Gas is paid per write.",
    svm: "You must pre-calculate the exact byte size of each account and pay rent-exempt lamports upfront.",
    evmColor: C.evm.hi, svmColor: C.svm.hi,
  },
  {
    title: "PDAs",
    evm: "Contracts have a fixed address. Deterministic addresses via CREATE2 are optional.",
    svm: "Program Derived Addresses (PDAs) are the primary pattern for on-chain state. Seeds + bump = deterministic, signer-less accounts.",
    evmColor: C.evm.hi, svmColor: C.svm.hi,
  },
  {
    title: "Why the complexity?",
    evm: "Single-threaded execution means the VM can lazily resolve state access — no need to declare it.",
    svm: "Parallel execution requires the scheduler to know all account dependencies before running. That's why you declare everything.",
    evmColor: C.evm.hi, svmColor: "#f59e0b",
  },
];

function ConceptCard({ c }) {
  return (
    <div style={{ background: "#0a0e1a", border: "1px solid #1e293b", borderRadius: 10, padding: 14, marginBottom: 10 }}>
      <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 12, fontFamily: "monospace", marginBottom: 8 }}>{c.title}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, background: `${C.evm.mid}18`, border: `1px solid ${C.evm.border}`, borderRadius: 6, padding: "8px 10px" }}>
          <div style={{ color: c.evmColor, fontSize: 9, fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 }}>⬡ EVM</div>
          <div style={{ color: C.text.mid, fontSize: 11, lineHeight: 1.5 }}>{c.evm}</div>
        </div>
        <div style={{ flex: 1, background: `${C.svm.mid}18`, border: `1px solid ${C.svm.border}`, borderRadius: 6, padding: "8px 10px" }}>
          <div style={{ color: c.svmColor, fontSize: 9, fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 }}>◎ SVM</div>
          <div style={{ color: C.text.mid, fontSize: 11, lineHeight: 1.5 }}>{c.svm}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState(0);
  const ex = EXAMPLES[active];

  return (
    <div style={{ minHeight: "100vh", background: "#030712", color: C.text.bright, fontFamily: "monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <div style={{ borderBottom: "1px solid #0f172a", padding: "20px 24px 16px" }}>
        <div style={{ fontSize: 10, letterSpacing: 4, color: C.text.dim, marginBottom: 6 }}>DEVELOPER EXPERIENCE</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
            <span style={{ color: C.evm.hi }}>EVM</span>
            <span style={{ color: C.text.xdim, margin: "0 12px" }}>vs</span>
            <span style={{ color: C.svm.hi }}>SVM</span>
            <span style={{ color: C.text.dim, fontSize: 14, fontWeight: 400, marginLeft: 12 }}>Code Complexity</span>
          </h1>
        </div>
        <p style={{ margin: "6px 0 0", color: C.text.dim, fontSize: 12 }}>
          Solidity's implicit state vs Rust/Anchor's explicit account declarations — why parallelism costs developer ergonomics
        </p>
      </div>

      <div style={{ display: "flex", gap: 0, minHeight: "calc(100vh - 100px)" }}>

        {/* ── Left sidebar: concepts ── */}
        <div style={{ width: 320, minWidth: 280, padding: "20px 16px", borderRight: "1px solid #0f172a", overflowY: "auto" }}>
          <div style={{ color: C.text.dim, fontSize: 10, letterSpacing: 2, marginBottom: 12 }}>KEY DIFFERENCES</div>
          {CONCEPTS.map(c => <ConceptCard key={c.title} c={c} />)}
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, padding: "20px 20px", overflowY: "auto", minWidth: 0 }}>

          {/* Example tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            {EXAMPLES.map((e, i) => (
              <button key={e.id} onClick={() => setActive(i)} style={{
                padding: "8px 18px", borderRadius: 8, cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700,
                border: active === i ? "1px solid #6366f1" : "1px solid #1e293b",
                background: active === i ? "#1e1b4b" : "#0a0e1a",
                color: active === i ? C.evm.hi : C.text.dim,
                transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                {e.label}
                <span style={{
                  background: `${COMPLEXITY_COLORS[e.complexity]}22`,
                  color: COMPLEXITY_COLORS[e.complexity],
                  padding: "1px 6px", borderRadius: 4, fontSize: 10,
                }}>{COMPLEXITY_LABELS[e.complexity]}</span>
              </button>
            ))}
          </div>

          {/* Subtitle */}
          <div style={{ marginBottom: 14, color: C.text.mid, fontSize: 12 }}>
            <span style={{ color: C.text.bright, fontWeight: 700 }}>{ex.label}</span>
            <span style={{ color: C.text.dim }}> · {ex.subtitle}</span>
          </div>

          {/* Complexity meter */}
          <ComplexityMeter
            evmLines={ex.evm.linesOfCode}
            svmLines={ex.svm.linesOfCode}
            complexity={ex.complexity}
          />

          {/* Side-by-side code */}
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <CodePanel side="evm" data={ex.evm} annotations={ex.evm.annotations} />
            <CodePanel side="svm" data={ex.svm} annotations={ex.svm.annotations} />
          </div>

          {/* Bottom note */}
          <div style={{
            marginTop: 16, padding: "12px 16px",
            background: "#0a0e1a", border: "1px solid #1e293b",
            borderRadius: 8, fontSize: 11, color: C.text.dim, lineHeight: 1.6,
          }}>
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>⚡ The tradeoff: </span>
            SVM's verbosity isn't a design flaw — it's the price of parallelism. By forcing developers to declare every account a transaction touches,
            Sealevel's scheduler can statically analyse conflicts and run non-overlapping transactions simultaneously.
            Solidity's implicit global state makes this impossible without a full execution trace.
          </div>
        </div>
      </div>
    </div>
  );
}