# Super Conversations — Methodology & Agent Voice Spec

> **Source of truth:** *What Are Super Conversations?* by Ricardo Cidale
> (PDF provided Jun 14 2026). This file is a faithful restatement of that
> document plus notes on how it maps onto the Book Agents / Author Agents.
> Every methodology claim below traces to the source PDF — no invented quotes,
> frameworks, or attributions. If this file and the PDF ever disagree, the PDF
> wins and this file is the bug.

## What Super Conversations Are

Super Conversations are a foundational methodology, designed by Ricardo Cidale,
for **transforming sales interactions** — focused on building relationships,
deepening engagement, and driving long-term client satisfaction. They guide both
human sales professionals and AI agents (trained via prompt engineering atop
LLMs) toward meaningful dialogue rather than transactional exchanges.

The methodology applies in two settings:
- **Human-led** — a sales professional running a discovery-driven conversation.
- **AI-led** — an agent on an LLM replicating that depth through prompt
  engineering, adapting in real time to client input, and taking on pre-sales
  roles (lead qualification, follow-ups, prospecting) traditionally held by SDRs.

## The Seven Pillars

1. **Curiosity & Open-Ended Questions.** Lead with curiosity. Open-ended
   questions ("What are your biggest challenges this quarter?") turn a pitch into
   a discovery session and surface true needs. AI agents replicate this by asking
   relevant, dynamically-adapted follow-ups.

2. **Personalization & Value.** Tailor every dialogue to the client's specific
   challenges and context; deliver personalized solutions, not generic offerings.
   AI agents draw on customer data and history to offer value-driven, uniquely
   relevant responses.

3. **Active Listening & Engagement.** Truly listen before responding; let the
   client lead and uncover deeper insight rather than rushing to pitch. AI agents
   analyze words, tone, and sentiment in real time to respond with relevance and
   steer naturally — never scripted or robotic.

4. **Building Long-Term Relationships.** Optimize for trusted-advisor status and
   lasting partnership, not the single close — critical in B2B. AI agents sustain
   this by tracking engagement across touchpoints and surfacing timely,
   need-based follow-ups.

5. **Structure & Adaptability.** Follow a structured flow — discovery → value
   presentation → handling objections — while staying flexible enough to pivot on
   the client's real-time responses. AI agents follow structured prompts but
   adjust as the conversation shifts.

6. **Proving Differentiation.** Don't just list unique features — demonstrate how
   they solve *this* client's specific challenges. AI agents provide real-time,
   data-backed comparisons, success stories, and case studies relevant to the
   client's concerns.

7. **Reducing Friction & Enhancing Productivity.** Remove friction from pre-sales
   work. AI agents handle qualification, follow-ups, and prospecting without
   interpersonal friction (politics, bias, clashes), freeing humans for
   high-value work like closing.

## How This Maps to the Library's Agents

The library's Book Agents and Author Agents are built to *be interviewed* — the
eventual "Super Conversations" book is written largely by conversing with them.
The seven pillars therefore govern the **interviewer side** of those exchanges:

- Lead with **open-ended curiosity** (Pillar 1) when querying an agent — favor
  "What's the core tension in your argument about X?" over yes/no prompts.
- **Active listening** (Pillar 3) → each agent turn should build on the prior
  answer, follow the tangent briefly, then bridge back to the thread.
- **Structure & adaptability** (Pillar 5) → interviews follow a discovery arc but
  pivot on what the agent reveals.
- **Differentiation** (Pillar 6) → when two authors disagree, surface and probe
  the contrast rather than smoothing it over.

This mapping is an *application* of the methodology, not part of the source doc.
It is the design intent for the agent layer and should be revised as the
Super Conversations book concept is fleshed out.

## Open Questions (to confirm with Ricardo before building the agent layer)

- Should agent personas speak *in the sales-methodology register* (selling their
  ideas), or as neutral subject-matter experts being interviewed?
- Citation policy: when an agent answers, how prominently should it distinguish
  the book itself vs. Ricardo's notes vs. external research?
- Naming: each Book Agent gets a name — author-chosen, title-derived, or
  AI-suggested for approval?
