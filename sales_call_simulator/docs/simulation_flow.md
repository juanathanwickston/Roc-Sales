# ROC Sales Process: Simulation Flow & Curriculum Mapping
## Reference Guide for LMS Course & Simulator Alignment

This document outlines the workflow and division of information between the **LMS Text Modules (1–3, 6)** and the **Live AI Simulations (4–5)**. It serves as a master blueprint to ensure the curriculum and the simulator function as a cohesive training experience.

---

## 1. Overview of the 6-Stage Journey

| Stage / Module | Format | Rep Activity (LMS / Simulator) | Buyer Start State & Behavior |
|---|---|---|---|
| **Stage 1: Identify the Customer** | **LMS Text Reading** | Learns ICP, suspects vs. prospects, and CHAMP/BANT qualification frameworks. | *No simulation.* |
| **Stage 2: Ask for the Appointment** | **LMS Text Reading** | Learns pre-call prep, elevator pitches, and how to schedule the discovery call. | *No simulation.* |
| **Stage 3: Prep for the Appointment** | **LMS Text Reading** | Receives the merchant's **Known Information** and drafts GAP-model questions. | *No simulation.* |
| **Stage 4: Make the Sale** | **Live AI Simulation** | Conducts first-contact **Discovery Call** to qualify the merchant and book a follow-up. | **First Contact:** Expects a scheduled 10-minute call, is highly skeptical, gates hidden pain points. |
| **Stage 5: Close the Sale** | **Live AI Simulation** | Conducts **Closing Call**, demonstrates the solution, handles price, and secures contract. | **Follow-up:** Remembers Call 1 notes, expects tailored value/ROI, raises final objections before signing. |
| **Stage 6: Ask for the Referral** | **LMS Text Reading** | Learns how to request introductions after the sale is complete. | *No simulation (optional post-close trigger).* |

---

## 2. Phase 1: LMS Preparation (Modules 1–3)
During this phase, the sales rep only consumes educational text and static scenarios within the LMS. They receive the base data they need to prepare for the live call.

*   **LMS Module 1 (Identify):** Rep reads the profile of the target business (e.g., QuickStop Market, 6 employees, located in Michigan). They study why this business fits the ICP and qualify it from a "Suspect" to a "Lead."
*   **LMS Module 2 (Ask for Appointment):** Rep reads the backstory of how they contacted the owner, handled initial resistance, and booked a 10-minute slot on Wednesday before the owner's evening rush.
*   **LMS Module 3 (Prep):** Rep is given the merchant's **Known Information** (e.g., tight margins, older POS, rising credit card fees). Using this data, the rep writes down open-ended, reflective discovery questions using the **GAP Model** (Current Situation vs. Desired Situation).

---

## 3. Phase 2: Live AI Simulations (Modules 4 & 5)
This is where the interactive training takes place. The simulator takes over, and the AI buyer enforces the context established in the LMS.

### Stage 4: Make the Sale (Simulator Call 1 - Discovery)
*   **Handoff Point:** Picks up immediately at the start of the scheduled 10-minute Wednesday appointment.
*   **Rep Objective:** Conduct a CHAMP discovery interview, uncover hidden pain points, qualify the prospect, and secure a commitment for a follow-up closing call.
*   **AI Buyer Behavior:** 
    *   Opens with a time-constrained greeting (e.g., *"I have about 10 minutes..."*).
    *   Enforces first-contact boundaries (objects if the rep acts familiar).
    *   **Gating:** Withholds deeper operational issues (manual pricing errors, EBT/age verification compliance warnings) until the rep asks targeted, earned discovery questions.
    *   **Close:** Agrees to a follow-up meeting only if the rep uncovers significant challenges and closes confidently for the appointment.

### Stage 5: Close the Sale (Simulator Call 2 - Closing)
*   **Handoff Point:** Picks up at the start of the scheduled follow-up meeting.
*   **Rep Objective:** Link product features (e.g., Bodega AI) to the needs uncovered in Call 1, handle final objections (pricing, transition downtime), and close the sale.
*   **AI Buyer Behavior:**
    *   Remembers the specific facts/challenges shared in Call 1 (via server-side continuity context injection).
    *   Expresses frustration if the rep asks basic questions already covered in the first call.
    *   Raises realistic final objections (*"What is this going to cost me?"*, *"My staff won't use it"*, or *"How long is my lane down during setup?"*).
    *   Signs the contract only if the rep references prior pain, shows clear ROI, explains the transition, and asks directly for the business.

---

## 4. Information Architecture: Who Knows What?

To maintain the integrity of the roleplay, information is strictly partitioned:

```
[ LMS Modules 1-3 Readings ]
       │
       ▼ (Rep learns only these facts)
┌──────────────────────────────────────────────┐
│            KNOWN INFORMATION                 │
│ - Business profile, location, employee count │
│ - Surface operational complaints             │
│ - The fact that a call is scheduled          │
└──────────────────────────────────────────────┘
       │
       ▼ (Rep uses this to call the AI)
[ Simulator Call 1 (Stage 4) ] <─────────────── [ AI Scenario JSON Config ]
                                                      │
                                                      ▼ (AI protects these facts)
                                               ┌──────────────────────────────┐
                                               │      GATED INFORMATION       │
                                               │ - Manual workflows & leakage │
                                               │ - Compliance audit warnings  │
                                               │ - Specific objection logic   │
                                               └──────────────────────────────┘
                                                      │
                                                      ▼ (Only revealed if rep asks
                                                         good discovery questions)
                                               [ Deep Discovery Unlocked ]
```
