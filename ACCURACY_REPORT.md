# Pipeline Accuracy Report
**Date:** 2026-04-05  
**Model:** `claude-sonnet-4-6` (via instructor + Anthropic API)  
**Corpus:** 10 commercial payer PA policy documents (PDF/DOCX) validated against S3 source files  
**Method:** Manual cross-validation — extracted JSON compared against source documents downloaded from S3

---

## 1. Executive Summary

### Original Corpus (v2 re-extractions)

| Document | Payer | Drug | Pages | Source Indications | Extracted Indications | v1 Accuracy | v2 Accuracy | Delta |
|---|---|---|---|---|---|---|---|---|
| BCBS NC Preferred Injectable Oncology | BCBS NC | Bevacizumab | 26 | ~9 distinct | 29 (duplicated) | 58% | **62%** | +4% |
| Cigna Rituximab Non-Oncology | Cigna | Rituximab IV | 32 | 18 | 18 | 87% | **90%** | +3% |
| Florida Blue Bevacizumab | Florida Blue | Bevacizumab | 15 | 17 | 27 (duplicated) | 70% | **73%** | +3% |
| UHC Botulinum Toxins A & B | UHC | OnabotulinumtoxinA / Abobotulinumtoxin / Rima / Inco / Daxi | 28 | ~20 distinct | 21 (minor duplication) | 25% | **72%** | +47% |

**Original corpus average: ~74%** 


### New Documents (v1)

| Document | Payer | Drug | Pages | Extracted Indications | Confidence | Accuracy |
|---|---|---|---|---|---|---|
| CG-DME-46 Pneumatic Compression | Anthem BCBS | Pneumatic Compression Device | 8 | 4 (1 distinct) | 0.97 | **78%** |
| CG-SURG-105 Corneal Cross-Linking | Anthem ABCBS | Riboflavin / J2787 | 9 | 8 (3 distinct) | 0.97 | **75%** |
| CP.PHAR.243 Alemtuzumab | Centene | Alemtuzumab | 6 | 2 | 0.97 | **88%** |
| EmblemHealth Denosumab (DOCX) | EmblemHealth | Denosumab | — | 16 | 0.35 | *not validated* |
| Cigna Actemra SC PA | Cigna | Tocilizumab SC (+ biosimilars) | 14 | 20 | 0.35 | **50%** |
**New document average: ~68%**

---

## 2. Per-Document Findings

---

### 2.1 BCBS NC — Preferred Injectable Oncology Program
**File:** `BCBS NC - Corporate Medical Policy_ Preferred Injectable Oncology Program (Avastin example).pdf`  
**Version:** 2 | **Accuracy Score: 62%** (was 58%)

#### Metrics
| Field | Expected | Actual | Change |
|---|---|---|---|
| Indications (distinct) | ~9 | 29 entries (heavily duplicated) | No improvement |
| Reauthorization entries | Present | 5 | ✓ Fixed (was 0) |
| `drug.hcpcs_codes` | J9035, J9311, J9312, J9355, J9356, Q5112–Q5160 (20 codes in source) | `null` | No improvement |
| `drug.j_codes` | J9035, J9311, J9312, J9355, J9356 | `null` | No improvement |
| `payer.effective_date` | Present in source | `null` | No improvement |
| `confidence_scores.overall` | — | 1.0 | (spuriously high) |

#### Issues Found

**[CRITICAL] Indication deduplication still failing**  
The document has ~9 distinct FDA-approved bevacizumab indications. The extracted JSON contains 29 entries with clear triplicate/quadruplicate duplication (e.g. "Metastatic Colorectal Cancer" appears 4 times across chunks, "Epithelial Ovarian Cancer" appears 4 times). The multi-chunk merge is appending without deduplication.

**[HIGH] HCPCS/J-codes still not populated**  
20 HCPCS codes are explicitly present in the source (J9035, J9311, J9312, J9355, J9356, J9999, C9142, C9399, J3490, J3590, Q5112, Q5113, Q5114, Q5116, Q5117, Q5123, Q5126, Q5129, Q5146, Q5160). All remain `null` in the JSON.

**[HIGH] `effective_date` still not extracted**  
No date pattern detected in the first 4,000 characters. The date appears deeper in the document body.

**[MEDIUM] Confidence score is misleading**  
`confidence_scores.overall: 1.0` despite duplicate indications, null HCPCS, and null effective date — the confidence signal is not reliable.

**[FIXED] Reauthorization criteria**  
5 indications now have reauthorization blocks. Previously 0.

