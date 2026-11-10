// Material Symbols Rounded by name. Always put a text label next to it.
export default function Icon({ name, fill = false, size, className = "", style }) {
  return (
    <span className={`ic ${fill ? "fill" : ""} ${className}`} aria-hidden="true" style={{ ...(size ? { fontSize: size } : {}), ...style }}>
      {name}
    </span>
  );
}
