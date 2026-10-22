import type { AgreementText, LegalDoc, LegalSlug } from "./types";

// Draft legal texts (owner, 2026-10-09). A Bangladeshi lawyer must check them before launch (BLUEPRINT §18).
// Numbers in {braces} come from settings, so they always match what the site really does.

export const LEGAL_EN: Record<LegalSlug, LegalDoc> = {
  terms: {
    title: "Terms of Use",
    description: "The rules for using logocontest.bd as a client or a designer.",
    summary: [
      "logocontest.bd runs design contests (logos and other designs): a client pays a prize, designers send designs, the client picks a winner and gets the files and the copyright.",
      "Payments are non-refundable, except under the money-back guarantee (see the Payment & Refund Policy).",
      "Designers must send only their own original work. Copying leads to a fine or a ban, and logocontest.bd will take legal action.",
      "No contact details and no dealing outside the site.",
    ],
    sections: [
      {
        id: "about",
        heading: "About these terms",
        blocks: [
          'These terms are an agreement between you and logocontest.bd ("we", "us"). By creating an account, starting a contest or sending a design, you accept them, together with our Privacy Policy, Payment & Refund Policy and Designer Rules.',
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
              "Confirm your email address. Designers must confirm it before sending a design.",
              "Some rule breaks suspend an account for {suspendHours} hours: it can't send designs, comment or like until then, and the suspension ends on its own. {ban} suspensions within {strikeDays} days mean a permanent ban (see the Designer Rules).",
              "We ban an account permanently when it breaks these terms, the Designer Rules or the law in a serious way: for example a nude or sexual contest or design, or no final files within {upload} days of winning.",
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
              "The client writes a brief, chooses a prize and a length ({minDays} to {maxDays} days), and pays. The contest goes live only after the payment is confirmed. A contest still unpaid {unpaidHours} hours after it was started is removed.",
              "Designers send designs while the contest is open ({designsRule}). The client can rate, comment on and reject designs.",
              "After the contest ends, the client has {judging} days to pick one winner.",
              "The winner uploads the final files within {upload} days. The client then approves the files or asks for a change within {response} days; changes go on until the client approves.",
              "If the client does not pick a winner, or does not respond to the final files in time, the contest ends with no result and the prize is shared equally among the designers who took part. In that case no files are delivered and no copyright moves to the client.",
              "On a contest with the money-back guarantee, if fewer than {guaranteeDesigners} different designers took part, the client claims it in time and we approve the claim, the contest is cancelled instead: the client is refunded and the designers receive no share.",
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
          "Within {claimDays} days of picking the winner, the client can tell us the winning design is copied or breaks someone else's copyright. We look at the evidence, talk with the designer and decide. If the claim is proven, the client may pick another design and the designer may have to correct the design, pay a fine or lose their account. This is explained in the Payment & Refund Policy and the Designer Rules.",
        ],
      },
      {
        id: "logo-checker",
        heading: "The AI logo checker",
        blocks: [
          "The logo checker uses AI and image search to look for similar logos on the web and on this site. Its report and certificate are research made on the date shown. They are not a legal guarantee, a trademark search or legal advice, and they cannot see logos that are not online.",
        ],
      },
      {
        id: "pro",
        heading: "Designer Pro plan",
        blocks: [
          {
            list: [
              "Pro is a paid plan for designers, one month at a time. The Pro page shows its price and what it includes.",
              "Pro does not renew by itself: we remind you before it ends, and you can renew with one tap. If you cancel, Pro stays on until the end of the month you paid for.",
              "Pro payments are not refunded (see the Payment & Refund Policy).",
            ],
          },
        ],
      },
      {
        id: "support",
        heading: "Support chat",
        blocks: [
          "Our support chat is answered first by an AI assistant. Its answers are general help and can be wrong; a team member takes over when you ask for one or when it is needed. If the assistant says something different from these terms or our policies, the terms and policies apply.",
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
              "Abusive, hateful or illegal content in briefs, designs or comments, including bad words.",
              "Nude, sexual or adult content of any kind: in a contest, a brief, a reference image or a design. Before making a contest the client agrees to this rule. A client who makes such a contest anyway is banned permanently, the contest is removed and the payment is not refunded. A designer who sends such a design is banned permanently.",
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
          "If there is a problem, please contact us first so we can solve it together. If someone breaks these terms, copies designs or commits fraud, logocontest.bd will take legal action.",
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
      "Some features use trusted services, such as Google's AI for the logo checker and the support assistant.",
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
              "Payments: amount, status and the transaction ID. Card details and bKash PINs are never entered on our site.",
              "Logins: the device, browser, IP address and approximate city of each login, to keep your account safe.",
              "Support chats and logo checks: your messages to support and the replies, and the logos you check with their results.",
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
              "To send notifications and emails about your contests and account. You can stop emails you don't need with the Unsubscribe link in each email; codes and security emails always come.",
              "To answer support chats (first with our AI assistant) and to run logo checks.",
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
          "Your username, name, photo and public profile (for designers: bio, portfolio details, wins and public designs; for clients: total spent) are public. Mobile numbers, emails, addresses, payout details and ID numbers are never shown to other users.",
        ],
      },
      {
        id: "sharing",
        heading: "Who we share it with",
        blocks: [
          "Only the services that help us run the site, and only what they need: Vercel (hosting), Supabase (database and file storage), bKash (payments in taka), Stripe (card payments in US dollars), Resend (emails), Google (Gemini AI and Cloud Vision) and SearchAPI (image search) for the logo checker and the support assistant, and your browser's notification service if you allow notifications. We share information with the authorities only when the law requires it. We never sell personal information.",
        ],
      },
      {
        id: "cookies",
        heading: "Cookies",
        blocks: [
          "We use cookies to keep you logged in and to remember your language and currency.",
          "To see how the site is used, we count page visits with an anonymous visitor cookie: the page, the site you came from, your device type and your country. If you are logged in, the visit is linked to your account so our team can help you. We do not store your IP address with these visit records, and they are deleted after 180 days.",
          "When ads are shown on the site, they come from Google AdSense. Third-party vendors, including Google, use cookies to serve ads based on your earlier visits to this website or other websites. Google's use of advertising cookies lets it and its partners show you ads based on your visits to this site and other sites on the internet. You can turn off personalised ads in Google's Ads Settings (adssettings.google.com), or turn off some other vendors' cookies at www.aboutads.info.",
        ],
      },
      {
        id: "keep",
        heading: "How long we keep it",
        blocks: [
          "We keep account information while your account is open. A deleted account stays in our trash for {trashDays} days so it can be restored, then it is erased. Contest, payment, wallet and agreement records are kept for as long as the law and possible disputes require, because they are needed to prove payments and copyright transfers. Login records are deleted after 180 days.",
        ],
      },
      {
        id: "rights",
        heading: "Your choices",
        blocks: [
          "You can change most of your details, and which emails you get, in your profile settings. To see the information we hold about you, correct something you cannot change yourself (such as your signed agreement), or close your account, contact us through the Help page.",
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
    title: "Payment & Refund Policy",
    description: "How contest payments, designer payouts, the no-refund rule and the money-back guarantee work on logocontest.bd.",
    summary: [
      "The client pays the prize plus a service fee before the contest goes live.",
      "Payments are not refunded, except under the {guaranteeDesigners}-designer money-back guarantee (for contests that have it).",
      "If the winning design is proven to be copied, the client may pick another design (this is not a money refund).",
      "The designer is paid {holdDays} days after the client approves the files, if no copy claim is open.",
      "Designer Pro plan payments are for one month and are not refunded.",
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
              "You pay with bKash: send the amount to our bKash number and enter the transaction ID. Our team checks it, and the contest goes live once the payment is confirmed. Visitors from abroad can pay by card in US dollars through Stripe. We hold the prize until the files are approved.",
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
              "you do not like the designs or receive fewer designs than you hoped (unless the money-back guarantee below applies);",
              "you do not pick a winner in time (the prize is then shared among the designers, see below);",
              "you change your mind, close your business or no longer need a logo;",
              "your contest is removed because it asks for nude, sexual or adult content. Your account is then also banned permanently.",
            ],
          },
          "Please read your brief carefully before you pay.",
        ],
      },
      {
        id: "guarantee",
        heading: "Money back if fewer than {guaranteeDesigners} designers take part",
        blocks: [
          "This guarantee is for contests paid while we offer it. A contest that has it shows it before you pay and on your contest page, with the number of designers that applies to it, and keeps it even if we later change or stop the guarantee.",
          {
            list: [
              "If your contest ends with designs from fewer than {guaranteeDesigners} different designers, you can claim back everything you paid for that contest: the prize, the service fee and any upgrades, extensions or add-ons. We do not deduct any fees. A promo code you used is not given back.",
              "Who counts: every designer with at least one design in your contest, including designs you rejected. Several designs from one designer count as one designer. A design its designer took back counts only if you had rejected it; a design our team removed for breaking the rules does not count. Designs our team is still checking count once approved. Designs one person sent from more than one account count as one designer, and a design that clearly ignores the brief may be left out after our team checks it.",
              "When to claim: press \"Claim my money back\" on your contest page within {judging} days of the end and before you pick a winner. Once you pick a winner (even if that win is later cancelled), or once the {judging} days are over and the prize has been shared, the guarantee no longer applies. If the prize could not be shared with anyone, you can still claim within {lateDays} days of the end.",
              "If you think some designers should not count, you can ask us to check the count the same way, with your reason.",
              "While we check your claim, picking a winner is paused. If we approve it, the contest is cancelled and we send the money back the way you paid: bKash payments to the bKash number you give us, card payments to the same card in the currency you paid (your bank's exchange rate may differ), and payments through an automatic gateway (bKash checkout, SSLCommerz) back through that gateway. We aim to send it within 7 working days of approval; a card refund can take a few more days to show in your bank.",
              "If we do not approve it, we tell you why. If you claimed while you could still pick a winner, you get at least {repick} more days to pick one. You can claim only once per contest.",
              "You receive no files and no rights to any design in the contest: the designs stay with their designers and you may not use them. Using a design from a refunded contest means you owe its designer the prize plus our service fee. The designers receive no prize and no share.",
              "We may refuse a claim if the number of designers was lowered by breaking our rules (for example by asking designers outside the site to take their designs back), or if design files or a payment were arranged outside the site.",
              "A refunded contest does not count toward the monthly client prize.",
            ],
          },
        ],
      },
      {
        id: "copy-exception",
        heading: "A copied winning design",
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
          "If the client does not pick a winner within {judging} days of the end, or does not approve or ask for a change within {response} days of receiving the final files, the contest ends with no result. The prize is shared equally among the designers who took part, the client receives no files and no copyright moves. The payment is not refunded. This does not apply when the client's money-back claim was approved: then the contest is cancelled and the designers get no share.",
        ],
      },
      {
        id: "pro",
        heading: "Designer Pro plan",
        blocks: [
          {
            list: [
              "Pro is paid one month at a time, with bKash or by card. It starts when the payment is confirmed.",
              "Pro does not renew by itself: we remind you before it ends.",
              "If you cancel, Pro stays on until the end of the month you paid for. Pro payments are not refunded.",
            ],
          },
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
              "The winner's prize reaches their wallet {holdDays} days after the client approves the files, with no copy claim open.",
              "Our designer fee is taken from the prize: {tiers}. The rate is fixed when the winner is picked.",
              "No-result shares reach the wallet right away, after the same fee.",
              "Designers can withdraw from {withdrawMin} to bKash or a bank account. Our team sends each withdrawal (bKash withdrawals can also be sent automatically when that is switched on). A rejected withdrawal goes back to the wallet.",
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
      "If you win, send the final files within {strikeHours} hours (or you are suspended for {suspendHours} hours), and never later than {upload} days (or your account is banned).",
      "A suspension lasts {suspendHours} hours and ends on its own. {ban} suspensions within {strikeDays} days mean a permanent ban.",
      "No nude or sexual designs: one means a permanent ban.",
      "Copying means a fine or a permanent ban, and logocontest.bd will take legal action.",
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
              "How many designs you can send to one contest: {designsRule}.",
              "Confirm your email before you send your first design.",
              "Send only your design and its mockups. A design with a picture that isn't a design (a screenshot, a random photo) may be held for a check by our team before it is shown.",
            ],
          },
        ],
      },
      {
        id: "agreement",
        heading: "The originality agreement",
        blocks: [
          "Before your first design you sign a one-time originality agreement with your full name, mobile number, address and an ID number (NID, passport or birth certificate). You promise that your designs are your own work and accept that if a copied design is found after you win, logocontest.bd will take legal action. See the Privacy Policy for how your ID number is protected.",
        ],
      },
      {
        id: "contact",
        heading: "No contact outside the site",
        blocks: [
          "Never share or ask for phone numbers, emails, social media, websites or other contact details, in designs, comments or files. Talk to clients only on the site: in the comments on your designs, in the files chat if you win, and in the client chat if you are a Pro designer. Our filter blocks messages with contact details.",
        ],
      },
      {
        id: "winning",
        heading: "If you win",
        blocks: [
          {
            list: [
              "Upload the final files the contest asks for (for a logo: AI, EPS, SVG, PDF, transparent PNG and JPG), the font names, and any extras the client asked for. Send them within {strikeHours} hours of winning, or you are suspended for {suspendHours} hours (you can still send the files). If you send nothing within {upload} days, the win is cancelled, you get no prize and your account is banned permanently.",
              "Accept the copyright transfer: once the client approves, the design belongs to the client.",
              "If the client asks for changes, answer in the messages on the files page and send the files again, as many times as needed, until the client approves.",
              "Your prize reaches your wallet {holdDays} days after the client approves the files, with no copy claim open. Then you can withdraw it to bKash or a bank account.",
            ],
          },
        ],
      },
      {
        id: "money-back",
        heading: "When the client gets their money back",
        blocks: [
          "Some contests have our money-back guarantee (the contest page says so). If such a contest ends with designs from fewer than {guaranteeDesigners} different designers, the client may claim their money back before picking a winner. If the claim is approved, the contest is cancelled and no prize or share is paid. Your designs stay yours, and the client may not use them.",
        ],
      },
      {
        id: "copies",
        heading: "Reports and copied designs",
        blocks: [
          "Clients and designers can report a design as copied, AI-made or breaking the rules. Admins check every report. A design proven to be copied is removed.",
          "If the winning design is proven to be copied, our admin talks with you and decides one of: a correction (you must send corrected files), a fine (taken from your wallet) or a permanent ban. In every case the win can be cancelled and the prize withheld, and logocontest.bd will take legal action.",
        ],
      },
      {
        id: "suspensions",
        heading: "Suspensions",
        blocks: [
          "You are suspended for {suspendHours} hours when you:",
          {
            list: [
              "do not send the first final files within {strikeHours} hours of winning;",
              "share or ask for a phone number, email, link, Facebook or other social media name in a comment, or deal with a client outside the site;",
              "write bad or abusive words in a comment (in English, Bangla or Banglish);",
              "send a fake NID, passport or birth certificate.",
            ],
          },
          "A comment with contact details or bad words is not posted, and you are suspended at once. You get a warning by notice and email, with the reason, and your profile shows the suspension.",
          "While you are suspended you can't send a new design, comment anywhere, or like or dislike designs. You can still log in, send the final files of a contest you won, use the files chat and withdraw your money. After {suspendHours} hours the suspension ends on its own.",
        ],
      },
      {
        id: "bans",
        heading: "Permanent ban",
        blocks: [
          "Your account is banned permanently, and you can no longer log in, when you:",
          {
            list: [
              "send no final files within {upload} days of winning (the win is cancelled and you get no prize);",
              "get {ban} suspensions within {strikeDays} days;",
              "send a nude, sexual or adult design. When you send a design you confirm it has no such content;",
              "send a copied design, when our admin decides on a ban (see above).",
            ],
          },
          "A ban is not lifted when time passes.",
        ],
      },
      {
        id: "conduct",
        heading: "Respect",
        blocks: [
          "Be polite in comments. No bad words and no abusive, hateful or sexual content: such a comment is not posted and you are suspended for {suspendHours} hours. Do not make fake accounts or rate or report others unfairly. Repeated false reports lead to warnings and a ban.",
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
    "If a copied design is found after I win, I understand that logocontest.bd will take legal action.",
    "The name, mobile number, address and ID number I have given are true and my own. logocontest.bd may use them to contact me and, if needed, when it takes legal action.",
  ],
  closing: "I sign this agreement by typing my full name below. The date, time and my IP address are recorded with my signature.",
};
