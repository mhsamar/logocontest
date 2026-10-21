import type { LandingContent } from "../types";

/** Owner 2026-10-21 (SEO-PLAN.md §2.5, §2.8, B3): the /logo-design service page for "logo design service in Bangladesh" searches, with the contest vs freelancer vs agency vs Facebook seller table. */
export const content: LandingContent = {
  slug: "logo-design",
  updatedAt: "2026-10-21",
  en: {
    title: "Logo Design Service in Bangladesh – Many Designers",
    description: "Run a logo contest: designers in Bangladesh send ideas and you pick your favourite. From {minTotal} in total, pay by bKash, get all files and copyright.",
    h1: "Logo design service in Bangladesh",
    answer: "In a logo contest, designers across Bangladesh send logo ideas for your brief, and the price is fixed before you start, from {minTotal} in total. You see the designs first, then choose the one you like.",
    breadcrumb: "Logo design service",
    sections: [
      {
        kind: "steps",
        heading: "How it works",
        steps: [
          { title: "Write your brief", body: "Tell designers your business name, what you do and the look you like. Simple Bangla or English is fine." },
          { title: "Choose the prize and pay", body: "Pick a package, or set your own prize from {minPrize}. You pay the prize plus a {fee}% service fee ({largeFee}% for prizes above {largeFrom}) in taka by bKash. Visitors from abroad can pay by card in US dollars. Add-ons such as private, blind, NDA, highlight or urgent are optional." },
          { title: "See designs and give feedback", body: "Designers send their ideas while the contest runs, {defaultDays} days by default ({minDays} to {maxDays} days possible). Rate the designs with stars and comment, and designers can send improved versions while the contest is open." },
          { title: "Pick the winner and get the files", body: "Choose the winner within {judgingDays} days after the contest ends. The winner hands over the final files and the full copyright through the site, and is paid from the prize." },
        ],
      },
      {
        kind: "compare",
        heading: "Logo contest vs freelancer vs agency vs Facebook seller",
        columns: ["What to check", "Logo contest", "Freelancer marketplace", "Agency", "Facebook page seller"],
        rows: [
          { label: "Price", cells: ["From {minTotal} in total; you set the prize", "Typically ৳1,500–12,000 with a designer in Bangladesh, more from abroad; often in US dollars", "Typically ৳15,000–100,000 or more; priced per project", "Typically ৳500–3,000; quality varies a lot"] },
          { label: "Number of ideas", cells: ["Ideas from different designers to compare", "Typically a few concepts from one designer", "Typically a few concepts from one team", "Often one or a few options"] },
          { label: "Choose after seeing designs", cells: ["Yes, you pick the winner after seeing the designs", "No, you choose the designer first", "No, you agree the project first", "Rarely; you usually pay in full or an advance first"] },
          { label: "Pay in taka by bKash", cells: ["Yes (card in US dollars from abroad)", "Usually not; mostly card or dollar payment", "Depends on the agency", "Usually yes"] },
          { label: "Bangla support", cells: ["Yes, the whole site works in Bangla and English", "Mostly English", "Usually yes for local agencies", "Yes, in chat"] },
          { label: "Money back", cells: ["Written rules on our payment policy page; read them before you pay", "Depends on the platform's rules", "Depends on the contract", "Often nothing in writing"] },
        ],
        note: "A general picture to help you choose; the prices are typical ranges, not quotes. Prices and rules differ from seller to seller, so always check before you pay.",
      },
      {
        kind: "text",
        heading: "Money back if fewer than {guaranteeDesigners} designers take part",
        paragraphs: [
          "If your contest ends with designs from fewer than {guaranteeDesigners} different designers, you can claim back everything you paid: the prize and the service fee.",
          "To claim it, open your contest page after the contest ends and send the request. Our team checks it and refunds you.",
        ],
        onlyWithGuarantee: true,
      },
      {
        kind: "list",
        heading: "Who it is for",
        items: [
          "New shops and small businesses that need their first logo",
          "Facebook pages and online shops",
          "Restaurants, cafés, bakeries and food brands",
          "Startups, apps and tech projects",
          "NGOs, schools, clubs and community groups",
          "Events, campaigns and festivals",
          "Older businesses that want a fresh look",
          "Businesses in Dhaka, Chattogram, Sylhet or anywhere else in Bangladesh, since everything happens online",
        ],
      },
      {
        kind: "list",
        heading: "What you get",
        items: [
          "The final logo files in AI, EPS, SVG, PDF, PNG and JPG, ready for print, signboards, social media and your website.",
          "The full copyright, handed over to you through the site.",
          "Changes before you approve: you can ask the winner to adjust the final files before you accept them.",
          "No separate designer bill: the winner is paid from the prize after you approve the files.",
        ],
      },
      {
        kind: "text",
        heading: "Check that your logo is original",
        paragraphs: [
          "Before you pick a winner, the AI Logo Checker can search online for logos that are copies of, or very similar to, the designs in your contest.",
          "It is free with contests from a prize of {checkerFreeFrom}. For smaller prizes you can add it for a small fee. The result is an AI research report, not a legal guarantee.",
        ],
      },
      {
        kind: "faq",
        heading: "Questions people ask",
        items: [
          { q: "How long does a logo contest take?", a: "A contest runs {defaultDays} days by default, and you can set anything from {minDays} to {maxDays} days. After it ends you have up to {judgingDays} days to pick the winner, who then sends the final files through the site. If you need more time, you can extend the contest with an add-on." },
          { q: "How many designs will I get?", a: "We can't promise a number. It depends on the prize, how clear your brief is and how long the contest runs. A bigger prize, a clear brief and quick feedback give designers more reason to take part." },
          { q: "What if I don't like any of the designs?", a: "You don't have to pick a winner. But if you don't pick one within {judgingDays} days after the contest ends, the prize is shared equally among the designers who took part, and you receive no files or copyright. So give stars and comments while the contest runs to tell designers what you want, and read the payment policy before you pay." },
          { q: "Can I ask for changes?", a: "Yes. While the contest runs, rate designs with stars and leave comments, and designers can send improved versions. After you pick the winner, you can ask the winner for changes to the final files before you approve them." },
          { q: "Who owns the copyright of the logo?", a: "You do. The winner hands over the full copyright together with the final files (AI, EPS, SVG, PDF, PNG and JPG) through the site, and is paid from the prize after you approve the files." },
          { q: "Is logocontest.bd a logo design company?", a: "Not in the usual sense. Instead of one in-house designer, logocontest.bd is a contest marketplace: designers across Bangladesh can work on your brief, and you choose the design you like. The payment, the file handover and the copyright transfer all happen through the site." },
          { q: "Can I get a business card or other design too?", a: "Yes. Besides logos, the site can run contests for other designs, such as business cards. The steps are the same: write a brief, set a prize and pick the design you like." },
        ],
      },
    ],
    cta: { heading: "Start your logo contest", body: "Write your brief, choose the prize and see what designers send. Contests start from {minTotal} in total.", button: "Start a contest" },
  },
  bn: {
    title: "বাংলাদেশে লোগো ডিজাইন সার্ভিস – অনেক ডিজাইনারের আইডিয়া",
    description: "লোগো কনটেস্ট চালান: বাংলাদেশের ডিজাইনাররা আইডিয়া পাঠান, আপনি পছন্দেরটি বাছেন। মোট {minTotal} থেকে, বিকাশে পেমেন্ট, সব ফাইল আর কপিরাইট আপনার।",
    h1: "বাংলাদেশে লোগো ডিজাইন সার্ভিস",
    answer: "লোগো কনটেস্টে সারা বাংলাদেশের ডিজাইনাররা আপনার ব্রিফ অনুযায়ী লোগো আইডিয়া পাঠান, আর দাম শুরুতেই ঠিক করা থাকে, মোট {minTotal} থেকে। আগে ডিজাইনগুলো দেখুন, তারপর পছন্দেরটি বেছে নিন।",
    breadcrumb: "লোগো ডিজাইন সার্ভিস",
    sections: [
      {
        kind: "steps",
        heading: "কীভাবে কাজ করে",
        steps: [
          { title: "ব্রিফ লিখুন", body: "আপনার ব্যবসার নাম, কী করেন আর কেমন লোগো চান, তা ডিজাইনারদের জানিয়ে দিন। সহজ বাংলা বা ইংরেজি, যেকোনোটায় লিখলেই চলবে।" },
          { title: "পুরস্কার ঠিক করে পেমেন্ট করুন", body: "একটি প্যাকেজ বাছুন, অথবা {minPrize} থেকে নিজের মতো পুরস্কার ঠিক করুন। পুরস্কারের সাথে {fee}% সার্ভিস ফি ({largeFrom}-এর বেশি পুরস্কারে {largeFee}%) যোগ করে মোট টাকা বিকাশে দিন। বিদেশ থেকে কার্ডে ডলারে পেমেন্ট করা যায়। প্রাইভেট, ব্লাইন্ড, NDA, হাইলাইট বা আর্জেন্টের মতো বাড়তি সুবিধা চাইলে নিতে পারেন।" },
          { title: "ডিজাইন দেখুন, মতামত দিন", body: "কনটেস্ট চলার সময় ডিজাইনাররা তাদের আইডিয়া পাঠান। কনটেস্ট সাধারণত {defaultDays} দিন চলে, তবে {minDays} থেকে {maxDays} দিনের মধ্যে যেকোনো মেয়াদ বেছে নেওয়া যায়। ডিজাইনে স্টার আর মন্তব্য দিন, কনটেস্ট চলাকালীন ডিজাইনাররা উন্নত ভার্সন পাঠাতে পারেন।" },
          { title: "বিজয়ী বেছে নিন, ফাইল বুঝে নিন", body: "কনটেস্ট শেষ হওয়ার {judgingDays} দিনের মধ্যে বিজয়ী বেছে নিন। বিজয়ী সাইটের মাধ্যমেই চূড়ান্ত ফাইল আর পূর্ণ কপিরাইট আপনাকে বুঝিয়ে দেন, আর পুরস্কারের টাকা পান।" },
        ],
      },
      {
        kind: "compare",
        heading: "লোগো কনটেস্ট বনাম ফ্রিল্যান্সার, এজেন্সি ও ফেসবুক পেজের বিক্রেতা",
        columns: ["যা দেখবেন", "লোগো কনটেস্ট", "ফ্রিল্যান্সার মার্কেটপ্লেস", "এজেন্সি", "ফেসবুক পেজের বিক্রেতা"],
        rows: [
          { label: "দাম", cells: ["মোট {minTotal} থেকে; পুরস্কার আপনি ঠিক করেন", "সাধারণত দেশি ডিজাইনারের কাছে ৳১,৫০০–১২,০০০, বিদেশি হলে আরও বেশি; প্রায়ই ডলারে", "সাধারণত ৳১৫,০০০–১,০০,০০০ বা তার বেশি; প্রজেক্ট দেখে দাম", "সাধারণত ৳৫০০–৩,০০০; মান একেক জনের একেক রকম"] },
          { label: "কতগুলো আইডিয়া", cells: ["আলাদা আলাদা ডিজাইনারের আইডিয়া, তুলনা করে দেখার সুযোগ", "সাধারণত একজন ডিজাইনারের অল্প কয়েকটি", "সাধারণত একটি টিমের অল্প কয়েকটি", "প্রায়ই একটি বা অল্প কয়েকটি"] },
          { label: "ডিজাইন দেখে বাছাই", cells: ["হ্যাঁ, ডিজাইন দেখার পর বিজয়ী বাছেন", "না, আগে ডিজাইনার বাছতে হয়", "না, আগে প্রজেক্ট ঠিক করতে হয়", "খুব কম; সাধারণত আগে পুরো টাকা বা অ্যাডভান্স দিতে হয়"] },
          { label: "বিকাশে টাকায় পেমেন্ট", cells: ["হ্যাঁ (বিদেশ থেকে কার্ডে ডলারে)", "সাধারণত না; বেশিরভাগ কার্ডে বা ডলারে", "এজেন্সি অনুযায়ী আলাদা", "সাধারণত হ্যাঁ"] },
          { label: "বাংলায় সাহায্য", cells: ["হ্যাঁ, পুরো সাইট বাংলা ও ইংরেজিতে", "বেশিরভাগ ইংরেজিতে", "দেশি এজেন্সিতে সাধারণত হ্যাঁ", "হ্যাঁ, চ্যাটে"] },
          { label: "টাকা ফেরত", cells: ["পেমেন্ট পলিসি পেজে লেখা নিয়ম আছে; পেমেন্টের আগে পড়ে নিন", "প্ল্যাটফর্মের নিয়ম অনুযায়ী", "চুক্তি অনুযায়ী", "প্রায়ই লিখিত কিছু থাকে না"] },
        ],
        note: "বেছে নিতে সুবিধার জন্য এটি একটি সাধারণ ধারণা; দামগুলো সাধারণ হিসাব, কোটেশন নয়। দাম আর নিয়ম বিক্রেতা ভেদে আলাদা, তাই টাকা দেওয়ার আগে সবসময় যাচাই করে নিন।",
      },
      {
        kind: "text",
        heading: "{guaranteeDesigners} জনের কম ডিজাইনার অংশ নিলে পুরো টাকা ফেরত",
        paragraphs: [
          "কনটেস্ট শেষে যদি দেখা যায় {guaranteeDesigners} জনের কম ডিজাইনার ডিজাইন পাঠিয়েছেন, তাহলে আপনি যা দিয়েছেন তার পুরোটাই, মানে পুরস্কার আর সার্ভিস ফি, ফেরত চাইতে পারবেন।",
          "ফেরত চাইতে কনটেস্ট শেষ হওয়ার পর আপনার কনটেস্ট পেজ থেকে আবেদন করুন। আমাদের টিম যাচাই করে টাকা ফেরত দেবে।",
        ],
        onlyWithGuarantee: true,
      },
      {
        kind: "list",
        heading: "লোগো কনটেস্ট কাদের জন্য",
        items: [
          "নতুন দোকান আর ছোট ব্যবসা, যাদের প্রথম লোগো দরকার",
          "ফেসবুক পেজ আর অনলাইন শপ",
          "রেস্টুরেন্ট, ক্যাফে, বেকারি আর খাবারের ব্র্যান্ড",
          "স্টার্টআপ, অ্যাপ আর টেক প্রজেক্ট",
          "এনজিও, স্কুল, ক্লাব আর সামাজিক সংগঠন",
          "ইভেন্ট, ক্যাম্পেইন আর উৎসব",
          "পুরোনো ব্যবসা, যারা লোগোটা নতুন করে সাজাতে চায়",
          "ঢাকা, চট্টগ্রাম, সিলেট বা দেশের যেকোনো জায়গার ব্যবসা, কারণ সব কাজ অনলাইনে হয়",
        ],
      },
      {
        kind: "list",
        heading: "আপনি যা পাবেন",
        items: [
          "চূড়ান্ত লোগো ফাইল (AI, EPS, SVG, PDF, PNG আর JPG), প্রিন্ট, সাইনবোর্ড, সোশ্যাল মিডিয়া আর ওয়েবসাইটে ব্যবহারের জন্য তৈরি।",
          "লোগোর পূর্ণ কপিরাইট, সাইটের মাধ্যমেই আপনাকে হস্তান্তর করা হয়।",
          "অনুমোদনের আগে পরিবর্তন: চূড়ান্ত ফাইল গ্রহণ করার আগে বিজয়ীকে কিছু বদলাতে বলতে পারেন।",
          "ডিজাইনারকে আলাদা বিল দিতে হয় না: আপনি ফাইল অনুমোদন করলে বিজয়ী পুরস্কার থেকেই টাকা পান।",
        ],
      },
      {
        kind: "text",
        heading: "লোগোটি নকল কি না যাচাই করুন",
        paragraphs: [
          "বিজয়ী বাছার আগে AI লোগো চেকার অনলাইনে খুঁজে দেখতে পারে, আপনার কনটেস্টের কোনো ডিজাইন অন্য কোনো লোগোর কপি বা খুব কাছাকাছি কি না।",
          "{checkerFreeFrom} বা তার বেশি পুরস্কারের কনটেস্টে এটি ফ্রি। এর চেয়ে কম পুরস্কারে অল্প খরচে এটি যোগ করে নিতে পারেন। ফলাফল হিসেবে পাবেন AI-এর তৈরি একটি রিসার্চ রিপোর্ট; এটি আইনি নিশ্চয়তা নয়।",
        ],
      },
      {
        kind: "faq",
        heading: "সাধারণ প্রশ্ন",
        items: [
          { q: "লোগো কনটেস্টে কত দিন লাগে?", a: "সাধারণত একটি কনটেস্ট {defaultDays} দিন চলে, তবে {minDays} থেকে {maxDays} দিনের মধ্যে যেকোনো মেয়াদ বেছে নিতে পারেন। শেষ হওয়ার পর বিজয়ী বাছতে {judgingDays} দিন পর্যন্ত সময় পাবেন, তারপর বিজয়ী সাইটের মাধ্যমে চূড়ান্ত ফাইল পাঠান। আরও সময় দরকার হলে বাড়তি সুবিধা হিসেবে কনটেস্টের মেয়াদ বাড়িয়ে নিতে পারেন।" },
          { q: "কতগুলো ডিজাইন পাব?", a: "কতগুলো ডিজাইন আসবে, তার নির্দিষ্ট সংখ্যা আমরা বলে দিতে পারি না। এটা নির্ভর করে পুরস্কার কত, ব্রিফ কতটা পরিষ্কার আর কনটেস্ট কত দিন চলে তার ওপর। পুরস্কার বড় হলে, ব্রিফ পরিষ্কার হলে আর আপনি দ্রুত মতামত দিলে ডিজাইনাররা অংশ নিতে বেশি আগ্রহী হন।" },
          { q: "কোনো ডিজাইন পছন্দ না হলে কী হবে?", a: "বিজয়ী বাছতে আপনি বাধ্য নন। তবে কনটেস্ট শেষ হওয়ার {judgingDays} দিনের মধ্যে বিজয়ী না বাছলে পুরস্কারের টাকা অংশ নেওয়া ডিজাইনারদের মধ্যে সমান ভাগ হয়ে যায়, আর আপনি কোনো ফাইল বা কপিরাইট পান না। তাই কনটেস্ট চলার সময়ই স্টার আর মন্তব্য দিয়ে ডিজাইনারদের জানান আপনি কী চান, আর পেমেন্টের আগে পেমেন্ট পলিসি পড়ে নিন।" },
          { q: "ডিজাইনে পরিবর্তন চাইতে পারব?", a: "হ্যাঁ। কনটেস্ট চলার সময় ডিজাইনে স্টার আর মন্তব্য দিন, ডিজাইনাররা উন্নত ভার্সন পাঠাতে পারেন। বিজয়ী বাছার পর চূড়ান্ত ফাইল অনুমোদনের আগে বিজয়ীকে পরিবর্তন করতে বলতে পারেন।" },
          { q: "লোগোর কপিরাইট কার?", a: "আপনার। বিজয়ী সাইটের মাধ্যমে চূড়ান্ত ফাইলের (AI, EPS, SVG, PDF, PNG ও JPG) সাথে পূর্ণ কপিরাইট আপনাকে হস্তান্তর করেন, আর আপনি ফাইল অনুমোদন করলে বিজয়ী পুরস্কারের টাকা পান।" },
          { q: "logocontest.bd কি একটি লোগো ডিজাইন কোম্পানি?", a: "ঠিক প্রচলিত অর্থে নয়। নিজস্ব একজন ডিজাইনারের বদলে logocontest.bd একটি কনটেস্ট মার্কেটপ্লেস: সারা বাংলাদেশের ডিজাইনাররা আপনার ব্রিফ নিয়ে কাজ করতে পারেন, আর আপনি পছন্দের ডিজাইনটি বেছে নেন। পেমেন্ট, ফাইল হস্তান্তর আর কপিরাইট বুঝিয়ে দেওয়া, সবই হয় সাইটের মাধ্যমে।" },
          { q: "লোগো ছাড়া ভিজিটিং কার্ড বা অন্য ডিজাইনও করানো যায়?", a: "হ্যাঁ। লোগোর পাশাপাশি ভিজিটিং কার্ডসহ অন্য ডিজাইনের জন্যও কনটেস্ট চালানো যায়। ধাপ একই: ব্রিফ লিখুন, পুরস্কার ঠিক করুন, আর পছন্দের ডিজাইন বেছে নিন।" },
        ],
      },
    ],
    cta: { heading: "আপনার লোগো কনটেস্ট শুরু করুন", body: "ব্রিফ লিখুন, পুরস্কার ঠিক করুন, আর দেখুন ডিজাইনাররা কী পাঠান। কনটেস্টের মোট খরচ শুরু {minTotal} থেকে।", button: "কনটেস্ট শুরু করুন" },
  },
};
