import type { LandingContent } from "../types";

/** Owner 2026-10-21: /logo-design-price answers "how much does a logo cost in Bangladesh" with live contest totals and typical market ranges. */
export const content: LandingContent = {
  slug: "logo-design-price",
  updatedAt: "2026-10-21",
  en: {
    title: "Logo Design Price in Bangladesh ({year}): Typical Costs",
    description: "Logo design price in Bangladesh ({year}): typical costs, and logocontest.bd contests from {minTotal} in total: ideas from different designers, full copyright.",
    h1: "Logo design price in Bangladesh ({year})",
    answer: "In {year}, a logo in Bangladesh typically costs from about ৳500 with a Facebook page seller to ৳100,000 or more at a design agency. On logocontest.bd, a contest starts at {minTotal} in total, fee included: designers across Bangladesh can send ideas, and you choose the one you like (you pay the prize upfront when you start).",
    breadcrumb: "Logo design price",
    sections: [
      {
        kind: "prices",
        heading: "Contest prices on logocontest.bd, fee included",
        columns: { package: "Package", prize: "Prize", fee: "Service fee", total: "You pay" },
        note: "Want a different amount? Set your own prize from {minPrize}. Every total includes the {fee}% service fee ({largeFee}% for prizes above {largeFrom}). Add-ons are optional and cost extra{?a:, except that every add-on is free with a prize of {addonsFreeFrom} or more (extra days are still paid)}. You pay when you start the contest, and payments are not refunded.",
      },
      {
        kind: "text",
        heading: "What decides the price",
        paragraphs: [
          "Most of a logo's price comes down to who designs it and what is included: one designer or several, how many ideas and changes you get, and whether you receive the source files and the copyright.",
          "In a contest, you set the prize yourself. Designers see it before they start, so a bigger prize can draw more designers and more careful work. The winner is paid from the prize, and the service fee is added on top.",
          "Watch for costs that come later. Some sellers charge extra for vector files, the copyright or more changes. On logocontest.bd, the totals in the table already include the fee, and add-ons at an extra price are added only if you choose them.",
          "You also choose the timing: a contest runs {defaultDays} days by default, or anything from {minDays} to {maxDays} days. The same kind of contest works for other designs too, such as business cards.",
        ],
      },
      {
        kind: "compare",
        ours: "row",
        heading: "Typical logo prices in Bangladesh, compared",
        columns: ["Option", "Typical price", "Designs you choose from", "Good to know"],
        rows: [
          {
            label: "Logo contest on logocontest.bd",
            cells: ["From {minTotal} in total", "Ideas from different designers (you pay the prize upfront when you start)", "The total includes the fee and payments are final (no refunds); the winner hands over the full copyright and AI, EPS, SVG, PDF, PNG and JPG files"],
          },
          {
            label: "Facebook page seller",
            cells: ["৳500–3,000", "Usually a few samples from one designer", "Ask about the source files (AI or SVG) and the copyright before you pay"],
          },
          {
            label: "Freelance marketplace, designer in Bangladesh",
            cells: ["৳1,500–12,000", "One designer; the number of ideas depends on the package", "Check how many changes and which files are included"],
          },
          {
            label: "Freelance marketplace, designer abroad",
            cells: ["৳6,000–60,000", "One designer; the number of ideas depends on the package", "Usually priced and paid in US dollars"],
          },
          {
            label: "Design agency in Bangladesh",
            cells: ["৳15,000–100,000+", "A few ideas from a team", "Often sold as a package with a brand guide or other branding work"],
          },
        ],
        note: "Typical ranges in {year}, not quotes. Real prices vary a lot with the designer and with what is included.",
      },
      {
        kind: "list",
        heading: "What you get for the price",
        items: [
          "Ideas from different designers: designers across Bangladesh can send logo designs, so you can compare options instead of one person's ideas and choose the one you like (you pay the prize upfront when you start).",
          "Stars and comments to tell the designers what you like while the contest runs.",
          "{judgingDays} days after the contest ends to pick your winner. If you don't pick one in time, the contest ends with no result and the prize is shared equally among the designers who took part; it is not refunded.",
          "The final files from the winner: AI, EPS, SVG, PDF, PNG and JPG.",
          "The full copyright, handed over to you through the site.",
          "No separate designer bill: the winner is paid from the prize.",
          "The AI Logo Checker, which looks online for copies of your designs and very similar logos: free on every logo contest.",
        ],
      },
      {
        kind: "text",
        heading: "Money back if fewer than {guaranteeDesigners} designers take part",
        paragraphs: [
          "If your contest ends with designs from fewer than {guaranteeDesigners} different designers, you can claim back everything you paid: the prize and the service fee.",
          "Claim it from your contest page after the contest ends. Our team checks the contest and refunds you.",
        ],
        onlyWithGuarantee: true,
      },
      {
        kind: "faq",
        heading: "Questions about logo prices",
        items: [
          {
            q: "Logo design koto taka? (How much does a logo cost?)",
            a: "It depends on who makes it: typically from about ৳500 with a Facebook page seller to ৳100,000 or more at an agency. On logocontest.bd, a logo contest starts at {minTotal} in total, prize and service fee included. You can pick a package prize or set your own from {minPrize}.",
          },
          {
            q: "How much is the service fee?",
            a: "{fee}% of the prize, or {largeFee}% when the prize is above {largeFrom}. It is added to the prize and shown before you pay, so without add-ons the total in the table is what you pay.",
          },
          {
            q: "Can I choose my own prize amount?",
            a: "Yes. Instead of a package, you can set your own prize from {minPrize}. The service fee is added the same way.",
          },
          {
            q: "Are there any extra costs?",
            a: "Only if you choose them. Optional add-ons at an extra price, such as a private or blind contest, an NDA, a highlighted or urgent listing, or more days for a running contest, are added only if you pick them.{?a: With a prize of {addonsFreeFrom} or more, every add-on is free; only extra days are still paid.} The AI Logo Checker is free on every logo contest.",
          },
          {
            q: "Can I pay by bKash?",
            a: "Yes. You pay in taka by bKash when you start your contest. If you are abroad, you can pay by card in US dollars. Payments are not refunded (see the Payment & No-Refund Policy). The one exception is not a money refund: if the winning design is proven to be copied, you can pick another design. If you don't pick a winner within {judgingDays} days, or don't respond to the final files in time, the contest ends with no result and the prize is shared equally among the designers who took part.",
          },
          {
            q: "How long does a contest take?",
            a: "{defaultDays} days by default; you can choose anything from {minDays} to {maxDays} days. After it ends, you have {judgingDays} days to pick your winner.",
          },
        ],
      },
      {
        kind: "faq",
        heading: "About the money-back guarantee",
        items: [
          {
            q: "What if fewer than {guaranteeDesigners} designers send designs?",
            a: "You can claim back everything you paid, the prize and the service fee. Claim it from your contest page after the contest ends; our team checks the contest and refunds you.",
          },
        ],
        onlyWithGuarantee: true,
      },
    ],
    cta: {
      heading: "Get logo ideas from different designers",
      body: "Write your brief, pick a prize and pay by bKash. Designers across Bangladesh can send ideas, and you choose the one you like (you pay the prize upfront when you start). Payments are final.",
      button: "Start a contest",
    },
  },
  bn: {
    title: "লোগো ডিজাইন করতে কত টাকা লাগে? ({year})",
    description: "বাংলাদেশে লোগো ডিজাইনের দাম কত ({year})? বাজারের সাধারণ দামের তুলনা, আর logocontest.bd-তে মোট {minTotal} থেকে কনটেস্ট: বিভিন্ন ডিজাইনারের আইডিয়া, পুরো কপিরাইট, চূড়ান্ত ফাইল।",
    h1: "বাংলাদেশে লোগো ডিজাইনের দাম ({year})",
    answer: "{year} সালে বাংলাদেশে একটি লোগো বানাতে সাধারণত ফেসবুক পেজ থেকে প্রায় ৳৫০০ থেকে শুরু করে ডিজাইন এজেন্সিতে ১ লাখ টাকা বা তারও বেশি খরচ হয়। logocontest.bd-তে ফিসহ মোট {minTotal} থেকেই কনটেস্ট শুরু করা যায়, আর সারা বাংলাদেশের ডিজাইনাররা আইডিয়া পাঠাতে পারেন, যেখান থেকে আপনি পছন্দেরটি বেছে নেন (পুরস্কার শুরুতেই দিতে হয়)।",
    breadcrumb: "লোগো ডিজাইনের দাম",
    sections: [
      {
        kind: "prices",
        heading: "logocontest.bd-তে কনটেস্টের দাম, ফিসহ",
        columns: { package: "প্যাকেজ", prize: "পুরস্কার", fee: "সার্ভিস ফি", total: "আপনি দেবেন" },
        note: "অন্য অঙ্কের পুরস্কার দিতে চান? {minPrize} থেকে নিজের মতো পুরস্কার ঠিক করে নিন। টেবিলের প্রতিটি মোট দামে {fee}% সার্ভিস ফি ধরা আছে (পুরস্কার {largeFrom}-এর বেশি হলে {largeFee}%)। আলাদা দামের অ্যাড-অন চাইলে নিতে পারেন।{?a: {addonsFreeFrom} বা তার বেশি পুরস্কারে প্রতিটি অ্যাড-অন ফ্রি; বাড়তি দিনের টাকা লাগে।} কনটেস্ট শুরুর সময়েই পেমেন্ট করতে হয়, আর পেমেন্ট ফেরত দেওয়া হয় না।",
      },
      {
        kind: "text",
        heading: "লোগোর দাম কিসের ওপর নির্ভর করে",
        paragraphs: [
          "দাম মূলত নির্ভর করে কে ডিজাইন করছেন আর কাজে কী কী থাকছে তার ওপর: একজন ডিজাইনার নাকি কয়েকজন, কয়টা আইডিয়া আর কয়বার পরিবর্তন পাবেন, আর সোর্স ফাইল ও কপিরাইট আপনার হাতে আসবে কি না।",
          "কনটেস্টে পুরস্কারের অঙ্কটা আপনি নিজেই ঠিক করেন। ডিজাইনাররা কাজ শুরুর আগেই পুরস্কার দেখেন, তাই পুরস্কার বড় হলে আরও বেশি ডিজাইনার অংশ নিতে পারেন, কাজও হতে পারে আরও যত্ন নিয়ে। বিজয়ী ডিজাইনার পুরস্কারের টাকা পান; সার্ভিস ফি পুরস্কারের ওপর আলাদা করে যোগ হয়।",
          "পরে যোগ হওয়া খরচের দিকে খেয়াল রাখুন। কিছু বিক্রেতা ভেক্টর ফাইল, কপিরাইট বা বাড়তি পরিবর্তনের জন্য আলাদা টাকা নেন। logocontest.bd-তে টেবিলের মোট দামেই ফি ধরা আছে, আর আলাদা দামের অ্যাড-অন শুধু আপনি নিলে যোগ হয়।",
          "সময়টাও আপনিই ঠিক করেন: কনটেস্ট সাধারণত {defaultDays} দিন চলে, চাইলে {minDays} থেকে {maxDays} দিনের মধ্যে যেকোনো মেয়াদ বেছে নিতে পারেন। লোগো ছাড়াও ভিজিটিং কার্ডের মতো অন্য ডিজাইনের জন্যও একইভাবে কনটেস্ট চালানো যায়।",
        ],
      },
      {
        kind: "compare",
        ours: "row",
        heading: "বাংলাদেশে লোগোর সাধারণ দামের তুলনা",
        columns: ["কোথায়", "সাধারণ দাম", "কতগুলো ডিজাইন থেকে বাছবেন", "জেনে রাখুন"],
        rows: [
          {
            label: "logocontest.bd-তে লোগো কনটেস্ট",
            cells: ["মোট {minTotal} থেকে", "বিভিন্ন ডিজাইনারের আইডিয়া (পুরস্কার শুরুতেই দিতে হয়)", "মোট দামে ফি ধরা আছে, পেমেন্ট চূড়ান্ত (টাকা ফেরত নেই); বিজয়ী পুরো কপিরাইট আর AI, EPS, SVG, PDF, PNG ও JPG ফাইল বুঝিয়ে দেন"],
          },
          {
            label: "ফেসবুক পেজের লোগো বিক্রেতা",
            cells: ["৳৫০০–৩,০০০", "সাধারণত একজন ডিজাইনারের কয়েকটা নমুনা", "টাকা দেওয়ার আগে সোর্স ফাইল (AI বা SVG) আর কপিরাইটের কথা জেনে নিন"],
          },
          {
            label: "ফ্রিল্যান্স মার্কেটপ্লেস, বাংলাদেশি ডিজাইনার",
            cells: ["৳১,৫০০–১২,০০০", "একজন ডিজাইনার; কয়টা আইডিয়া পাবেন তা প্যাকেজের ওপর নির্ভর করে", "কয়বার পরিবর্তন করা যাবে আর কোন কোন ফাইল পাবেন, দেখে নিন"],
          },
          {
            label: "ফ্রিল্যান্স মার্কেটপ্লেস, বিদেশি ডিজাইনার",
            cells: ["৳৬,০০০–৬০,০০০", "একজন ডিজাইনার; কয়টা আইডিয়া পাবেন তা প্যাকেজের ওপর নির্ভর করে", "সাধারণত দাম আর পেমেন্ট মার্কিন ডলারে"],
          },
          {
            label: "বাংলাদেশের ডিজাইন এজেন্সি",
            cells: ["৳১৫,০০০–১,০০,০০০+", "একটি টিমের কয়েকটা আইডিয়া", "প্রায়ই ব্র্যান্ড গাইড বা অন্যান্য ব্র্যান্ডিং কাজসহ প্যাকেজ হিসেবে বিক্রি হয়"],
          },
        ],
        note: "{year} সালের সাধারণ দামের ধারণা, কোনো নির্দিষ্ট কোটেশন নয়। আসল দাম ডিজাইনার আর কাজে কী কী থাকছে তার ওপর অনেকটাই ওঠানামা করে।",
      },
      {
        kind: "list",
        heading: "এই দামে যা পাবেন",
        items: [
          "বিভিন্ন ডিজাইনারের আইডিয়া: সারা বাংলাদেশের ডিজাইনাররা লোগো ডিজাইন পাঠাতে পারেন, তাই একজনের আইডিয়া নয়, কয়েকটি মিলিয়ে দেখে পছন্দেরটি বাছতে পারবেন (পুরস্কার শুরুতেই দিতে হয়)।",
          "কনটেস্ট চলার সময় স্টার আর মন্তব্য দিয়ে ডিজাইনারদের বুঝিয়ে দিতে পারবেন আপনার কী পছন্দ।",
          "কনটেস্ট শেষ হওয়ার পর বিজয়ী বাছতে {judgingDays} দিন সময়। সময়মতো না বাছলে কনটেস্ট কোনো ফল ছাড়াই শেষ হয়, আর পুরস্কার অংশ নেওয়া ডিজাইনারদের মধ্যে সমানভাবে ভাগ হয়ে যায়; টাকা ফেরত দেওয়া হয় না।",
          "বিজয়ীর কাছ থেকে চূড়ান্ত ফাইল: AI, EPS, SVG, PDF, PNG ও JPG।",
          "সাইটের মাধ্যমেই লোগোর পুরো কপিরাইট আপনাকে বুঝিয়ে দেওয়া হয়।",
          "ডিজাইনারকে আলাদা করে টাকা দিতে হয় না: বিজয়ী পুরস্কারের টাকাটাই পান।",
          "AI লোগো চেকার, যা অনলাইনে খুঁজে দেখে আপনার ডিজাইনগুলো অন্য কোনো লোগোর নকল বা খুব কাছাকাছি কি না: প্রতিটি লোগো কনটেস্টে ফ্রি।",
        ],
      },
      {
        kind: "text",
        heading: "{guaranteeDesigners} জনের কম ডিজাইনার অংশ নিলে পুরো টাকা ফেরত",
        paragraphs: [
          "কনটেস্ট শেষে যদি দেখা যায় {guaranteeDesigners} জনেরও কম ডিজাইনার ডিজাইন পাঠিয়েছেন, তাহলে আপনার দেওয়া পুরো টাকা, মানে পুরস্কার আর সার্ভিস ফি দুটোই, ফেরত চাইতে পারবেন।",
          "কনটেস্ট শেষ হওয়ার পর আপনার কনটেস্ট পেজ থেকে টাকা ফেরতের আবেদন করুন। আমাদের টিম যাচাই করে টাকা ফেরত দেবে।",
        ],
        onlyWithGuarantee: true,
      },
      {
        kind: "faq",
        heading: "লোগোর দাম নিয়ে প্রশ্ন",
        items: [
          {
            q: "লোগো ডিজাইন করতে কত টাকা লাগে?",
            a: "কে বানাচ্ছেন তার ওপর নির্ভর করে: সাধারণত ফেসবুক পেজ থেকে প্রায় ৳৫০০ থেকে শুরু করে এজেন্সিতে ১ লাখ টাকা বা তারও বেশি। logocontest.bd-তে পুরস্কার আর সার্ভিস ফি মিলিয়ে মোট {minTotal} থেকে লোগো কনটেস্ট শুরু হয়। প্যাকেজ থেকে পুরস্কার বাছতে পারেন, অথবা {minPrize} থেকে নিজের অঙ্ক ঠিক করতে পারেন।",
          },
          {
            q: "সার্ভিস ফি কত?",
            a: "পুরস্কারের {fee}%, আর পুরস্কার {largeFrom}-এর বেশি হলে {largeFee}%। ফি পুরস্কারের সাথে যোগ হয় এবং পেমেন্টের আগেই দেখানো হয়, তাই অ্যাড-অন না নিলে টেবিলে যে মোট দাম দেখছেন, সেটাই দেবেন।",
          },
          {
            q: "নিজের পছন্দমতো অঙ্কের পুরস্কার দেওয়া যায়?",
            a: "হ্যাঁ। প্যাকেজের বদলে {minPrize} থেকে নিজের মতো পুরস্কার ঠিক করতে পারেন। সার্ভিস ফি একইভাবে যোগ হয়।",
          },
          {
            q: "এর বাইরে আর কোনো খরচ আছে?",
            a: "শুধু আপনি নিলে। প্রাইভেট বা ব্লাইন্ড কনটেস্ট, NDA, হাইলাইট, আর্জেন্ট, কিংবা চলতি কনটেস্টের সময় বাড়ানো: এ রকম আলাদা দামের অ্যাড-অন শুধু আপনি নিলে যোগ হয়।{?a: {addonsFreeFrom} বা তার বেশি পুরস্কারে প্রতিটি অ্যাড-অন ফ্রি; শুধু বাড়তি দিনের টাকা লাগে।} AI লোগো চেকার প্রতিটি লোগো কনটেস্টে ফ্রি।",
          },
          {
            q: "বিকাশে পেমেন্ট করা যায়?",
            a: "হ্যাঁ। কনটেস্ট শুরু করার সময় বিকাশে টাকায় পেমেন্ট করবেন। দেশের বাইরে থাকলে কার্ড দিয়ে মার্কিন ডলারে পেমেন্ট করতে পারবেন। পেমেন্ট ফেরত দেওয়া হয় না (পেমেন্ট ও নো-রিফান্ড নীতি দেখুন)। একটাই ব্যতিক্রম, যা টাকা ফেরত নয়: বিজয়ী ডিজাইন কপি প্রমাণ হলে অন্য ডিজাইন বাছতে পারবেন। {judgingDays} দিনের মধ্যে বিজয়ী না বাছলে, বা চূড়ান্ত ফাইল পেয়ে সময়মতো সাড়া না দিলে, কনটেস্ট কোনো ফল ছাড়াই শেষ হয় এবং পুরস্কার অংশ নেওয়া ডিজাইনারদের মধ্যে সমানভাবে ভাগ হয়ে যায়।",
          },
          {
            q: "একটি কনটেস্ট কত দিন চলে?",
            a: "সাধারণত {defaultDays} দিন; চাইলে {minDays} থেকে {maxDays} দিনের মধ্যে যেকোনো মেয়াদ বেছে নিতে পারেন। শেষ হওয়ার পর বিজয়ী বাছতে {judgingDays} দিন সময় পাবেন।",
          },
        ],
      },
      {
        kind: "faq",
        heading: "টাকা ফেরতের গ্যারান্টি নিয়ে প্রশ্ন",
        items: [
          {
            q: "{guaranteeDesigners} জনের কম ডিজাইনার ডিজাইন পাঠালে কী হবে?",
            a: "আপনার দেওয়া পুরো টাকা, মানে পুরস্কার আর সার্ভিস ফি দুটোই, ফেরত চাইতে পারবেন। কনটেস্ট শেষ হওয়ার পর আপনার কনটেস্ট পেজ থেকে আবেদন করুন; আমাদের টিম যাচাই করে টাকা ফেরত দেবে।",
          },
        ],
        onlyWithGuarantee: true,
      },
    ],
    cta: {
      heading: "বিভিন্ন ডিজাইনারের কাছ থেকে লোগোর আইডিয়া নিন",
      body: "ব্রিফ লিখুন, পুরস্কার বাছুন আর বিকাশে পেমেন্ট করুন। সারা বাংলাদেশের ডিজাইনাররা আইডিয়া পাঠাতে পারেন, পছন্দেরটি আপনি বেছে নেবেন (পুরস্কার শুরুতেই দিতে হয়)। পেমেন্ট চূড়ান্ত, টাকা ফেরত দেওয়া হয় না।",
      button: "কনটেস্ট শুরু করুন",
    },
  },
};
