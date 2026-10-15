/**
 * The AI support assistant's rules (owner, 2026-10-15): it answers support chats first, from what the site says about
 * itself and the person's own basics, and hands the chat to the team when a person is needed. Pure: the prompt, the
 * reply's shape and the checks are tested.
 */

export type ThreadMode = "ai" | "waiting" | "human";
export const isThreadMode = (v: unknown): v is ThreadMode => v === "ai" || v === "waiting" || v === "human";

/** What the assistant answers with. */
export type AssistantAnswer = { reply: string; handover: boolean; reason: string };

export const ASSISTANT_TOOL = {
  name: "support_reply",
  description: "The assistant's next message in the support chat, and whether a team member is needed.",
  input_schema: {
    type: "object",
    properties: {
      reply: { type: "string", description: "The message to the person, in their language. Plain text." },
      handover: { type: "boolean", description: "True when a team member must take over this chat." },
      reason: { type: "string", description: "When handover is true: one short English sentence for the team. Otherwise empty." },
    },
    required: ["reply", "handover", "reason"],
  },
};

/**
 * Asking for a person, in English, Bangla or Bangla written in English letters. Checked before the AI, so these
 * always reach the team.
 */
const HUMAN =
  /\b(human|real person|live agent|agent|representative|operator|talk to (a |the )?(person|someone|team|staff|admin|support)|speak to (a |the )?(person|someone|team|staff|admin)|customer (care|service)|manush|manus|admin er (sathe|shathe|sate)|kotha bolte chai)\b|মানুষ|এজেন্ট|প্রতিনিধি|অ্যাডমিনের সাথে|এডমিনের সাথে|কারো সাথে কথা|কথা বলতে চাই/i;

export const wantsHuman = (text: string) => HUMAN.test(text);

/** The reply as shown in the chat: plain text, no markdown, at most 1,500 characters. */
export function cleanReply(text: unknown): string {
  if (typeof text !== "string") return "";
  const s = text
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s.length > 1500 ? `${s.slice(0, 1499).trimEnd()}…` : s;
}

/** The AI's answer, checked: a reply is always there, and handing over needs a reason. */
export function readAnswer(raw: unknown): AssistantAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const reply = cleanReply(r.reply);
  if (!reply) return null;
  const handover = r.handover === true;
  const reason = handover ? (typeof r.reason === "string" && r.reason.trim() ? r.reason.trim().slice(0, 300) : "The person needs a team member.") : "";
  return { reply, handover, reason };
}

export type ChatLine = { who: "person" | "assistant" | "team"; text: string };

/** The conversation for the AI, oldest first, the last `max` messages. */
export function conversationText(lines: ChatLine[], max = 16): string {
  const label = { person: "Person", assistant: "Assistant", team: "Team member" } as const;
  return lines
    .slice(-max)
    .map((l) => `${label[l.who]}: ${l.text.replace(/\s+\n/g, "\n").trim()}`)
    .join("\n\n");
}

/** The instructions: who it is, how to answer, when to hand over, and what it may use. */
export function systemPrompt(input: { role: "client" | "designer"; siteInfo: string; person: string; pages: string }): string {
  return [
    "You are the logocontest.bd assistant in the site's support chat. logocontest.bd is a logo design contest site in Bangladesh: clients start a contest and pay the prize, designers send designs, the client picks a winner who gets the prize.",
    `You are chatting with a signed-in ${input.role}. Use only the SITE INFORMATION, the PAGES and the PERSON sections below.`,
    "",
    "Rules:",
    "1. Reply in the language and script of the person's LAST message only (earlier messages don't matter): Bangla script gets Bangla, English gets English, Bangla written in English letters (Banglish) gets Banglish.",
    "2. Be short, warm and clear: 1 to 4 sentences, or up to 5 short lines starting with •. Plain text only: no markdown, no headings, no bold.",
    "3. Only help with logocontest.bd. For anything else, say politely that you can only help with logocontest.bd.",
    "4. Never make up prices, dates, numbers, rules or features. If the answer is not in the information below, hand over.",
    "5. Never ask for or accept passwords, OTP codes or card numbers. Never share anything about other people.",
    "6. You cannot change anything (no refunds, payments, account or contest changes). Explain how the person can do it themselves when the information says how; otherwise hand over.",
    "7. Set handover to true only when: the person asks for a human or a team member; anything about money paid or owed (a payment not showing, refunds, withdrawals, wallet, prize money); bans, suspensions, strikes; copy claims, reports or disputes with a client or designer; something on the site not working; or you are not sure. Then your reply says a team member will answer in this same chat soon (usually within a few hours) and asks for useful details such as the contest name or the bKash transaction ID, never passwords or codes.",
    "8. Questions about the person's own contests, plan (Pro or Basic) or whether their email is confirmed: answer from PERSON, with the contest's name and its status said in the person's language. If they ask about a contest that is not listed, say you only see their latest ones and point to their dashboard. Do not hand over just because the question is about their account.",
    "9. When a page helps, give its full link from PAGES.",
    "10. reason: when handover is true, one short English sentence telling the team what the person needs; otherwise an empty string.",
    "",
    "SITE INFORMATION:",
    input.siteInfo,
    "",
    "PAGES:",
    input.pages,
    "",
    "PERSON:",
    input.person,
  ].join("\n");
}

/** The closing instruction, naming the script of the person's last message so the reply matches it. */
export function replyInstruction(conversation: string, lastFromPerson: string): string {
  const script = /[\u0980-\u09FF]/.test(lastFromPerson) ? "Bangla script, so reply in Bangla script" : "English letters, so reply in English, or in Banglish if it is Bangla written in English letters";
  return `CONVERSATION:\n${conversation}\n\nThe person's last message is written in ${script}. Write the assistant's next message to the person.`;
}

/** Midnight in Dhaka today (the daily limit of AI answers starts again then). */
export const dhakaMidnight = (now: Date) => {
  const DAY = 86_400_000;
  const SIX = 6 * 3_600_000;
  return new Date(Math.floor((now.getTime() + SIX) / DAY) * DAY - SIX);
};
