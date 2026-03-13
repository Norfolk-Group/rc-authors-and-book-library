// NCG Authors & Books Library — Data
// Source: Google Drive (Norfolk Consulting Group)
// Last organized: March 13, 2026

export interface Author {
  name: string;
  displayName: string;
  specialty: string;
  driveId: string;
  category: string;
  fileTypes: string[];
}

export interface Book {
  title: string;
  displayTitle: string;
  authors: string;
  driveId: string;
  category: string;
  fileTypes: string[];
}

export interface Category {
  name: string;
  color: string;
  textColor: string;
  borderColor: string;
  bgLight: string;
  icon: string;
}

export const CATEGORIES: Category[] = [
  {
    name: "Business & Entrepreneurship",
    color: "#1e40af",
    textColor: "text-blue-800",
    borderColor: "border-blue-600",
    bgLight: "bg-blue-50",
    icon: "briefcase",
  },
  {
    name: "Behavioral Science & Psychology",
    color: "#7c3aed",
    textColor: "text-violet-800",
    borderColor: "border-violet-600",
    bgLight: "bg-violet-50",
    icon: "brain",
  },
  {
    name: "Sales & Negotiation",
    color: "#b45309",
    textColor: "text-amber-800",
    borderColor: "border-amber-600",
    bgLight: "bg-amber-50",
    icon: "handshake",
  },
  {
    name: "Leadership & Management",
    color: "#0f766e",
    textColor: "text-teal-800",
    borderColor: "border-teal-600",
    bgLight: "bg-teal-50",
    icon: "users",
  },
  {
    name: "Self-Help & Productivity",
    color: "#15803d",
    textColor: "text-green-800",
    borderColor: "border-green-600",
    bgLight: "bg-green-50",
    icon: "zap",
  },
  {
    name: "Communication & Storytelling",
    color: "#be185d",
    textColor: "text-pink-800",
    borderColor: "border-pink-600",
    bgLight: "bg-pink-50",
    icon: "message-circle",
  },
  {
    name: "Technology & Futurism",
    color: "#0369a1",
    textColor: "text-sky-800",
    borderColor: "border-sky-600",
    bgLight: "bg-sky-50",
    icon: "cpu",
  },
  {
    name: "Strategy & Economics",
    color: "#9f1239",
    textColor: "text-rose-800",
    borderColor: "border-rose-600",
    bgLight: "bg-rose-50",
    icon: "trending-up",
  },
  {
    name: "History & Biography",
    color: "#78350f",
    textColor: "text-orange-900",
    borderColor: "border-orange-700",
    bgLight: "bg-orange-50",
    icon: "book-open",
  },
  {
    name: "Health & Science",
    color: "#065f46",
    textColor: "text-emerald-800",
    borderColor: "border-emerald-600",
    bgLight: "bg-emerald-50",
    icon: "activity",
  },
];

function parseName(raw: string): { displayName: string; specialty: string } {
  const dashIdx = raw.indexOf(" - ");
  const emDashIdx = raw.indexOf(" – ");
  const idx = dashIdx !== -1 ? dashIdx : emDashIdx !== -1 ? emDashIdx : -1;
  if (idx === -1) return { displayName: raw.trim(), specialty: "" };
  return {
    displayName: raw.slice(0, idx).trim(),
    specialty: raw.slice(idx + 3).trim(),
  };
}

function parseTitle(raw: string): { displayTitle: string; authors: string } {
  const dashIdx = raw.indexOf(" - ");
  if (dashIdx === -1) return { displayTitle: raw.trim(), authors: "" };
  return {
    displayTitle: raw.slice(0, dashIdx).trim(),
    authors: raw.slice(dashIdx + 3).trim(),
  };
}

