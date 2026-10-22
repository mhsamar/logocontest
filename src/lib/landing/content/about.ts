import type { LandingContent } from "../types";

/** About page (owner, 2026-10-21; SEO-PLAN.md B2): who we are, how it works and how it stays fair, for brand and "is logocontest.bd legit" searches. */
export const content: LandingContent = {
  slug: "about",
  updatedAt: "2026-10-21",
  en: {
    title: "About logocontest.bd – Who We Are",
    description: "logocontest.bd is a logo design contest site in Bangladesh. Set a prize and designers across Bangladesh can send ideas. Pay by bKash, get full copyright.",
    h1: "About logocontest.bd",
    answer: "logocontest.bd is a logo design contest platform in Bangladesh that connects business owners with Bangladeshi designers. You set a prize, designers across Bangladesh can send ideas, and you pick the one you like and get the final files with full copyright (you pay the prize upfront when you start, and payments are not refunded{?g: except under our {guaranteeDesigners}-designer money-back guarantee}).",
    breadcrumb: "About",
    sections: [
      {
        kind: "text",
        heading: "Why we built logocontest.bd",
        paragraphs: [
          "Many small businesses in Bangladesh need a good logo, but not every business can pay agency prices, and with a Facebook page seller it is hard to know what you will get before you pay. We also wanted designers here to have a clear, fair way to earn from their work.",
          "logocontest.bd tries to make this simpler for both sides. The client sets a fixed prize at the start, so designers know exactly what they can win, and for that one price the client can get ideas from different designers instead of just one or two.",
          "Clients pay in taka by bKash when they start a contest, and payments are final: {!g:there are no refunds}{?g:the only refund is our {guaranteeDesigners}-designer money-back guarantee} (see the Payment & Refund Policy). The site and its help work in Bangla as well as English.",
        ],
      },
      {
        kind: "steps",
        heading: "How it works for clients",
        steps: [
          { title: "Write your brief", body: "Tell designers your business name, what you do, colours you like and where the logo will be used. Optional add-ons at an extra price, such as a private or blind contest, an NDA or a highlighted listing, are there if you need them." },
          { title: "Choose the prize and pay", body: "Pick a package or set your own prize from {minPrize}. A {fee}% service fee is added ({largeFee}% for prizes above {largeFrom}), so the smallest total is {minTotal}. You pay by bKash when you start, and payments are not refunded{?g:, except under our {guaranteeDesigners}-designer money-back guarantee}." },
          { title: "See designs and give feedback", body: "A contest runs for {defaultDays} days by default (you can choose {minDays} to {maxDays}). Designers can send designs, and your stars and comments help them improve." },
          { title: "Pick the winner and get your files", body: "Choose your favourite within {judgingDays} days after the contest ends (you pay the prize upfront when you start). The winner hands over the final files (AI, EPS, SVG, PDF, PNG, JPG) and the full copyright through the site. If you do not pick a winner within {judgingDays} days, or do not respond to the final files in time, the contest ends with no result and the prize is shared equally among the designers who took part." },
        ],
      },
      {
        kind: "steps",
        heading: "How it works for designers",
        steps: [
          { title: "Join free", body: "Sign up with your mobile number and email, and read and accept the Designer Rules." },
          { title: "Pick a contest", body: "Browse open contests, read the brief and send your own original designs." },
          { title: "Improve with feedback", body: "Clients rate and comment on your designs, and you can answer with a new version." },
          { title: "Win and get paid", body: "If the client picks your design, you hand over the final files and copyright through the site. Once the client approves the files, you are paid from the prize." },
        ],
      },
      {
        kind: "list",
        heading: "How we keep it fair and safe",
        items: [
          "Rules for designers: every designer accepts the Designer Rules. Designs must be their own original work, and talk with clients stays on the site. Designers can flag a copied design with proof, our team checks every flag, and a proven copy can mean a fine or a permanent ban.",
          "AI Logo Checker: it checks designs for copies or close look-alikes of logos found online. It is free on every logo contest.",
          "Copyright transfer: the winner hands over the final files and the full copyright through the site, so the logo is yours to use.",
          "Prize paid after approval: we hold your payment, and the winner is paid from the prize only after you approve the final files.",
          "Payment by bKash: clients pay in taka by bKash when they start a contest. Visitors from abroad can pay by card in US dollars.",
          "{!g:No refunds: payments are final}{?g:Payments are final, except under our {guaranteeDesigners}-designer money-back guarantee} (see the Payment & Refund Policy). If the winning design is proven copied, you can pick another design. If you do not pick a winner within {judgingDays} days, or do not respond to the final files in time, the contest ends with no result and the prize is shared equally among the designers who took part.",
          "Support chat: ask your question in the chat on the Help page and reach our team when you need a person.",
        ],
      },
      {
        kind: "text",
        heading: "Designs from at least {guaranteeDesigners} different designers, or your money back",
        onlyWithGuarantee: true,
        paragraphs: [
          "If your contest ends with designs from fewer than {guaranteeDesigners} different designers, you can claim back 100% of what you paid for the contest: the prize, the service fee and any add-ons.",
          "Claim it on your contest page within {judgingDays} days of the end and before you pick a winner. Our team checks the contest and refunds you. Designs you rejected count too (see the Payment & Refund Policy).",
        ],
      },
      {
        kind: "faq",
        heading: "Questions people ask",
        items: [
          { q: "Is logocontest.bd legit?", a: "It is a real, working site, and it is new, so you won't find years of reviews yet. Here is how your money is handled: we hold your payment, and the winning designer is paid from the prize only after they hand over the final files and copyright and you approve them. You see the designs during the contest and choose the winner yourself (you pay the prize upfront when you start). Payments are not refunded{?g:, except under our {guaranteeDesigners}-designer money-back guarantee} (see the Payment & Refund Policy). If the winning design is proven copied, you can pick another design. If you do not pick a winner within {judgingDays} days, or do not respond to the final files in time, the contest ends with no result and the prize is shared equally among the designers who took part." },
          { q: "Do I pay before I see any designs?", a: "Yes. You pay the prize and the service fee by bKash when you start the contest, which shows designers the prize is real and worth their time. The smallest total is {minTotal}. The winner gets the prize only after you approve the final files. Payments are final and not refunded{!g:, including when you get fewer designs than you hoped}{?g:, except under our {guaranteeDesigners}-designer money-back guarantee} (see the Payment & Refund Policy). If the winning design is proven copied, you can pick another design." },
          { q: "Is it only for logos?", a: "Logos are the main focus, but you can also run contests for other designs, such as business cards." },
          { q: "Can designers from anywhere join?", a: "Yes. Most designers on logocontest.bd are in Bangladesh, but anyone can sign up free with a mobile number and email after accepting the Designer Rules. Clients from abroad can start a contest too and pay by card in US dollars." },
          { q: "How can I contact logocontest.bd?", a: "Open the Help page. It shows every way to reach our team, including the support chat." },
        ],
      },
    ],
    cta: {
      heading: "Start your logo contest",
      body: "Write a short brief and choose a prize, and designers across Bangladesh can send you ideas. Are you a designer? Join free and send designs to open contests.",
      button: "Start a contest",
    },
  },
  bn: {
    title: "logocontest.bd সম্পর্কে – আমরা কারা",
    description: "logocontest.bd বাংলাদেশের লোগো ডিজাইন কনটেস্ট সাইট। পুরস্কার ঠিক করুন, দেশের ডিজাইনাররা আইডিয়া পাঠাতে পারেন। বিকাশে টাকা দিন আর পুরো কপিরাইট পান।",
    h1: "logocontest.bd সম্পর্কে",
    answer: "logocontest.bd হলো বাংলাদেশের একটি লোগো ডিজাইন কনটেস্ট প্ল্যাটফর্ম, যেখানে ব্যবসার মালিকরা দেশের ডিজাইনারদের দিয়ে লোগো করিয়ে নিতে পারেন। আপনি পুরস্কার ঠিক করেন, ডিজাইনাররা আইডিয়া পাঠাতে পারেন, আর আপনি পছন্দের ডিজাইনটি বেছে নিয়ে ফাইনাল ফাইল ও পুরো কপিরাইট পান (পুরস্কার শুরুতেই দিতে হয়, আর পেমেন্ট ফেরত দেওয়া হয় না{?g:, তবে {guaranteeDesigners} জনের কম আলাদা ডিজাইনার অংশ নিলে মানি-ব্যাক গ্যারান্টি আছে})।",
    breadcrumb: "আমাদের সম্পর্কে",
    sections: [
      {
        kind: "text",
        heading: "কেন আমরা logocontest.bd বানিয়েছি",
        paragraphs: [
          "বাংলাদেশে অনেক ছোট ব্যবসার একটা ভালো লোগো দরকার, কিন্তু এজেন্সির খরচ সবার পক্ষে দেওয়া সম্ভব হয় না। আবার কোনো ফেসবুক পেজ থেকে লোগো করালে টাকা দেওয়ার আগে বোঝা কঠিন, আসলে কী পাবেন। আমরা এটাও চেয়েছি, দেশের ডিজাইনাররা যেন পরিষ্কার নিয়মে, ন্যায্যভাবে নিজের কাজ থেকে আয় করতে পারেন।",
          "logocontest.bd দুই পক্ষের জন্যই কাজটা সহজ করতে চায়। ক্লায়েন্ট শুরুতেই একটা নির্দিষ্ট পুরস্কার ঠিক করেন, তাই ডিজাইনাররা জানেন জিতলে কত পাবেন। আর এক দামেই শুধু এক-দুজনের নয়, বিভিন্ন ডিজাইনারের আইডিয়া পাওয়ার সুযোগ থাকে।",
          "ক্লায়েন্টরা কনটেস্ট শুরুর সময় বিকাশের মাধ্যমে টাকায় পেমেন্ট করেন। {!g:টাকা ফেরত নেই: পেমেন্ট চূড়ান্ত}{?g:{guaranteeDesigners} জনের কম আলাদা ডিজাইনার অংশ নিলে পুরো টাকা ফেরত; নইলে পেমেন্ট চূড়ান্ত} (পেমেন্ট ও রিফান্ড নীতি দেখুন)। সাইট ও সাহায্য দুটোই বাংলা ও ইংরেজিতে পাওয়া যায়।",
        ],
      },
      {
        kind: "steps",
        heading: "ক্লায়েন্টদের জন্য: কীভাবে কাজ করে",
        steps: [
          { title: "ব্রিফ লিখুন", body: "ডিজাইনারদের জানান আপনার ব্যবসার নাম, কী কাজ করেন, কোন রং পছন্দ আর লোগো কোথায় ব্যবহার হবে। দরকার হলে প্রাইভেট বা ব্লাইন্ড কনটেস্ট, NDA বা হাইলাইটের মতো আলাদা দামের অ্যাড-অনও নিতে পারেন।" },
          { title: "পুরস্কার ঠিক করে পেমেন্ট করুন", body: "একটা প্যাকেজ বেছে নিন, অথবা নিজের মতো পুরস্কার ঠিক করুন ({minPrize} থেকে শুরু)। এর সাথে {fee}% সার্ভিস ফি যোগ হয় ({largeFrom}-এর বেশি পুরস্কারে {largeFee}%), তাই সবচেয়ে কম মোট খরচ {minTotal}। কনটেস্ট শুরুর সময় বিকাশে পেমেন্ট করুন; এই পেমেন্ট ফেরত দেওয়া হয় না{?g:, তবে {guaranteeDesigners} জনের কম আলাদা ডিজাইনার অংশ নিলে মানি-ব্যাক গ্যারান্টি আছে}।" },
          { title: "ডিজাইন দেখুন, মতামত দিন", body: "সাধারণত কনটেস্ট চলে {defaultDays} দিন (চাইলে {minDays} থেকে {maxDays} দিন)। এই সময়ে ডিজাইনাররা ডিজাইন পাঠাতে পারেন, আর আপনার স্টার ও কমেন্ট দেখে তারা ডিজাইন আরও ভালো করেন।" },
          { title: "বিজয়ী বেছে নিন, ফাইল বুঝে নিন", body: "কনটেস্ট শেষ হওয়ার পর {judgingDays} দিনের মধ্যে পছন্দের ডিজাইনটি বেছে নিন (পুরস্কার শুরুতেই দিতে হয়)। বিজয়ী ডিজাইনার সাইটের মাধ্যমেই ফাইনাল ফাইল (AI, EPS, SVG, PDF, PNG, JPG) আর পুরো কপিরাইট আপনাকে দিয়ে দেন। {judgingDays} দিনের মধ্যে বিজয়ী না বাছলে, অথবা সময়মতো ফাইনাল ফাইলের জবাব না দিলে কনটেস্ট ফলাফল ছাড়া শেষ হয়, আর পুরস্কার অংশ নেওয়া ডিজাইনারদের মধ্যে সমান ভাগে ভাগ হয়।" },
        ],
      },
      {
        kind: "steps",
        heading: "ডিজাইনারদের জন্য: কীভাবে কাজ করে",
        steps: [
          { title: "ফ্রিতে যোগ দিন", body: "মোবাইল নম্বর আর ইমেইল দিয়ে অ্যাকাউন্ট খুলুন, তারপর ডিজাইনারদের নিয়ম পড়ে তাতে সম্মতি দিন।" },
          { title: "প্রতিযোগিতা বেছে নিন", body: "চলমান প্রতিযোগিতাগুলো দেখুন, ব্রিফ পড়ুন, তারপর নিজের করা মৌলিক ডিজাইন পাঠান।" },
          { title: "মতামত দেখে ডিজাইন আরও ভালো করুন", body: "ক্লায়েন্ট আপনার ডিজাইনে স্টার আর কমেন্ট দেন, আর আপনি চাইলে নতুন ভার্সন পাঠাতে পারেন।" },
          { title: "জিতুন, টাকা পান", body: "ক্লায়েন্ট আপনার ডিজাইন বেছে নিলে সাইটের মাধ্যমে ফাইনাল ফাইল আর কপিরাইট দিয়ে দিন। ক্লায়েন্ট ফাইল অনুমোদন করলে পুরস্কার থেকে আপনার টাকা পাবেন।" },
        ],
      },
      {
        kind: "list",
        heading: "কীভাবে আমরা সবকিছু ন্যায্য ও নিরাপদ রাখি",
        items: [
          "ডিজাইনারদের নিয়ম: প্রত্যেক ডিজাইনারকে নিয়ম মেনে যোগ দিতে হয়। ডিজাইন হতে হবে নিজের মৌলিক কাজ, আর ক্লায়েন্টের সাথে কথা হয় শুধু সাইটের ভেতরে। কপি করা ডিজাইন দেখলে ডিজাইনাররা প্রমাণসহ রিপোর্ট করতে পারেন, আমাদের টিম প্রতিটি রিপোর্ট যাচাই করে, আর কপি প্রমাণ হলে জরিমানা বা স্থায়ী ব্যান হতে পারে।",
          "AI লোগো চেকার: ডিজাইনটি অনলাইনে থাকা অন্য কোনো লোগোর কপি বা খুব কাছাকাছি কিনা, তা যাচাই করে। এটি প্রতিটি লোগো কনটেস্টে ফ্রি।",
          "কপিরাইট হস্তান্তর: বিজয়ী সাইটের মাধ্যমে ফাইনাল ফাইল আর পুরো কপিরাইট আপনাকে দিয়ে দেন, তাই লোগোটি আপনি নিজের মতো ব্যবহার করতে পারেন।",
          "অনুমোদনের পরে পুরস্কার: আপনার পেমেন্ট আমাদের কাছে জমা থাকে, আর আপনি ফাইনাল ফাইল অনুমোদন করার পরেই বিজয়ী পুরস্কারের টাকা পান।",
          "বিকাশে পেমেন্ট: ক্লায়েন্টরা কনটেস্ট শুরুর সময় বিকাশের মাধ্যমে টাকায় পেমেন্ট করেন। বিদেশ থেকে কার্ডে ইউএস ডলারেও পেমেন্ট করা যায়।",
          "{!g:টাকা ফেরত নেই: পেমেন্ট চূড়ান্ত}{?g:{guaranteeDesigners} জনের কম আলাদা ডিজাইনার অংশ নিলে পুরো টাকা ফেরত; নইলে পেমেন্ট চূড়ান্ত} (পেমেন্ট ও রিফান্ড নীতি দেখুন)। বিজয়ী ডিজাইন কপি প্রমাণ হলে অন্য ডিজাইন বাছতে পারবেন। {judgingDays} দিনের মধ্যে বিজয়ী না বাছলে, অথবা সময়মতো ফাইনাল ফাইলের জবাব না দিলে কনটেস্ট ফলাফল ছাড়া শেষ হয়, আর পুরস্কার অংশ নেওয়া ডিজাইনারদের মধ্যে সমান ভাগে ভাগ হয়।",
          "সাপোর্ট চ্যাট: হেল্প পেজের চ্যাটে প্রশ্ন করুন, দরকার হলে সরাসরি আমাদের টিমের সাথে কথা বলুন।",
        ],
      },
      {
        kind: "text",
        heading: "অন্তত {guaranteeDesigners} জন আলাদা ডিজাইনারের ডিজাইন, নইলে পুরো টাকা ফেরত",
        onlyWithGuarantee: true,
        paragraphs: [
          "কনটেস্ট শেষে যদি দেখা যায় {guaranteeDesigners} জনের কম আলাদা ডিজাইনার ডিজাইন পাঠিয়েছেন, তাহলে কনটেস্টের জন্য আপনার দেওয়া টাকার ১০০%, মানে পুরস্কার, সার্ভিস ফি আর অ্যাড-অন, ফেরত চাইতে পারবেন।",
          "কনটেস্ট শেষের {judgingDays} দিনের মধ্যে এবং বিজয়ী বাছার আগে আপনার কনটেস্ট পেজ থেকে আবেদন করুন। আমাদের টিম যাচাই করে টাকা ফেরত দেবে। আপনি বাতিল করেছেন এমন ডিজাইনও গণ্য হয় (পেমেন্ট ও রিফান্ড নীতি দেখুন)।",
        ],
      },
      {
        kind: "faq",
        heading: "সাধারণ প্রশ্ন",
        items: [
          { q: "logocontest.bd কি আসল? ভরসা করা যায়?", a: "এটি একটি আসল, চালু সাইট, তবে নতুন, তাই এখনই অনেক বছরের রিভিউ পাবেন না। আপনার টাকার ব্যাপারটা এমন: আপনার পেমেন্ট আমাদের কাছে জমা থাকে, আর বিজয়ী ডিজাইনার ফাইনাল ফাইল ও কপিরাইট দেওয়ার পর আপনি সেগুলো অনুমোদন করলেই তিনি পুরস্কারের টাকা পান। কনটেস্ট চলার সময় ডিজাইনগুলো আপনি নিজেই দেখেন, আর বিজয়ীও আপনিই বেছে নেন (পুরস্কার শুরুতেই দিতে হয়)। {!g:টাকা ফেরত নেই: পেমেন্ট চূড়ান্ত}{?g:{guaranteeDesigners} জনের কম আলাদা ডিজাইনার অংশ নিলে পুরো টাকা ফেরত; নইলে পেমেন্ট চূড়ান্ত} (পেমেন্ট ও রিফান্ড নীতি দেখুন)। বিজয়ী ডিজাইন কপি প্রমাণ হলে অন্য ডিজাইন বাছতে পারবেন। {judgingDays} দিনের মধ্যে বিজয়ী না বাছলে, অথবা সময়মতো ফাইনাল ফাইলের জবাব না দিলে কনটেস্ট ফলাফল ছাড়া শেষ হয়, আর পুরস্কার অংশ নেওয়া ডিজাইনারদের মধ্যে সমান ভাগে ভাগ হয়।" },
          { q: "ডিজাইন দেখার আগেই কি টাকা দিতে হয়?", a: "হ্যাঁ। কনটেস্ট শুরু করার সময় বিকাশে পুরস্কার আর সার্ভিস ফি দিতে হয়। এতে ডিজাইনাররা বোঝেন পুরস্কারটা সত্যিই আছে, তাই সময় দেওয়ার মতো। সবচেয়ে কম মোট খরচ {minTotal}। আপনি ফাইনাল ফাইল অনুমোদন করার পরেই বিজয়ী পুরস্কার পান। {!g:টাকা ফেরত নেই: পেমেন্ট চূড়ান্ত, আশার চেয়ে কম ডিজাইন এলেও}{?g:পেমেন্ট চূড়ান্ত, তবে {guaranteeDesigners} জনের কম আলাদা ডিজাইনার অংশ নিলে মানি-ব্যাক গ্যারান্টি আছে} (পেমেন্ট ও রিফান্ড নীতি দেখুন)। বিজয়ী ডিজাইন কপি প্রমাণ হলে অন্য ডিজাইন বাছতে পারবেন।" },
          { q: "এটা কি শুধু লোগোর জন্য?", a: "মূলত লোগোর জন্য, তবে বিজনেস কার্ডের মতো অন্য ডিজাইনের জন্যও কনটেস্ট করতে পারেন।" },
          { q: "যেকোনো দেশের ডিজাইনার কি যোগ দিতে পারেন?", a: "হ্যাঁ। বেশিরভাগ ডিজাইনার বাংলাদেশের, তবে ডিজাইনারদের নিয়মে সম্মতি দিয়ে মোবাইল নম্বর ও ইমেইল দিয়ে যে কেউ ফ্রিতে সাইন আপ করতে পারেন। বিদেশের ক্লায়েন্টরাও কনটেস্ট শুরু করতে পারেন, তারা কার্ডে ইউএস ডলারে পেমেন্ট করেন।" },
          { q: "logocontest.bd-এর সাথে কীভাবে যোগাযোগ করব?", a: "হেল্প পেজে যান। সেখানে সাপোর্ট চ্যাটসহ আমাদের টিমের সাথে যোগাযোগের সব উপায় দেওয়া আছে।" },
        ],
      },
    ],
    cta: {
      heading: "আপনার লোগো কনটেস্ট শুরু করুন",
      body: "ছোট একটা ব্রিফ লিখুন, পুরস্কার ঠিক করুন, আর দেশের ডিজাইনাররা আইডিয়া পাঠাতে পারেন। আপনি ডিজাইনার? ফ্রিতে যোগ দিন আর চলমান প্রতিযোগিতায় ডিজাইন পাঠান।",
      button: "কনটেস্ট শুরু করুন",
    },
  },
};