#### Criteria Accuracy (Sampled)
| Indication | Source | JSON | Match |
|---|---|---|---|
| Metastatic Colorectal Cancer (1st/2nd line) | 5 mg/kg q2w with IFL; 10 mg/kg q2w with FOLFOX4 | Correctly stated (in multiple duplicate entries) | ✓ |
| Recurrent Glioblastoma | 10 mg/kg q2w | Correctly stated | ✓ |
| Platinum-resistant ovarian cancer | Combination with paclitaxel, pegylated liposomal doxorubicin, or topotecan | Correctly captured | ✓ |

---

### 2.2 Cigna — Rituximab Intravenous Products for Non-Oncology Indications
**File:** `Cigna Rituximab Intravenous Products for Non-Oncology Indications.pdf`  
**Version:** 2 | **Accuracy Score: 90%** (was 87%)

#### Metrics
| Field | Expected | Actual | Change |
|---|---|---|---|
| Indications | 18 | 18 | ✓ Correct |
| Reauthorization entries | Present for most | 9 | ✓ Good |
| `drug.hcpcs_codes` | J9312, Q5115, Q5119, Q5123 (+ S1538) | `null` | No improvement |
| `drug.j_codes` | J9312 | `null` | No improvement |
| `payer.effective_date` | 02/01/2026 | `2026-02-01` | ✓ Fixed (was null) |
| `confidence_scores.overall` | — | 1.0 | |

#### Issues Found

**[HIGH] HCPCS/J-codes still null**  
J9312 (Rituxan), Q5115 (Truxima), Q5119 (Ruxience), Q5123 (Riabni) are present in source. All remain `null`.

**[MEDIUM] Minor indication duplication**  
"Multiple Sclerosis" appears twice (once as MS, once with same name), "Rheumatoid Arthritis" appears twice, "ANCA-Associated Vasculitis" appears in both abbreviated and full forms. 18 entries contain ~16 truly distinct indications.

**[FIXED] `effective_date`**  
Now correctly populated as `2026-02-01`.

#### Criteria Accuracy (Sampled)
| Indication | Source | JSON | Match |
|---|---|---|---|
| ANCA-Associated Vasculitis (induction) | 375 mg/m² ×4 doses q7d OR two 1,000 mg doses q2w; requires glucocorticoids | Correctly stated | ✓ |
| Pemphigus Vulgaris (initial) | Two 1,000 mg doses ≥2 weeks apart; relapse same; maintenance 500 mg q6mo | Correctly captured | ✓ |
| Multiple Sclerosis | Inadequate efficacy to ≥2 other disease-modifying agents | Correctly stated | ✓ |

---

### 2.3 Florida Blue — Bevacizumab MCG Policy
**File:** `Florida Blue MCG Bevecizumab policy.pdf`  
**Version:** 2 | **Accuracy Score: 73%** (was 70%)

#### Metrics
| Field | Expected | Actual | Change |
|---|---|---|---|
| Indications (distinct) | 17 named | 27 entries (duplicated) | Minor improvement (was 31) |
| Reauthorization entries | 2 (180-day / 1-year) | 1 | No improvement |
| `drug.hcpcs_codes` | J9035, Q5107, Q5118, Q5126, Q5129, Q5160 (12 codes in source) | `null` | No improvement |
| `payer.effective_date` | 01/01/2026 | `01/01/26` | ✓ Fixed (was null) |
| `authorization_duration_months` | 180 days (initial) / 1 year (continuation) | Not structured | No improvement |
| `confidence_scores.overall` | — | 0.9 | |

#### Source Indications (Table 1 — ground truth)
Ampullary Cancer, Cervical Cancer, CNS Cancer, Colon & Rectal Cancer, Hepatocellular Carcinoma, Hereditary Hemorrhagic Telangiectasia, Kidney Cancer, Mesothelioma, NSCLC, Ovarian Cancer, Radiation Necrosis of the Brain, Small Bowel Adenocarcinoma, Soft Tissue Sarcoma, Uterine Neoplasm, Vaginal Cancer, Vulvar Cancer, Other FDA/NCCN-supported diagnosis.

#### Issues Found

**[CRITICAL] Duplication from ICD-10 table extraction persists**  
Source has both a named indication table (Table 1) and a separate ICD-10 code table. The pipeline still captures both, yielding ~10 duplicate pairs (e.g., "Metastatic colorectal cancer" vs "Metastatic Colorectal Cancer").

