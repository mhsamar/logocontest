// While a client page loads, the top bar and the menu stay and the page area shows soft placeholders (owner,
// 2026-10-17: "the menu takes time to come").
export default function ClientLoading() {
  return (
    <div className="cload" aria-busy="true" aria-label="Loading">
      <span className="cl1" />
      <span className="cl2" />
      <div className="cl3">
        <span />
        <span />
        <span />
      </div>
      <span className="cl4" />
    </div>
  );
}
