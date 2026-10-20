/**
 * The drawn gift box of the monthly prizes (owner, 2026-10-20: both prizes are gift boxes now, the smartphone is gone).
 * Red with a gold ribbon for designers, on the cream cards; gold with a white ribbon for clients, so it stands out on
 * the red cards. Drawn shapes only: what is inside stays a surprise. 190 × 200 px; scale it from outside.
 */
export function GiftBox({ gold = false }: { gold?: boolean }) {
  const c = gold
    ? { body: "bg-[linear-gradient(180deg,#FFD65C,#F2A33A)]", lid: "bg-[#FFE27A]", ribbon: "bg-white", bow: "border-white", shadow: "drop-shadow-[0_24px_28px_rgba(0,0,0,.38)]", shine: "bg-white/50" }
    : { body: "bg-[linear-gradient(180deg,#A30F0F,#8B0000)]", lid: "bg-[#B3201B]", ribbon: "bg-[#D08A1E]", bow: "border-[#D08A1E]", shadow: "drop-shadow-[0_24px_28px_rgba(92,10,12,.3)]", shine: "bg-white/30" };
  return (
    <span className={`relative block h-[200px] w-[190px] -rotate-6 ${c.shadow}`}>
      <span className={`absolute inset-x-[9px] bottom-0 top-[70px] rounded-[6px_6px_16px_16px] ${c.body}`} />
      <span className={`absolute inset-x-0 top-[38px] h-10 rounded-[11px] ${c.lid}`} />
      <span className={`absolute bottom-0 left-1/2 top-[38px] -ml-[15px] w-[30px] ${c.ribbon}`} />
      <span className={`absolute left-1/2 top-0 -ml-[54px] h-[42px] w-[52px] rounded-[50%_50%_0_50%] border-[10px] ${c.bow}`} />
      <span className={`absolute left-1/2 top-0 ml-0.5 h-[42px] w-[52px] rounded-[50%_50%_50%_0] border-[10px] ${c.bow}`} />
      <span className={`absolute left-[22px] top-24 h-2 w-[34px] rounded-[9px] ${c.shine}`} />
    </span>
  );
}
