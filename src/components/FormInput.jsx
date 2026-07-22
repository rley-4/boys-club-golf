export function FormInput({ value, onChange, type = "text", placeholder }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid #DCD6C4",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 13,
        fontFamily: "'Inter', sans-serif",
      }}
    />
  );
}

export default FormInput;
