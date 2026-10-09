import type { AgreementText, LegalDoc, LegalSlug } from "./types";

// Draft legal texts (owner, 2026-10-09). A Bangladeshi lawyer must check them before launch (BLUEPRINT §18).
// Numbers in {braces} come from settings, so they always match what the site really does.

export const LEGAL_EN: Record<LegalSlug, LegalDoc> = {
  terms: {
    title: "Terms of Use",
    description: "The rules for using logocontest.bd as a client or a designer.",
    summary: [
      "logocontest.bd runs logo design contests: a client pays a prize, designers send designs, the client picks a winner and gets the files and the copyright.",
      "Payments are non-refundable (see the Payment & No-Refund Policy).",
      "Designers must send only their own original work. Copying can lead to a fine, a ban and legal action.",
      "No contact details and no dealing outside the site.",
    ],
    sections: [
      {
        id: "about",
        heading: "About these terms",
        blocks: [
          'These terms are an agreement between you and logocontest.bd ("we", "us"). By creating an account, starting a contest or sending a design, you accept them, together with our Privacy Policy, Payment & No-Refund Policy and Designer Rules.',
          "We may update these terms. The date at the top shows the latest version. If a change is important, we will tell you on the site or by email before it applies. Using the site after that means you accept the new terms.",
        ],
      },
      {
        id: "accounts",
        heading: "Accounts",
        blocks: [
          {
            list: [
              "You must be at least 18 years old, or have a parent or guardian's permission, to use the site.",
              "Give true information and keep your mobile number and email up to date. One person, one account.",
              "Keep your password secret. You are responsible for what happens in your account.",
              "We may suspend or close an account that breaks these terms, the Designer Rules or the law.",
            ],
          },
        ],
      },
      {
        id: "contests",
        heading: "How a contest works",
        blocks: [
          {
            list: [
              "The client writes a brief, chooses a prize and a length ({minDays} to {maxDays} days), and pays. The contest goes live only after the payment is confirmed.",
              "Designers send designs while the contest is open. The client can rate, comment on and reject designs.",
              "After the contest ends, the client has {judging} days to pick one winner.",
              "The winner uploads the final files within {upload} days. The client then approves the files or asks for a change within {response} days.",
              "If the client does not pick a winner, or does not respond to the final files in time, the contest ends with no result and the prize is shared equally among the designers who took part. In that case no files are delivered and no copyright moves to the client.",
            ],
          },
        ],
      },
      {
        id: "copyright",
        heading: "Who owns the designs",
        blocks: [
          "When the client approves the final files, the full copyright of the winning design moves from the designer to the client. The designer signs this transfer when uploading the files and may not use, sell or show the winning design as their own work for anyone else (showing it in their portfolio on this site is allowed).",
          "Designs that do not win stay the property of their designers, but a designer may not sell or use a design that contains the client's name, brand or other details from the brief.",
          "By sending a design, a designer allows us to show it on the site (for example on the contest page, the designer's profile and the Design Studio), except where the client chose a private, blind or confidential (NDA) contest.",
        ],
      },
      {
        id: "copy-claims",
        heading: "Copied designs",
        blocks: [
          "Within {claimDays} days of picking the winner, the client can tell us the winning design is copied or breaks someone else's copyright. We look at the evidence, talk with the designer and decide. If the claim is proven, the client may pick another design and the designer may have to correct the design, pay a fine or lose their account. This is explained in the Payment & No-Refund Policy and the Designer Rules.",
        ],
      },
      {
        id: "conduct",
        heading: "What is not allowed",
        blocks: [
          {
            list: [
              "Sharing or asking for phone numbers, emails, social media or other contact details, or arranging work or payment outside the site.",
              "Sending copied, traced, stock, pre-made or AI-generated logos.",
              "Using trademarks or famous brand elements without the right to do so.",
              "Abusive, hateful, sexual or illegal content in briefs, designs or comments.",
              "Fake accounts, fake ratings, or trying to trick the contest, the payment system or other users.",
            ],
          },
        ],
      },
      {
        id: "our-role",
        heading: "Our role and responsibility",
        blocks: [
          "We provide the platform, hold the prize safely and pay the designer once the files are approved. We do not design the logos ourselves and we cannot promise that a contest will get a certain number or quality of designs.",
          "Before using a logo, the client should check that it suits their business, and may wish to register it as a trademark. To the extent the law allows, we are not responsible for indirect losses, and our total responsibility for any contest is limited to the amount paid for that contest.",
        ],
      },
      {
        id: "law",
        heading: "Law and disputes",
        blocks: [
          "These terms follow the laws of Bangladesh. If there is a problem, please contact us first so we can try to solve it. If it cannot be solved, the courts of Bangladesh will decide.",
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        blocks: ["Questions about these terms: use the Help page (live chat, WhatsApp or Messenger) or call {phone}."],
      },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    description: "What personal information logocontest.bd collects, why, and who can see it.",
    summary: [
      "We collect only what we need to run contests, take payments and pay designers.",
      "Designers' ID numbers (NID, passport or birth certificate) are seen only by our admins, shown masked, and used only for copy and fraud cases.",
      "We never sell your information.",
    ],
    sections: [
      {
        id: "collect",
        heading: "What we collect",
        blocks: [
          {
            list: [
              "Account: name, username, mobile number, email, password (stored only in scrambled form), photo, language.",
              "Clients: business name, the contest brief and files you upload, payments.",
              "Designers: bio, portfolio details, designs and final files, payout details (bKash number or bank account), and the originality agreement (full name, mobile, address, ID type and ID number, typed signature).",
              "Activity: comments, ratings, reports, notifications, and the date, time, IP address and browser when you accept declarations or sign the agreement.",
              "Payments: amount, status and the payment provider's transaction ID. Card and bKash PINs are entered with the payment provider, never on our site.",
            ],
          },
        ],
      },
      {
        id: "use",
        heading: "Why we use it",
        blocks: [
          {
            list: [
              "To run your account, contests, handovers and wallet.",
              "To take payments and send payouts.",
              "To send notifications, emails and SMS about your contests and account.",
              "To keep the site safe: the no-contact filter, copy checks, reports, and preventing fraud.",
              "To follow the law and, when needed, to take legal action about copied designs or fraud.",
            ],
          },
        ],
      },
      {
        id: "id-numbers",
        heading: "ID numbers in the designer agreement",
        blocks: [
          "Before their first design, every designer gives an ID number (NID, passport or birth certificate) in the originality agreement. We collect it so that, if a design turns out to be copied, we know who is responsible and can take legal steps.",
          "We do not check the number with any government database. Only our admins can see it, it is shown masked (for example ••••••3456), and every time an admin opens the full number it is recorded. It is never shown on public pages or to clients, and is shared only if the law requires it or in a legal case about that designer's work.",
        ],
      },
      {
        id: "public",
        heading: "What others can see",
        blocks: [
          "Your username, name, photo and public profile (for designers: bio, portfolio details, wins, total earned and public designs; for clients: total spent) are public. Mobile numbers, emails, addresses, payout details and ID numbers are never shown to other users.",
        ],
      },
      {
        id: "sharing",
        heading: "Who we share it with",
        blocks: [
          "Only the services that help us run the site, and only what they need: our hosting and database provider, payment providers (such as SSLCommerz and bKash), email and SMS providers, and the live chat provider if you use live chat. We share information with the authorities only when the law requires it. We never sell personal information.",
        ],
      },
      {
        id: "cookies",
        heading: "Cookies",
        blocks: ["We use cookies to keep you logged in and remember your language. We do not use advertising cookies."],
      },
      {
        id: "keep",
        heading: "How long we keep it",
        blocks: [
          "We keep account information while your account is open. Contest, payment, wallet and agreement records are kept after that for as long as the law and possible disputes require, because they are needed to prove payments and copyright transfers.",
        ],
      },
      {
        id: "rights",
        heading: "Your choices",
        blocks: [
          "You can change most of your details in your profile settings. To see the information we hold about you, correct something you cannot change yourself (such as your signed agreement), or close your account, contact us through the Help page.",
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        blocks: ["Privacy questions: use the Help page or call {phone}."],
      },
    ],
  },

  "payment-refund": {
    title: "Payment & No-Refund Policy",
    description: "How contest payments, designer payouts and the no-refund rule work on logocontest.bd.",
    summary: [
      "The client pays the prize plus a service fee before the contest goes live.",
      "Payments are not refunded.",
      "One exception, which is not a money refund: if the winning design is proven to be copied, the client may pick another design.",
      "The designer is paid after the client approves the files and the {claimDays}-day claim period has passed.",
    ],
    sections: [
      {
        id: "client-pays",
        heading: "What the client pays",
        blocks: [
          {
            list: [
              "The prize for the designer, plus a service fee of {fee}% of the prize ({largeFee}% when the prize is above {largeFrom}).",
              "Any upgrades chosen (for example Featured, Blind, Private, NDA), and any extension bought later ({perDay} per day added).",
              "Payment is made through our payment provider (bKash or card). The contest goes live only after the payment is confirmed. We hold the prize until the files are approved.",
            ],
          },
        ],
      },
      {
        id: "no-refund",
        heading: "No refunds",
        blocks: [
          "Designers start working from the first day of a contest, so all payments are final. We do not refund the prize, the service fee, upgrades or extensions, including when:",
          {
            list: [
              "you do not like the designs or receive fewer designs than you hoped;",
              "you do not pick a winner in time (the prize is then shared among the designers, see below);",
              "you change your mind, close your business or no longer need a logo.",
            ],
          },
          "Please read your brief carefully before you pay.",
        ],
      },
      {
        id: "copy-exception",
        heading: "The one exception: a copied winning design",
        blocks: [
          "Within {claimDays} days of picking the winner, the client can report through the contest page or our support that the winning design is copied or breaks someone else's copyright. The client should explain the problem and share links (for example to the original logo).",
          {
            list: [
              "While we check, the designer's prize is frozen.",
              "We look at the evidence and talk with the designer. If the claim is proven, the client may pick another design from the contest, and the designer may be asked to correct the design, be fined, or be banned.",
              "If the claim is not proven, the contest continues as normal.",
              "This is not a money refund: the payment stays with the contest and goes to the designer whose design is finally approved.",
            ],
          },
        ],
      },
      {
        id: "no-result",
        heading: "When the client stays silent",
        blocks: [
          "If the client does not pick a winner within {judging} days of the end, or does not approve or ask for a change within {response} days of receiving the final files, the contest ends with no result. The prize is shared equally among the designers who took part, the client receives no files and no copyright moves. The payment is not refunded.",
        ],
      },
      {
        id: "payment-errors",
        heading: "Payment problems",
        blocks: [
          "If money was taken twice by mistake, or taken but the contest did not go live, contact us with the transaction ID. We will check with the payment provider and correct it.",
        ],
      },
      {
        id: "designer-payouts",
        heading: "How designers are paid",
        blocks: [
          {
            list: [
              "The winner's prize reaches their wallet when the client approves the files and {claimDays} days have passed since the winner was picked, with no copy claim open.",
              "Our designer fee is taken from the prize: {tiers}. The rate is fixed when the winner is picked.",
              "No-result shares reach the wallet right away, after the same fee.",
              "Designers can withdraw from {withdrawMin} to bKash or a bank account. A rejected withdrawal goes back to the wallet.",
            ],
          },
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        blocks: ["Payment questions: use the Help page or call {phone}."],
      },
    ],
  },

  "designer-rules": {
    title: "Designer Rules",
    description: "The rules every designer on logocontest.bd agrees to.",
    summary: [
      "Only your own, original, human-made logos.",
      "No contact details, no dealing outside the site.",
      "Deliver the final files within {upload} days if you win.",
      "Copying can mean a fine, a permanent ban and legal action.",
    ],
    sections: [
      {
        id: "original",
        heading: "Original work only",
        blocks: [
          {
            list: [
              "Every design must be made by you, for this brief. No copying or tracing other logos, no templates, stock artwork, pre-made or resold logos.",
              "No AI-generated logos. AI may be used only for mockup backgrounds.",
              "No trademarks or famous brand elements.",
              "Fonts and images you use must be ones you are allowed to use commercially.",
            ],
          },
        ],
      },
      {
        id: "agreement",
        heading: "The originality agreement",
        blocks: [
          "Before your first design you sign a one-time originality agreement with your full name, mobile number, address and an ID number (NID, passport or birth certificate). You promise that your designs are your own work and accept that if a copied design is found after you win, legal action may be taken against you under the laws of Bangladesh. See the Privacy Policy for how your ID number is protected.",
        ],
      },
      {
        id: "contact",
        heading: "No contact outside the site",
        blocks: [
          "Never share or ask for phone numbers, emails, social media, websites or other contact details, in designs, comments or files. Talk to clients only through the comment boxes. Our filter blocks messages with contact details.",
        ],
      },
      {
        id: "winning",
        heading: "If you win",
        blocks: [
          {
            list: [
              "Upload the AI, EPS, SVG, PDF, transparent PNG and JPG files, the font names, and any extras the client asked for, within {upload} days. If you miss the deadline, the win is cancelled and you get no prize.",
              "Accept the copyright transfer: once the client approves, the design belongs to the client.",
              "Your prize reaches your wallet after the client approves and {claimDays} days have passed since the pick, with no copy claim open.",
            ],
          },
        ],
      },
      {
        id: "copies",
        heading: "Reports and copied designs",
        blocks: [
          "Clients and designers can report a design as copied, AI-made or breaking the rules. Admins check every report. A design proven to be copied is removed.",
          "If the winning design is proven to be copied, our admin talks with you and decides one of: a correction (you must send corrected files), a fine (taken from your wallet) or a permanent ban. In every case the win can be cancelled and the prize withheld, and legal action may be taken.",
        ],
      },
      {
        id: "conduct",
        heading: "Respect",
        blocks: [
          "Be polite in comments. No abusive, hateful or sexual content. Do not make fake accounts or rate or report others unfairly. Repeated false reports lead to warnings and a ban.",
        ],
      },
    ],
  },
};

export const AGREEMENT_EN: AgreementText = {
  title: "Designer originality agreement",
  intro: "I, the designer named above, agree to the following with logocontest.bd:",
  clauses: [
    "Every design I submit is my own original work, made by me for that contest. It is not copied, traced or adapted from any other logo, template, stock artwork or someone else's work, and it is not made by AI.",
    "I do not use any trademark or famous brand element, or any font or image I am not allowed to use commercially.",
    "If I win, I will deliver the final files on time and transfer the full copyright of the winning design to the client.",
    "If any design I submit is found to be copied or to break someone else's copyright, including after I have won, logocontest.bd may remove the design, cancel my win, withhold my prize, fine me, and ban my account.",
    "If a copied design is found after I win, I understand that legal action may be taken against me under the laws of Bangladesh, and that I am responsible for any loss caused to the client or to logocontest.bd.",
    "The name, mobile number, address and ID number I have given are true and my own. logocontest.bd may use them to contact me and, if needed, in legal action about my work.",
  ],
  closing: "I sign this agreement by typing my full name below. The date, time and my IP address are recorded with my signature.",
};
