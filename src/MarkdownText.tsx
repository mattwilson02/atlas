import { Fragment, type ReactNode } from "react";

// Small, dependency-free markdown renderer: headings, paragraphs, bullet and numbered
// lists (one level of nesting by indent), **bold**, *italic*, `code`, ~~strike~~ and links.
// Everything is built as React elements, never HTML strings, so pasted text can't inject markup.

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(~~[^~]+~~)|(\*[^*\s][^*]*\*)|(\b_[^_\s][^_]*_\b)|(\[[^\]]+\]\([^)\s]+\))/;

function inline(text: string, key = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index) out.push(rest.slice(0, m.index));
    const tok = m[0];
    const k = `${key}${i++}`;
    if (tok.startsWith("`")) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**") || tok.startsWith("__")) out.push(<strong key={k}>{inline(tok.slice(2, -2), k)}</strong>);
    else if (tok.startsWith("~~")) out.push(<del key={k}>{inline(tok.slice(2, -2), k)}</del>);
    else if (tok.startsWith("*") || tok.startsWith("_")) out.push(<em key={k}>{inline(tok.slice(1, -1), k)}</em>);
    else {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!;
      const safe = /^(https?:|mailto:)/i.test(href);
      out.push(
        safe ? (
          <a key={k} href={href} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
            {inline(label, k)}
          </a>
        ) : (
          tok
        ),
      );
    }
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

const lines = (text: string, key: string) =>
  text.split("\n").map((l, i, a) => (
    <Fragment key={i}>
      {inline(l, `${key}${i}-`)}
      {i < a.length - 1 && <br />}
    </Fragment>
  ));

type Item = { text: string; indent: number };

export function Markdown({ text, className }: { text: string; className?: string }) {
  const src = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: Item[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{lines(para.join("\n"), `p${blocks.length}-`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const { ordered, items } = list;
    const Tag = ordered ? "ol" : "ul";
    const base = items[0].indent;
    const k = blocks.length;
    // one level of nesting: deeper items hang off the previous top-level item
    const top: { text: string; sub: Item[] }[] = [];
    for (const it of items) {
      if (it.indent > base && top.length) top[top.length - 1].sub.push(it);
      else top.push({ text: it.text, sub: [] });
    }
    blocks.push(
      <Tag key={k}>
        {top.map((t, i) => (
          <li key={i}>
            {inline(t.text, `l${k}-${i}-`)}
            {t.sub.length > 0 && (
              <Tag>
                {t.sub.map((s, j) => (
                  <li key={j}>{inline(s.text, `l${k}-${i}-${j}-`)}</li>
                ))}
              </Tag>
            )}
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const line of src) {
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const li = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      const Tag = (`h${h[1].length + 2}`) as "h3" | "h4" | "h5";
      blocks.push(<Tag key={blocks.length}>{inline(h[2], `h${blocks.length}-`)}</Tag>);
    } else if (li) {
      flushPara();
      const ordered = /\d/.test(li[2]);
      if (list && list.ordered !== ordered && li[1].length <= list.items[0].indent) flushList();
      list ??= { ordered, items: [] };
      list.items.push({ text: li[3], indent: li[1].length });
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else if (list && /^\s+\S/.test(line)) {
      list.items[list.items.length - 1].text += " " + line.trim(); // wrapped list line
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div className={`md ${className ?? ""}`}>{blocks}</div>;
}