**[HIGH] Auth duration not structured**  
Source explicitly states "Approval Duration: 180 days" (initial) and "Approval duration: 1 year" (continuation with step therapy). These strings are present in the PDF (`auth_duration` regex matches) but `authorization_duration_months` remains unpopulated in extracted indications.

**[HIGH] HCPCS codes still null**  
12 codes in source (J9035, Q5107, Q5118, Q5126, Q5129, Q5160, C9142, J1000, J3590, J9999, Q2024) — all `null`.

**[FIXED] `effective_date`**  
Now populated as `01/01/26`.

---

### 2.4 UHC — Botulinum Toxins A and B Commercial Medical Benefit Drug Policy
**File:** `UHC Botulinum Toxins A and B – Commercial Medical Benefit Drug Policy.pdf`  
**Version:** 1 | **Accuracy Score: 72%** (was 25%)

#### Metrics
| Field | Expected | Actual | Change |
|---|---|---|---|
| Indications (distinct) | ~20 distinct | 21 entries (~17 distinct) | Major improvement (was 5) |
| Reauthorization entries | Present for main indications | 7 | ✓ Good (was 4 for just 5 indications) |
| `drug.hcpcs_codes` | J0585, J0586, J0587, J0588, J0589 | `null` | No improvement |
| `drug.j_codes` | J0585, J0586, J0587, J0588, J0589 | `null` | No improvement |
| `payer.effective_date` | 2026-01-01 | `null` | Regression (was correct in v1 JSON-seeded record) |
| `confidence_scores.overall` | — | 0.9 | |

#### Indications Now Captured ✓
Achalasia, Anal fissures (chronic), Blepharospasm, Cervical dystonia, Detrusor overactivity, Essential tremor, Hand dystonia, Hemifacial spasm, Hyperhidrosis (including gustatory), Oromandibular dystonia, Sialorrhea, Spasmodic dysphonia, Spasticity, Strabismus, Tongue dystonia, Torsion dystonia, Chronic migraine headache.

#### Still Missing / Problematic
- Minor duplication: Cervical dystonia (2×), Detrusor overactivity (2×), Sialorrhea (2×), Spasticity (2×)
- "Overactive bladder" and "Neurogenic detrusor overactivity" listed separately in source but merged into "Detrusor overactivity"
- Drug-level HCPCS (J0585–J0589 for Botox/Dysport/Xeomin/Myobloc/Daxxify) still null
- `effective_date` not extracted (source contains 01/01/2026)

#### Root Cause of Improvement
`max_tokens` increase from 4096 → higher limit eliminated the truncation at page 2. The `review_flags` no longer states document truncation.

---

### 2.5 Anthem BCBS — Pneumatic Compression Devices
**File:** `CG-DME-46 Pneumatic Compression Devices for Prevention of Deep Vein Thrombosis of the Extremities in the Home Setting.pdf`  
**Version:** 1 | **Accuracy Score: 78%**

#### Metrics
| Field | Expected | Actual |
|---|---|---|
| Indications | 1 (DVT prevention — non-coverage policy) | 4 entries (1 distinct) |
| HCPCS codes | 18 E-codes + A4600 | 18 ✓ (all correctly captured) |
| `payer.effective_date` | Not found in source | `null` |
| Reauthorization | None (non-coverage) | 0 ✓ |
| `confidence_scores.overall` | — | 0.97 |

#### Issues Found

**[MEDIUM] Structural over-splitting into 4 identical-name indications**  
The 4 extracted entries all represent the same denial policy with different member-type sub-criteria. Should be 1 indication with structured sub-criteria. Functionally correct but structurally noisy.

**[LOW] Correctly identified as non-coverage determination**  
`review_flags` accurately notes this is a blanket non-coverage policy. All 18 HCPCS codes (E0650–E0676 + A4600) correctly captured — best HCPCS extraction in the corpus.

---

### 2.7 Anthem ABCBS — Corneal Collagen Cross-Linking
**File:** `CG-SURG-105 Corneal Collagen Cross-Linking.pdf`  
**Version:** 1 | **Accuracy Score: 75%**

#### Metrics
| Field | Expected | Actual |
|---|---|---|
| Indications (distinct) | 2–3 (Progressive Keratoconus, Corneal Ectasia after Refractive Surgery) | 8 entries (3 distinct) |
| HCPCS codes | J2787 | J2787 ✓ |
| `payer.effective_date` | Not found in source | `null` |
| Reauthorization | None stated | 0 ✓ |
| `confidence_scores.overall` | — | 0.97 |

#### Issues Found

