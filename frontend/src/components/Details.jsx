// Technical values (addresses, ids) stay behind a collapsed "Details" row.
export default function Details({ rows }) {
  return (
    <details className="tech">
      <summary>Details</summary>
      <dl className="kv mono">
        {rows.filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{String(v)}</dd></div>
        ))}
      </dl>
    </details>
  );
}
