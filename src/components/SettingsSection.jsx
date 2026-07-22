export function SettingsSection({ title, description, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1B4332", marginBottom: 4 }}>{title}</div>
      {description && <div style={{ fontSize: 11, color: "#8A8371", marginBottom: 10, lineHeight: 1.5 }}>{description}</div>}
      {children}
    </div>
  );
}

export default SettingsSection;