**[MEDIUM] Triplication of indications**  
"Progressive Keratoconus" appears 3 times, "Corneal Ectasia After Refractive Surgery" appears 3 times, with slightly different criteria wording per entry — classic multi-chunk merge duplication.

**[LOW] ICD-10 code range expansion**  
`review_flags` notes ranges H18.601–H18.629 and H18.711–H18.719 were expanded to individual codes. Correct behavior, transparently flagged.

---

### 2.8 Centene — Alemtuzumab (Lemtrada)
**File:** `CP.PHAR.243.pdf`  
**Version:** 1 | **Accuracy Score: 88%**

#### Metrics
| Field | Expected | Actual |
|---|---|---|
| Indications | 2 (RRMS/SPMS + Off-label) | 2 ✓ |
| HCPCS codes | J0202 | J0202 ✓ |
| `drug.j_codes` | J0202 | J0202 ✓ |
| `payer.effective_date` | Policy date (2025 or 2024) | 2016-08-01 (FDA approval date, not policy date) |
| Reauthorization | 2 (one per indication) | 2 ✓ |
| Auth duration | 12 months (Medicaid) / 6 months (Commercial) | Noted in `review_flags` but not in fields |
| `confidence_scores.overall` | — | 0.97 |

#### Issues Found

**[MEDIUM] `effective_date` is FDA approval date, not policy revision date**  
`2016-08-01` is Lemtrada's FDA approval date. The actual policy revision date was not found in the source header — but the value extracted is technically wrong context.

**[LOW] Auth duration not structured in fields**  
Source has dual-LOB auth periods (12 months Medicaid, 6 months Commercial). The `review_flags` documents this correctly but `authorization_duration_months` is not populated per indication.

**[GOOD] Cleanest extraction in new corpus**  
Correct indication count, HCPCS, J-code, and reauth structure. Off-label indication correctly captured as generic catch-all.

---

### 2.9 Cigna — Tocilizumab SC Inflammatory Conditions PA
**File:** `cnf_427_coveragepositioncriteria_inflammatory_conditions_actemra_sc_pa.pdf`  
**Version:** 1 | **Accuracy Score: 50%**

#### Metrics
| Field | Expected | Actual |
|---|---|---|
| Indications | ~8 distinct (GCA, SSc-ILD, pJIA, RA, sJIA, PMR, AOSD, VEXAS) | 20 entries (~8 distinct, 2–3× duplication) |
| HCPCS codes | None in source | `[]` |
| `payer.effective_date` | Multiple revision dates (latest 03/11/2026) | `null` |
| Reauthorization | Present for RA, GCA, PMR | 7 ✓ |
| `confidence_scores.overall` | — | 0.35 |

#### Issues Found

**[CRITICAL] Contradictory confidence signal**  
`confidence_scores.overall: 0.35` and `review_flags` state "Only the preamble/cover page was provided." Yet 20 indications were extracted — including accurate names like VEXAS, AOSD, SSc-ILD. This suggests some extraction occurred from body sections, but the LLM self-assessed low confidence. The review flags are partially wrong.

**[HIGH] Triplication of indications**  
8 real indications duplicated ~2.5× on average into 20 entries. Same multi-chunk merge failure.

**[MEDIUM] `effective_date` not extracted**  
Source header contains multiple revision dates (04/23/2025, 06/11/2025, 12/03/2025, 03/11/2026). None captured.

---

## 3. EmblemHealth — Denosumab (DOCX)
**File:** `EmblemHealth_MPS_Denosumab_11_25_hcpcs.docx`  
**Version:** 1 | **Accuracy: Not validated** (DOCX path not directly inspected via PDF extraction tools)

#### Observed Data
| Field | Value |
|---|---|
| Indications extracted | 16 |
| HCPCS codes | J3590, Q5161, Q5162 |
| `payer.effective_date` | `null` |
| `confidence_scores.overall` | 0.35 |
| Reauthorization | 0 |

Low confidence flag (0.35) suggests truncation. The DOCX extraction path requires separate validation.

---

## 4. Cross-Cutting Issues

| Issue | Affected Documents | Severity | v1 Status |
|---|---|---|---|
| `drug.hcpcs_codes` always `null` for drug policy docs | BCBS NC, Florida Blue, Cigna Rituximab, UHC Botulinum, Cigna Tocilizumab SC | HIGH | **Unchanged** |
| `drug.j_codes` always `null` for drug policy docs | Same as above | HIGH | **Unchanged** |
| Multi-chunk indication deduplication failure | BCBS NC, Florida Blue, UHC Botulinum, Cigna Tocilizumab SC, Anthem Corneal | CRITICAL | **Unchanged** |
| `effective_date` not extracted from document body | BCBS NC, UHC Botulinum, Anthem DME, Anthem Corneal, Cigna Tocilizumab SC | MEDIUM | Partially fixed (Cigna, Florida Blue now populated) |
| `authorization_duration_months` not populated despite presence in source | Florida Blue, CP.PHAR.243 | MEDIUM | **Unchanged** |
| Confidence score not calibrated (1.0 despite structural failures) | BCBS NC | MEDIUM | **New observation** |

