export function AutoComputedNote({ children }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        color: "#6B6455",
        background: "#F3EFE2",
        border: "1px solid #E4DFCE",
        borderRadius: 10,
        padding: "10px 12px",
        lineHeight: 1.5,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

export default AutoComputedNote;
