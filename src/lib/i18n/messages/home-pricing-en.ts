/**
 * New home page (owner, 2026-10-29; Design/logocontest-site/index.html). en.ts puts it under "home2.pricing".
 * The "Simple pricing" section: the design's words, except the lines the owner had rewritten from the real rules
 * (fee %, AI checker, file days, refunds, card, the monthly gift box). Amounts come in already formatted.
 */
const homePricingEn = {
  pill: "Simple pricing",
  title: "Pick your prize. Get many logo ideas.",
  lead: "The prize goes to your winning designer.",
  leadFee: "A {fee}% platform fee is added on top.",
  leadFeeLarge: "A {fee}% platform fee is added on top ({largeFee}% for prizes above {largeFrom}).",
  pay: {
    bkashCard: "Pay once with bKash or card.",
    bkash: "Pay once with bKash.",
    card: "Pay once by card.",
  },
  names: { economy: "Economy", standard: "Standard", premium: "Premium", custom: "Custom" },
  popular: "Most popular",
  total: "prize · {total} total with fee",
  toWinner: "{prize} goes to your winning designer",
  fee: "{pct}% platform fee: {fee}",
  checks: "{n} AI Logo Checker checks free",
  checksOne: "{n} AI Logo Checker check free",
  invite: "Invite Pro designers",
  rate: "Rate and comment on every entry",
  // The client race (owner, 2026-10-20: a gift box, no smartphone): most contests wins, a bigger prize total wins a tie.
  giftBox: "Bigger prizes win a tie for the monthly gift box",
  start: { economy: "Start Economy", standard: "Start Standard", premium: "Start Premium", custom: "Start Custom" },
  custom: {
    prize: "Your prize",
    sub: "you set the amount · {fee}% fee on top",
    subLarge: "you set the amount · {fee}% fee on top, {largeFee}% above {largeFrom}",
    setAny: "Set any prize you want, from {min}",
    phone: "Help from our team on the phone",
    call: "Call {phone}",
  },
  safe: {
    pill: "Your money is held safe",
    title: "Where does your money go?",
    text: "You pay once at the start. logocontest.bd keeps the prize money safe. The winner gets it only after you pick them and get your files.",
    step1: "You pay prize + {fee}% fee",
    step1Large: "You pay prize + fee ({fee}%, {largeFee}% above {largeFrom})",
    payWith: {
      bkashCard: "Pay with bKash or card.",
      bkash: "Pay with bKash.",
      card: "Pay by card.",
    },
    manual: "Send the transaction ID and we approve your contest.",
    auto: "Your contest goes live as soon as the payment goes through.",
    mixed: "Online payments go live at once. If you pay to our bKash number, send the transaction ID and we approve your contest.",
    step2: "We hold the prize",
    step2Text: "Designers see the prize is locked in, so they work seriously and send their best ideas.",
    step3: "You pick the winner",
    step3Text: "Rate entries, check them with the AI Logo Checker, then choose the one you love.",
    step4: "Files first, then payment",
    step4Text: "The winner sends all files within {n} days. Then the prize goes to the designer’s wallet.",
    step4TextOne: "The winner sends all files within {n} day. Then the prize goes to the designer’s wallet.",
  },
  example: {
    title: "Example: Standard contest",
    prize: "Prize for the winning designer",
    fee: "Platform fee ({pct}%)",
    total: "You pay",
  },
  why: {
    title: "Why do you pay first?",
    prize: "A guaranteed prize brings more and better designers.",
    fee: "The {fee}% fee runs the contest, the AI checker and our support.",
    feeLarge: "The fee runs the contest, the AI checker and our support.",
    files: "The winner is paid only after you have your final files.",
  },
  notes: {
    blind: "Blind entries: paid extra ({price})",
    blindFree: "Blind entries: paid extra ({price}), free with a prize of {from} or more",
    files: "Winner’s files delivered within {n} days",
    filesOne: "Winner’s files delivered within {n} day",
    noRefund: "No refunds once a contest is live",
    // Money-back guarantee on (owner, 2026-10-21): the one case with a refund, as the Q&A answer says.
    guarantee: "No refunds once a contest is live, unless fewer than {n} different designers send designs",
  },
};

export default homePricingEn;