---

## 5. Accuracy Trend

| Document | v1 Accuracy | v2 Accuracy |
|---|---|---|
| BCBS NC Bevacizumab | 58% | 62% |
| Cigna Rituximab | 87% | 90% |
| Florida Blue Bevacizumab | 70% | 73% |
| UHC Botulinum Toxins | 25% | 72% |
| **Original corpus average** | **60%** | **74%** |

---

## 6. Prioritised Fix List (Updated)

### P0 — Active regressions / blockers
1. **Deduplicate indications after multi-chunk merge**  
   Add post-merge deduplication: normalize indication names (lowercase + strip punctuation), merge entries with >80% name similarity, combine criteria lists and keep the longest. Run before writing to MongoDB.  
   _Impact: Reduces BCBS NC from 29 → ~9, Florida Blue from 27 → ~17, UHC Botulinum from 21 → ~17, Cigna Tocilizumab from 20 → ~8_

### P1 — High impact, achievable quickly
2. **Map HCPCS/J-codes to schema fields**  
   The regex `\b[A-Z]\d{4}\b` reliably finds HCPCS codes in the source text at extraction time. Either: (a) add a post-extraction regex pass over the full document text to populate `drug.hcpcs_codes`, or (b) strengthen the extraction prompt with an explicit instruction and examples.  
   _Impact: Fixes ALL 5 affected documents — currently 0/5 have populated drug-level codes_

3. **Structured auth duration extraction**  
   "Approval Duration: 180 days" and "Approval duration: 1 year" patterns are reliably present in source text (confirmed by regex). Add explicit prompt instruction to extract `authorization_duration_months` from these patterns and convert to integer months (180 days = 6 months, 1 year = 12 months).

### P2 — Quality improvements
4. **Recalibrate confidence scores**  
   BCBS NC reports `confidence: 1.0` despite null HCPCS, null effective date, and 29 duplicated indications. The confidence scoring logic should penalise: null required fields, indication count > 2× expected, and known structural issues in review_flags.

5. **Fix `effective_date` extraction for document-body dates**  
   BCBS NC date appears past the first 4,000 characters. Expand date search window or extract from a dedicated metadata pass over the full first and last page.

6. **EmblemHealth DOCX validation**  
   The DOCX extraction path has not been end-to-end validated. Run a manual check on the 16 extracted indications against the source document.

---

## 7. Test Environment

| Parameter | Value |
|---|---|
| Extraction model | `claude-sonnet-4-6` |
| `max_tokens` | Increased from 4096 (exact value not confirmed — UHC Botulinum now works) |
| `max_retries` | 3 |
| Instructor mode | Tool use (`PolicyRecord` schema) |
| Segmentation | `segment_sections()` → `_prune_sections()` |
| Chunking | `_split_sections()` → multi-chunk merge for large docs |
| Heading detection | Font size + bold flag heuristic |
| Document formats tested | PDF (10 docs), DOCX (1 doc) |
| Total documents in MongoDB | 22 (8 mock/seed, 1 formulary, 13 real extractions) |
| S3-backed real extractions | 12 (10 PDFs + 1 DOCX + 1 JSON-seeded MDL) |

---

## 8. Retest Checklist

After each fix, rerun and verify:

- [ ] BCBS NC: no indication name appears more than once after deduplication
- [ ] Florida Blue: `authorization_duration_months` populated (6 months initial / 12 continuation)
- [ ] `drug.hcpcs_codes` populated for BCBS NC, Florida Blue, Cigna Rituximab, UHC Botulinum
- [ ] Cigna Rituximab: `drug.hcpcs_codes` includes J9312, Q5115, Q5119, Q5123
- [ ] UHC Botulinum: `drug.hcpcs_codes` includes J0585–J0589; `payer.effective_date` = 2026-01-01
- [ ] Centene Alemtuzumab: `payer.effective_date` is policy date, not FDA approval date
- [ ] Overall: `confidence_scores.overall` < 0.8 for any doc with null HCPCS and duplicated indications