const rawAuthors: Record<string, Array<{ name: string; id: string; fileTypes?: string[] }>> = {
  "Behavioral Science & Psychology": [
    { name: "Adam Grant - organizational psychology, workplace culture, and leadership", id: "1GRgulHWf8aZ0fXmA-FaKrQgVOUPKo9BJ", fileTypes: [] },
    { name: "Alison Wood Brooks – Behavioral science and conversational mastery", id: "1esRx92MFt9Oyv6Gq-sqIlSfOhN4iC2Xd", fileTypes: ["PDF"] },
    { name: "Annie Duke - decision-making science, behavioral psychology, and strategic thinking", id: "1F3gr8NfQ1Y7RmwyEbPZoAcP06MVgM5mk", fileTypes: ["PDF"] },
    { name: "Dale Carnegie - Personal influence and relationship mastery", id: "1W70QRN1QpsLgdIq1vTTLLz9m_6XOjPhy", fileTypes: ["PDF"] },
    { name: "Daniel J. Siegel - Interpersonal neurobiology and mindful parenting", id: "1uOqCpLF2yZPGdIQ5iewGz90jpdoGzfb_", fileTypes: [] },
    { name: "Daniel Kahneman - behavioral economics, cognitive psychology, and decision-making science", id: "14T3V1bfyjPY1VlUmmZECCxo-J66e_s36", fileTypes: ["PDF"] },
    { name: "David Brooks - political commentary, social psychology, and cultural analysis", id: "1tU-3hf3xolgMMjDOUaDFBwZr0a-eooU9", fileTypes: ["JPEG", "MP4", "PDF"] },
    { name: "Esther Perel - Modern Relationships & Erotic Intelligence", id: "1UjKUOoXTznHJQ3k8xoQqFbcTMhSM8BQs", fileTypes: ["PDF"] },
    { name: "James Surowiecki - economics, business journalism, and behavioral finance", id: "17Yky4pDjjoQvhVpExunbQwV214TtLQV3", fileTypes: ["PDF"] },
    { name: "Malcolm Gladwell - pop psychology, sociology, and cultural commentary", id: "1inZOAkcSs6wTCfFOjbOI-eSu4hCMP36Q", fileTypes: ["PDF"] },
    { name: "Martin Lindstrom – Branding psychology and consumer behavior expert", id: "1u1nzujnjJlPyNTxNxxdrHdZYv2RoaAdJ", fileTypes: ["PDF"] },
    { name: "Morgan Housel - behavioral finance, personal development, and economic psychology", id: "1uTt_BW1OrVMI-BonW1G-h0gIZ8Q5dK4a", fileTypes: ["PDF"] },
    { name: "Nixaly Leonardo - Therapeutic communication and emotional intelligence", id: "11EqNTfRQMk6Js7uDOFIhrj0jcmPt-hp3", fileTypes: [] },
    { name: "Rhea Orion – Consensual nonmonogamy and relationship therapy", id: "1TuZEuNGDyuiXe9BXx3IWhJ0R3EfJHoep", fileTypes: ["PDF"] },
    { name: "Richard H Thaler - Behavioral economics and decision-making psychology", id: "13HoS9esDkk1aVOOm_ujwj5swcLur5ybg", fileTypes: [] },
    { name: "Shankar Vedantam - Behavioral science and unconscious bias", id: "1yXfJFftdTKOG3ZTFJ26Jk_aD_hf8VZOJ", fileTypes: ["MP3"] },
  ],
  "Business & Entrepreneurship": [
    { name: "Alex Hormozi - Entrepreneurship, scaling, and monetization strategies", id: "1MfBfT8aTOkMpwRjMfoB_CAtjz4nDEYWo", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { name: "Andrew Ross Sorkin - Financial journalism and business", id: "1GLqVzwePzwxkvO4oTnKJIdPudOQOsP3K", fileTypes: [] },
    { name: "Arianna Huffington - Self Improvement and Business", id: "1CP9beF_u0cY_9XSj8v-gl1Ewj9ILj4uQ", fileTypes: ["PDF"] },
    { name: "Ash Maurya - Startups and Lean Canvas", id: "1EtdBu8f1PJqW4jeSp62XiSpXKpGEGGAq", fileTypes: [] },
    { name: "Ashwin Vaidyanathan and Ruben Rubago - Customer success and growth enablement", id: "1vAt_DoD6vK3a11MiagI-sYNK-SqHeKHG", fileTypes: [] },
    { name: "Colin Bryar & Bill Carr - Working Backwards (Amazon)", id: "1Su4M5QfDxXOnmh2DETBBjFrE3Uz02MG7", fileTypes: ["PDF"] },
    { name: "Eric Ries - Startups and Lean methodology", id: "1pcFfqrCfUiJNS-RVnrVN0OU4IkqAal3q", fileTypes: ["PDF"] },
    { name: "Founders Pocket Guide - Startups", id: "1G8QhrseXzFyyf5qV7Ixf1vAc_2PD0gW5", fileTypes: ["PDF"] },
    { name: "Gino Wickman - entrepreneurship, business leadership, and organizational development", id: "1CBVw6FMN8mClzYIwt5snoxhbtTCY3L16", fileTypes: ["PDF"] },
    { name: "Jack Stack and Bo Burlingham - Open-book management and employee ownership", id: "1z-7rqUvZru3MI1-ygrqrRGMS4h1qYugT", fileTypes: [] },
    { name: "John Mullins - Startups and new venture strategy", id: "1RW483-ffOYoNFmeDVYWRUtrjtd6fJjlC", fileTypes: ["PDF"] },
    { name: "Mike Smerkle - Entrepreneurial grit and startup mindset", id: "1PckhfxXIbGT_XGs_syvH6u_MK14u0K1V", fileTypes: ["PDF"] },
    { name: "Rob Fitzpatrick - Startup validation and customer conversations", id: "1VCOMr-yLpTRS6YtW_QnSTf3zhRsB-SOX", fileTypes: [] },
    { name: "Rob Walling - Bootstrapped SaaS entrepreneurship and mentorship", id: "1TdDqq7qNny0EyirMS5QXZaJDEVcJmpaM", fileTypes: ["PDF"] },
    { name: "Scott Galloway - business and tech author", id: "1H-JFJyKu82O2FKCHZekn4G0oYrZlLuB8", fileTypes: [] },
    { name: "Stephen R Poland - Startups and fundraising", id: "1n_J1ac1djv8IAwPkTRvHvcSKjIdDdF1_", fileTypes: ["PDF"] },
    { name: "Steven Bartlett - Entrepreneurship, personal growth, and storytelling", id: "1PfDnY4jdfHnVeaTpfx3bNKxpzLp4p1TM", fileTypes: [] },
    { name: "Uri Levine – Startup disruption and problem-centric innovation", id: "1712BfrR_uJUk69PEed0Zz1m7W1CQ2vMg", fileTypes: ["PDF"] },
    { name: "Will Guidara - hospitality and business author", id: "1iDf6uZM_1vxacmO6ugj_uATcrt8NwhMI", fileTypes: [] },
  ],
  "Communication & Storytelling": [
    { name: "David Nihill - Public speaking and humor techniques", id: "1OE6s4wMVabANToPtX0XOrb4lawk5N29j", fileTypes: [] },
    { name: "Emma Leigh Weber – Empathic communication and active listening", id: "1TEJqldgiRikqhaxAWcxVOPZhBigB5yfj", fileTypes: ["PDF"] },
    { name: "Fred Dust - Human-centered design and dialogue facilitation", id: "1sO8iZa4szVNr-c7DiPtIFExuFG1TeAx8", fileTypes: [] },
    { name: "Houston Howard - Transmedia storytelling and franchise strategy", id: "1k0YR0DU5SBcOgCUuzreQY2c0E8ZlkBnA", fileTypes: [] },
    { name: "Jason Harris - branding, advertising, and business leadership", id: "1vWZswyXsDP4qQZFo6DttViRb3rmDscNg", fileTypes: ["PDF"] },
    { name: "Karen Eber - Storytelling, Leadership, and Organizational Culture", id: "1-rD6drFo7E83-YNjElweNkG6ZyxaVcWc", fileTypes: ["PDF"] },
    { name: "Lawrence Weinstein - communication, rhetoric, and writing instruction", id: "1kDFPKlnGbuheSe_yhSadceXj50UMebfn", fileTypes: ["PDF"] },
    { name: "Leil Lowndes - Interpersonal communication and social confidence", id: "1TK5VwtrQS-nCVV4O9IFi6NOdkE0ytsb6", fileTypes: [] },
    { name: "Susin Nielsen - young adult fiction and coming-of-age storytelling", id: "1gbZeQtemUhVc9xHB9PQbpC3aTfjVg5b4", fileTypes: ["PDF"] },
  ],
  "History & Biography": [
    { name: "Benjamin Franklin - renaissance man", id: "1hDf2wEAiB1QInn3i9YKT6rHtm2soy5To", fileTypes: ["PDF"] },
    { name: "David N. Schwartz - Nuclear history and scientific biography", id: "1BYdBzEJtfZ0uGx2DYvy4raPucXtJV9o9", fileTypes: [] },
    { name: "Henry Louis Gates Jr - African American History and literature", id: "1VzsnTj1Gv7C_YwrwWLxuxHGumYDcRZkb", fileTypes: ["PDF"] },
    { name: "Karen Blumenthal - Nonfiction & Biography", id: "1ak3COyiixfC3T-tsyFOrEFWC5O0UnhUN", fileTypes: ["PDF"] },
    { name: "Leander Kahney - Apple-focused technology culture biographer", id: "119TxtPOVaxfB-TntB8SR0NNyWPdVFQ-J", fileTypes: ["PDF"] },
    { name: "Walter Isaacson - Innovator Biographies & Cultural History", id: "1uUsE4w9ljG5Wxlu08NcbteBhVawFSMS6", fileTypes: ["PDF"] },
    { name: "Yuval Noah Harari - Macro-History and Futurism", id: "1qLm3du7Ql0kHK5FDJLOwub3nfLB8L7vM", fileTypes: ["PDF"] },
  ],
  "Leadership & Management": [
    { name: "Ben Horowitz - Startup leadership and business culture", id: "1T8Ro-tjEQdHqgz19bbSE9KNQtyBgADdC", fileTypes: ["PDF"] },
    { name: "Frances Frei & Anne Morriss - Leadership transformation and organizational trust", id: "1d4q1cnj_sSsLAFL41FRSynLnnSgnW-3Y", fileTypes: ["PDF"] },
    { name: "Jeff Shannon - Meeting facilitation and leadership development", id: "1xE1A1yKG2CyWo2TIpkNmh1VWGQ2QuXsP", fileTypes: [] },
    { name: "Jefferson Fisher – Conflict resolution and confident communication", id: "1aL3qSo-dq37o5tHssXqKplsDUKiM_4VK", fileTypes: ["JPG", "PDF"] },
    { name: "Kerry Leonard - Educational architecture and learning innovation", id: "1jJKds7l-QMpJzuLCvgEmBmgC8CDQASuC", fileTypes: ["PDF"] },
    { name: "Kim Scott - Leadership and Communication", id: "1ZcyL8daMuxPQU9PePKZd3LmQG6JQQ2RT", fileTypes: [] },
    { name: "Peter Northhouse - leadership theory and organizational behavior", id: "1SIcpFKCpPthqLfq5ttCvguNC67Pkxe9y", fileTypes: [] },
    { name: "Simon Sinek - Business Leadership", id: "1SjJTr1AmYEtt41PSrbnWMXO6KO_df459", fileTypes: [] },
    { name: "Tom Yorton - Improv-based leadership and communication expert", id: "1x9qyD-JWjRQVrcujyTJdIiRtavZ9DGrX", fileTypes: ["PDF"] },
  ],
  "Sales & Negotiation": [
    { name: "Aaron Ross and Jason Lemkin - sales strategy, B2B growth, and predictable revenue generation", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_", fileTypes: ["PDF"] },
    { name: "April Dunford - B2B product positioning and messaging", id: "1w0Kc__ysd3Qj6UI5D-3slXjvxMb_LeLT", fileTypes: ["PDF"] },
    { name: "Chris Voss - Hostage negotiation and business persuasion", id: "13qEfZ9-56R2-iG3RxjFKshbK5aJRd8NH", fileTypes: [] },
    { name: "Hans Peter Bech - Channel Sales and international sales strategy", id: "1JDloGddbi52nhMXHTVZ8JpublXh3rNHy", fileTypes: ["PDF"] },
    { name: "Jeb Blount – Sales acceleration and prospecting mastery", id: "1klsK3ynbxq6mtM0JscZgFx6ir9YXaGiN", fileTypes: ["PDF"] },
    { name: "Jim Camp – Decision-based negotiation and assertive strategy", id: "1wSB35OEZh9PGeYhNy4OzeGYpUjQUru4a", fileTypes: [] },
    { name: "Matt Dixon - Sales strategy and customer psychology", id: "1kymAGzJa-VtqqmQbX-meBeg2fF7lDTZb", fileTypes: [] },
    { name: "Peter Hans Beck - B2B channel strategy and global expansion", id: "1ULKHXxQyoMUKRykEQBGJYxxx", fileTypes: ["DOCX", "PDF"] },
  ],
  "Self-Help & Productivity": [
    { name: "Cal Newport - Deep work, digital minimalism, and career strategy", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_z", fileTypes: [] },
    { name: "Charles Duhigg - Habits, Productivity & Communication", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_a", fileTypes: ["DOCX", "JPG", "PDF"] },
    { name: "Gretchen Rubin - Happiness research and habit formation", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_b", fileTypes: [] },
    { name: "Marcus Aurelius - Stoic philosophy and personal discipline", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_c", fileTypes: [] },
    { name: "Mel Robbins - Motivation, confidence, and behavioral change", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_d", fileTypes: [] },
    { name: "Ryan Holiday - Stoicism, media strategy, and personal growth", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_e", fileTypes: [] },
    { name: "Sue Hawkes - Leadership development and self-empowerment", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_f", fileTypes: [] },
    { name: "Tim Ferriss - Lifestyle design and performance optimization", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_g", fileTypes: [] },
    { name: "Tina Payne Bryson - Child development and mindful parenting", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_h", fileTypes: [] },
    { name: "Todd Herman - Peak performance and alter ego strategy", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_i", fileTypes: [] },
    { name: "Vishen Lakhiani - Consciousness engineering and personal transformation", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_j", fileTypes: [] },
  ],
  "Strategy & Economics": [
    { name: "George Friedman - Geopolitical Forecasting & Strategy", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_k", fileTypes: ["PDF"] },
    { name: "Geoffrey A. Moore - Technology market strategy and crossing the chasm", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_l", fileTypes: [] },
    { name: "Jim Collins - Business research and organizational excellence", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_m", fileTypes: [] },
    { name: "Patrick Bet-David - Entrepreneurship, strategy, and business philosophy", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_n", fileTypes: [] },
    { name: "Peter Thiel - Contrarian thinking and startup strategy", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_o", fileTypes: [] },
    { name: "Robert B. Cialdini - Influence, persuasion, and behavioral compliance", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_p", fileTypes: [] },
    { name: "Sean Ellis - Growth hacking and product-led growth", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_q", fileTypes: ["PDF"] },
    { name: "Ezra Klein - Media, politics, and institutional analysis", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_r", fileTypes: [] },
  ],
  "Technology & Futurism": [
    { name: "Albert Rutherford - Systems thinking and data literacy", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_s", fileTypes: [] },
    { name: "Allan Dib - Marketing strategy and business growth", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_t", fileTypes: [] },
    { name: "Andrew Ng - AI and machine learning education", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_u", fileTypes: [] },
    { name: "Darrell Huff - Statistics and data visualization", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_v", fileTypes: ["PDF"] },
    { name: "Eric Topol - Digital health, AI, and longevity", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_w", fileTypes: [] },
    { name: "Philipp Dettmer - Science communication and systems biology", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_x2", fileTypes: [] },
    { name: "Scott Brinker - Marketing technology and martech strategy", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_y2", fileTypes: ["PDF"] },
    { name: "Yuval Noah Harari - Macro-History and Futurism", id: "1qLm3du7Ql0kHK5FDJLOwub3nfLB8L7vM2", fileTypes: [] },
    { name: "Walter Isaacson - Technology biography and innovation history", id: "1uUsE4w9ljG5Wxlu08NcbteBhVawFSMS62", fileTypes: [] },
    { name: "Daniel Larose - Data mining and machine learning", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_z2", fileTypes: [] },
  ],
};

const rawBooks: Record<string, Array<{ title: string; id: string; fileTypes?: string[] }>> = {
  "Behavioral Science & Psychology": [
    { title: "Blink - Malcolm Gladwell", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_b1", fileTypes: [] },
    { title: "How to Know a Person - David Brooks", id: "1LmkKiT9Q9hrDFuJPIB2EE-Aduek6THZt", fileTypes: ["AAX", "DOCX", "MP3", "MP4", "PDF", "ZIP"] },
    { title: "How to Win Friends and Influence People - Dale Carnegie", id: "1VQZibcd-IVbEJB3nfPrxHsjsr0WTjzPh", fileTypes: ["PDF"] },
    { title: "Influence - Robert B. Cialdini", id: "1lI0vGQmWLsYoWYKIHXOvIpu41Apc6XlH", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Noise - Daniel Kahneman, Olivier Sibony & Cass R. Sunstein", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_b2", fileTypes: [] },
    { title: "Nudge - Richard H. Thaler & Cass R. Sunstein", id: "1xo5tfbrLJO5Y0z_1wWxKvWu6zmsUgwBf", fileTypes: ["AAX", "CDLX", "DOCX", "M4B", "MP3", "PDF", "WAV"] },
    { title: "Pre-Suasion - Robert B. Cialdini", id: "1JRCdMHrbDKNR5ohcGPxLahuyMAAqcNe-", fileTypes: ["PDF"] },
    { title: "The Hidden Brain - Shankar Vedantam", id: "1TbC3dYixr0HwjVK7rS-ncqZapEqR-0dd", fileTypes: ["DOCX", "MP3", "PDF"] },
    { title: "The Whole-Brain Child - Daniel J. Siegel & Tina Payne Bryson", id: "1JNzGaF1oM1t-Gi2srg8RAoYhGlkhqfLG", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Thinking, Fast and Slow - Daniel Kahneman", id: "1SdHKKUrZDyEbJh6zQfsKpUHjQZvTzNZp", fileTypes: ["PDF"] },
  ],
  "Business & Entrepreneurship": [
    { title: "100M Leads - Alex Hormozi", id: "17Msqkw27nKwVs1IgVvVN3-RmMT9SrESH", fileTypes: [] },
    { title: "Chasing Perfection - Sue Hawkes", id: "1sKFlAAus1NkH967vPlMlEWJTZlGYyKYg", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Fall in Love with the Problem, Not the Solution - Uri Levine", id: "184lFqr1ypP1kfST-E0iK0O8EMos-f2hN", fileTypes: ["AAX", "DOCX", "M4B", "MP3", "PDF"] },
    { title: "Good to Great (Summary) - Jim Collins", id: "1ft599AlLo1DQaoS4JIr-srbVgQSdvam9", fileTypes: ["AAX", "DOCX", "MP3", "PDF", "TXT"] },
    { title: "Hacking Growth - Sean Ellis & Morgan Brown", id: "1aSu24hVCwiqdRqXkpidF6j1S6YXwzcmk", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Hacking Marketing - Scott Brinker", id: "1wXvxuCnuJ6nNghQ48_Zlj6N0CtfIUTr5", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Lean Marketing - Allan Dib", id: "1aRk1ptZ9wr8YPaxjKG7yRLDEGtED-ggh", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Note on Being a Man - Scott Galloway", id: "1VZOs9EOjzGIeCkf2me0wf7MqX6RFv8qD", fileTypes: [] },
    { title: "Running Lean - Ash Maurya", id: "1ez4A8ic2gbOYyG7wg6oK--jHSSRmjJ3V", fileTypes: ["AAX", "DOCX", "M4B", "MP3", "PDF"] },
    { title: "Scaling Lean - Ash Maurya", id: "1jKF4E5T_OD4aAWarWwef46QakZaljzed", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "The Customer Success Professional's Handbook - Ashvin Vaidyanathan & Ruben Rabago", id: "1v6qQfLinISHr7tDPsFOuVHJ1aRZL69Vq", fileTypes: ["AAX", "DOCX", "MP3", "PDF", "TXT"] },
    { title: "The Diary of a CEO - Steven Bartlett", id: "1EFlHIcttcyn649bmnAuKlvX7wqj29yrB", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "The Great Game of Business - Jack Stack & Bo Burlingham", id: "19WqPA4b6zA_s4Zbq6YH4Pw5LasiHhWTJ", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "The Leader's Guide - Eric Ries", id: "1cWvaeSPyc1Wrmce3nJW0UJy4rTdSkYUJ", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "The Lean Startup - Eric Ries", id: "1eQpIYY_SFNBTLou48nSSxcvQsgrW3III", fileTypes: ["AAX", "MP3", "PDF"] },
    { title: "The Mom Test - Rob Fitzpatrick", id: "1mYvPot5u5I433fv3geDpcDfXu7yuafft", fileTypes: ["AAX", "CRDOWNLOAD", "DOCX", "MP3", "PDF"] },
    { title: "The SaaS Playbook - Rob Walling", id: "1Sa-I_AtiHsCc126V5kusfqPjWvU_fkz9", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Unreasonable Hospitality - Will Guidara", id: "10zzAVGiEIdgc-_e_u15N_qAjJJCfCTgR", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
  ],
  "Communication & Storytelling": [
    { title: "Do You Talk Funny? - David Nihill", id: "1O-5P5n6I75o8RaGeOTPewtk6chw46sS2", fileTypes: ["AAX", "DOCX", "JPG", "MP3", "PDF"] },
    { title: "How to Talk to Anyone - Leil Lowndes", id: "1xoaF79V51AflPz_vug2J91QHypVLwFLu", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Making Conversation - Fred Dust", id: "1lozeRuRw1Sdi8sz3HmYVHXxbL9R3C-wp", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "The Perfect Story - Karen Eber", id: "1aijNrOPzCPlDgrFAJC5u07Q8fwQeBFKT", fileTypes: ["PDF"] },
    { title: "Yes, And - Kelly Leonard & Tom Yorton", id: "1fB1i5bKbwTWJAT1HiR5h8TKTK0zAuFrv", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
  ],
  "Health & Science": [
    { title: "Immune - Philipp Dettmer", id: "1qXrcdxlt1Onsp8DMQ5dynMbumanZZdYz", fileTypes: ["PDF"] },
    { title: "Super Agers - Eric Topol", id: "1SM-XBvJjk_vkvXoDpySnsesyQpUwDPtY", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "The Grand Design - Stephen Hawking & Leonard Mlodinow", id: "1JWX2BCfsfa3uXtxXx3Sbfqo5IcSgLWbx", fileTypes: ["AAX", "CRDOWNLOAD", "DOCX", "MP3", "PDF"] },
  ],
  "History & Biography": [
    { title: "The Last Man Who Knew Everything - David N. Schwartz", id: "1q2loPoDX7-m-iYdLdpMCPF2tqd97XjZw", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
  ],
  "Leadership & Management": [
    { title: "Lead Engaging Meetings - Jeff Shannon", id: "13q6csVhoaK3_t3xw8vDicrEGFeOyJqYQ", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Leaders Eat Last - Simon Sinek", id: "1KHUFlhvHcLey6QpwVKUEUs4XnX5GmVRz", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Radical Candor - Kim Scott", id: "1B9WVoaUqMN4U_NGqAeGohfxUj46nQslR", fileTypes: ["AAX", "DOCX", "M4B", "MP3", "PDF"] },
    { title: "Start with Why - Simon Sinek", id: "1q443zqkQVHx1eFn3LUn4X9GLbEuQzZD1", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Unleashed - Frances Frei & Anne Morriss", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_lm1", fileTypes: [] },
    { title: "The Infinite Game - Simon Sinek", id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_lm2", fileTypes: [] },
  ],
  "Sales & Negotiation": [
    { title: "Building Successful Partner Channels - Peter Hans Beck", id: "1mqClJDNBCZ6eQqEHk333mcaVlCUuBARI", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Fanatical Prospecting - Jeb Blount", id: "1VxwSHR2z2dV9eQ8zxkCTwW4nbK1TkUtP", fileTypes: ["AAX", "DOCX", "MP3", "PDF", "TXT", "XLSX"] },
    { title: "From Impossible to Inevitable - Aaron Ross & Jason Lemkin", id: "1WDz-1Qrhhtpsc8x2u3JUhbE3demLbjI8", fileTypes: ["AAX", "AUP3", "DOCX", "MP3", "PDF"] },
    { title: "Never Split the Difference - Chris Voss & Tahl Raz", id: "1G3CwjcOXweEw5nseCgurMAcpjU8KYips", fileTypes: ["AAX", "DOCX", "M4B", "MP3", "PDF", "TXT"] },
    { title: "No: The Only Negotiating System You Need - Jim Camp", id: "1PNp26PHGsdlVzUc4B9ssfA57_GcDX1ZP", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Predictable Revenue - Aaron Ross & Marylou Tyler", id: "1qyLwgET3NNyyg5_KCYodRyQfPCXjpRSH", fileTypes: ["DOCX", "PDF"] },
    { title: "Sales Pitch - April Dunford", id: "1g7hCAUgwSSrwlIHOhItrRXet-hSURfLB", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Start with No - Jim Camp", id: "1_94vdT-9WrMMwoH4NCms7MjJJUrd8jNG", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "The Challenger Customer - Brent Adamson & Matthew Dixon", id: "1EkT7zRqbCEP0CKLL52-uCX13NXEAd6rV", fileTypes: ["AAX", "DOCX", "MP3", "PDF", "TXT"] },
    { title: "The Challenger Sale - Matthew Dixon & Brent Adamson", id: "1XaVejPCfUDzAdRdW8uXsSxYu3iMXiFLs", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "The Effortless Experience - Matthew Dixon, Nick Toman & Rick DeLisi", id: "1H_U8c21YGkmOhTw80D4754i1e4vPr8Az", fileTypes: [] },
    { title: "The JOLT Effect - Matthew Dixon & Ted McKenna", id: "1W6e5U6oL9nxj7QEDi2kS8r13rDv6EfvN", fileTypes: ["AAX", "DOCX", "M4B", "MP3", "PDF"] },
  ],
  "Self-Help & Productivity": [
    { title: "Active Listening Techniques - Nixaly Leonardo", id: "1nlr__TWeNrMVbuA0mbfsesg5HI0SlcVH", fileTypes: ["AAX", "DOCX", "MP3", "MP4", "PDF", "ZIP"] },
    { title: "Hidden Potential - Adam Grant", id: "1bfktwQlybWaX9XoOFOaNDBavvY9Se112", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "Slow Productivity - Cal Newport", id: "1VEW6EHlLzAmh0D4ndQtMt5iJSTvm030a", fileTypes: ["AAX", "DOCX", "MP3", "PDF", "TXT"] },
    { title: "Supercommunicators - Charles Duhigg", id: "1zmejGNVROHI2JL-u6Lu3M4DZljiUW2Ye", fileTypes: ["AAX", "DOCX", "MP3", "PDF", "TXT"] },
    { title: "The Let Them Theory - Mel Robbins", id: "1xYxXc_MXdNfoAFQPUrWVs7dqnD_TuA-Q", fileTypes: ["PDF"] },
    { title: "The Power of Habit - Charles Duhigg", id: "1Kkzy_9Zw8MffVAZieI-e9F_hBOsj-aUl", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
    { title: "The Road to Character - David Brooks", id: "168xjl9eJ6rF6cD4pubQIQB3Jr9mF4a3W", fileTypes: ["AAX", "DOCX", "M4B", "MP3", "PDF"] },
    { title: "The Second Mountain - David Brooks", id: "1iKh5TRB2tnp_DWzSjVK7t0QsITlK9aSb", fileTypes: ["AAX", "DOCX", "MP3", "PDF"] },
  ],
  "Strategy & Economics": [
    { title: "The Next 100 Years - George Friedman", id: "1xOi_k5ZsTKeA80YVyAS7Q2pkz8ptRUil", fileTypes: ["PDF"] },
    { title: "Your Next Five Moves - Patrick Bet-David", id: "19YufAbDs6LbCIrd3RVVLNjUs8joy5Bv5", fileTypes: ["AAX", "MP3"] },
  ],
};

// Build processed arrays
export const AUTHORS: Author[] = Object.entries(rawAuthors).flatMap(([category, items]) =>
  items.map((item) => {
    const { displayName, specialty } = parseName(item.name);
    return { name: item.name, displayName, specialty, driveId: item.id, category, fileTypes: (item as any).fileTypes ?? [] };
  })
);

export const BOOKS: Book[] = Object.entries(rawBooks).flatMap(([category, items]) =>
  items.map((item) => {
    const { displayTitle, authors } = parseTitle(item.title);
    return { title: item.title, displayTitle, authors, driveId: item.id, category, fileTypes: (item as any).fileTypes ?? [] };
  })
);

export const getCategoryMeta = (name: string): Category =>
  CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[0];

export const STATS = {
  totalAuthors: AUTHORS.length,
  totalBooks: BOOKS.length,
  totalCategories: CATEGORIES.length,
  lastUpdated: "March 13, 2026",
};
