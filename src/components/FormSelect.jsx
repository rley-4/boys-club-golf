export function FormSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid #DCD6C4",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 13,
        fontFamily: "'Inter', sans-serif",
        background: "#FFFFFF",
        color: "#2C2A22",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default FormSelect;
