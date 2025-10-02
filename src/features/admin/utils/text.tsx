export const escapeRegExp = (s: string) =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const highlightText = (text: string, query: string) => {
  if (!query) return <>{text}</>;
  const re = new RegExp(escapeRegExp(query), "gi");
  const parts = String(text).split(re);
  const matches = String(text).match(re) || [];
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < matches.length && (
            <mark className="bg-yellow-500/30 px-0.5 rounded">
              {matches[i]}
            </mark>
          )}
        </span>
      ))}
    </>
  );
};
