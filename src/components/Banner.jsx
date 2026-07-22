export function Banner({ tone, children }) {
  const styles =
    tone === "error"
      ? { bg: "#F7DCDA", fg: "#8C2F2A", border: "#D98884" }
      : tone === "info"
      ? { bg: "#F3EFE2", fg: "#6B6455", border: "#DCD6C4" }
      : { bg: "#DCEFE3", fg: "#1B4332", border: "#6FAE8C" };
  return (
    <div style={{ fontSize: 13, padding: "9px 12px", borderRadius: 8, background: styles.bg, color: styles.fg, border: `1px solid ${styles.border}` }}>
      {children}
    </div>
  );
}

export default Banner;
