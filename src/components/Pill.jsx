// Shared rounded "pill" shape behind `StatusBadge`, `ProgressBadge`,
// `PointsBadge`, and `YearPill` in AppShell.jsx — each of those keeps its
// own label/color logic and becomes a thin wrapper around this element so
// none of their visual output changes.
export function Pill({ as: Tag = "span", children, bg, fg, border, fontSize = 10.5, fontWeight = 600, padding = "3px 9px", mono = false, style, ...rest }) {
  return (
    <Tag
      className={mono ? "bco-mono" : undefined}
      style={{
        fontSize,
        fontWeight,
        padding,
        borderRadius: 999,
        background: bg,
        color: fg,
        whiteSpace: "nowrap",
        ...(border ? { border } : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Pill;
