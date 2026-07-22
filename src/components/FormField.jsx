export function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

export default FormField;
