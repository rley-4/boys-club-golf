// Thin wrapper over the `.bco-save-btn` / `.bco-nav-btn` / `.bco-step-btn`
// CSS classes (defined in AppShell.jsx's SHARED_STYLES) so call sites read
// as a component with a variant instead of a raw `<button className="...">`.
// Deliberately doesn't touch the underlying CSS/colors — that's covered by
// the P0 design-token work and the later P1 MUI `Button` migration.
const VARIANT_CLASS = {
  save: "bco-save-btn",
  nav: "bco-nav-btn",
  step: "bco-step-btn",
};

export function Button({ variant = "save", className, ...rest }) {
  const variantClass = VARIANT_CLASS[variant];
  return <button className={[variantClass, className].filter(Boolean).join(" ") || undefined} {...rest} />;
}

export default Button;
