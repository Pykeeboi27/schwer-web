# /brag plan — Schwer Online Management

**Tone:** "fake Series A launch from 2016" → nearest preset `yc-parody` (played straight, one claim per scene, hard-ish cuts), dressed in 2016 launch-video tropes: "It's like Uber, but for…", ukulele + claps + glockenspiel, a blinking caret, flat colour-band wipes, "Introducing", and a funding announcement.
**Format:** landscape 1920×1080, 30fps, 23.5s.

## Rubric

- **What is it?** An internal ERP portal for Schwer PH that runs one pipeline: costing → quotation → purchase order → collection.
- **Who is it for / what does it do?** Schwer's engineering, sales and executive teams. Engineering prices the cost, sales adds margin and closes, executives approve and track revenue against targets.
- **What sets it apart?** One pipeline across departments, a strict sequential approval chain (sales manager → executive → owner for ≥ ₱3M), and RLS on every table.
- **Most impressive / funniest claim?** It ceilings every unit price to the nearest ₱100 (₱7,562.79 → ₱7,600.00, straight from `lib/sales/pricing.ts`). Also, it's a glossy launch for a tool whose own footer says "Internal use only."
- **Visual hook:** a 2016 startup pitch line being typed out: "It's like Uber, / but for quotations."
- **Real UI to show:** the logo (bar-by-bar), the landing headline "From costing to collection.", the graphite process band 01–04, StatusBadge Pending → Approved, a StatCard-style figure, the approval chain.
- **Tone:** deadpan Series A parody, on brand (warm canvas, graphite band, Schwer orange, Archivo + Geist).
- **Share caption:** "We just closed our Series A. A for Approved."

## Angle

Give a 2026 internal ops portal the full 2016 Series A launch-video treatment, played completely straight. The punchline: the "round" is an approval and the launch is "internal use only."

## Storyboard

| #   | Time      | Scene              | On screen                                                                                                                                                                                                                  | Sound                                              |
| --- | --------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | 0.0–3.0   | **Hook**           | Warm canvas. Typed with an orange caret: "It's like Uber," / "but for _quotations_." ("quotations" in the keyword gradient, orange full stop)                                                                              | Ukulele strum (C), quiet key ticks                 |
| 2   | 3.0–6.5   | **Reveal**         | Logo bars rise one by one → eyebrow "INTRODUCING" → "Schwer Online Management" → headline "From costing to _collection_."                                                                                                  | Kick enters, glockenspiel motif                    |
| 3   | 6.5–10.5  | **Pipeline**       | Graphite band wipes up (orange leading edge). "Engineering costs it. / Sales closes it. / Executives approve it." Process rail 01 Costing → 02 Quotation → 03 Purchase order → 04 Collection lights up on the beat         | Whoosh; claps enter; rising glock C-E-G-C per step |
| 4   | 10.5–15.0 | **Approval chain** | Band wipes away. Quotation card ₱3,450,000.00, Pending. Cursor approves Sales manager, Executive; Owner row slides in ("≥ ₱3M"), gets approved; card badge flips to Approved. Left: "Over ₱3M? / The owner signs off too." | Soft clicks, in-key bell on each approve           |
| 5   | 15.0–18.0 | **₱100 ceiling**   | "UNIT SELLING PRICE" ₱7,562.79 rolls up to ₱7,600.00; old value floats up struck through. "Ceilinged to the nearest ₱100."                                                                                                 | Glock tick run                                     |
| 6   | 18.0–21.0 | **Series A**       | Band wipes up. "We just closed our Series A." Music holds on G (tension). "A for **Approved**." stamps in                                                                                                                  | Drop to held G swell → C hit + stamp               |
| 7   | 21.0–23.5 | **Outro**          | Logo, "Schwer Online Management", "Now available.", eyebrow "INTERNAL USE ONLY"                                                                                                                                            | Final C strum + glock arpeggio ring-out            |

Durations: 3.0 + 3.5 + 4.0 + 4.5 + 3.0 + 3.0 + 2.5 = 23.5s.

## Visual identity

Tokens from `app/globals.css`: canvas `hsl(25 22% 96.5%)`, foreground `hsl(0 0% 3.9%)`, primary `hsl(25 87% 40%)` (bright `25 90% 55%` on graphite), band `hsl(220 14% 20%)`, frame `hsl(25 35% 86%)`, status-pending `38 92% 34%`, status-approved `174 62% 28%` (`174 52% 48%` on graphite). Archivo for display and figures, Geist for UI text, Consolas mono for reference numbers. Keyword gradient `104deg foreground → primary`.

## Music

Self-synthesised at 120 BPM in C major (C–G–Am–F): Karplus-Strong ukulele island strum, glockenspiel, soft kick, claps, shared reverb. SFX are written in key on the same grid and mixed under the music.
