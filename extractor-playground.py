from pathlib import Path
import os
import json
import statistics

import pymupdf


def extract_text_blocks(pdf_path: str) -> list[dict]:
    doc = pymupdf.open(pdf_path)
    blocks = []
    for page_num, page in enumerate(doc):
        for block in page.get_text("dict")["blocks"]:
            if block["type"] == 0:  # text block
                blocks.append(
                    {
                        "page_num": page_num + 1,
                        "bbox": block["bbox"],
                        "x0": block["bbox"][0],
                        "text": " ".join(
                            span["text"]
                            for line in block["lines"]
                            for span in line["spans"]
                        ),
                        "font_size": block["lines"][0]["spans"][0]["size"],
                        "is_bold": "Bold" in block["lines"][0]["spans"][0]["font"],
                    }
                )
    return blocks


def detect_headings(blocks: list[dict]) -> list[dict]:
    """
    Classify each block as a heading level (1, 2, 3) or None using only
    layout signals — no regex on text content, so it works across payer formats.
    """
    body_sizes = [
        b["font_size"] for b in blocks if not b["is_bold"] and b["text"].strip()
    ]
    body_median = statistics.median(body_sizes) if body_sizes else 10.0

    # x0 values of bold short blocks — used to bucket indentation levels
    candidate_x0s = [
        b["x0"] for b in blocks if b["is_bold"] and len(b["text"].strip()) < 120
    ]
    # Split into left / mid / right thirds to assign H1/H2/H3
    x0_sorted = sorted(set(round(x) for x in candidate_x0s))

    def x0_level(x0: float) -> int:
        if not x0_sorted:
            return 2
        # Blocks closest to the left margin are highest level
        percentile = x0_sorted.index(
            min(x0_sorted, key=lambda x: abs(x - round(x0)))
        ) / max(len(x0_sorted) - 1, 1)
        if percentile < 0.33:
            return 1
        elif percentile < 0.66:
            return 2
        else:
            return 3

    for block in blocks:
        text = block["text"].strip()
        if not block["is_bold"] or len(text) > 120 or not text:
            block["heading_level"] = None
            continue

        size_ratio = block["font_size"] / body_median

        if size_ratio >= 1.15:
            block["heading_level"] = 1
        else:
            # Same size as body but bold and short — use x0 to rank
            block["heading_level"] = x0_level(block["x0"])

    return blocks


def segment_sections(blocks: list[dict]) -> list[dict]:
    """
    Walk the heading-annotated blocks and group them into a flat section list.
    Each section has its heading, hierarchy level, start page, and raw content text.
    """
    sections: list[dict] = []
    current: dict = {
        "heading": "__preamble__",
        "level": 0,
        "page": 1,
        "content": [],
    }

    for block in blocks:
        if block.get("heading_level") is not None:
            sections.append(
                {**current, "content": "\n".join(current["content"]).strip()}
            )
            current = {
                "heading": block["text"].strip(),
                "level": block["heading_level"],
                "page": block["page_num"],
                "content": [],
            }
        else:
            text = block["text"].strip()
            if text:
                current["content"].append(text)

    sections.append({**current, "content": "\n".join(current["content"]).strip()})
    return prune_sections(sections)


def prune_sections(sections: list[dict]) -> list[dict]:
    return [
        s
        for s in sections
        if len(s["content"].strip()) > 30 and len(s["heading"].strip()) > 8
    ]


# import anthropic
#
# POLICY_RECORD_SCHEMA = {
#     "type": "object",
#     "properties": {
#         "drug_name": {"type": "string"},
#         "payer": {"type": "string"},
#         "program_type": {"type": "string"},
#         "effective_date": {"type": "string"},
#         "indications": {
#             "type": "array",
#             "items": {
#                 "type": "object",
#                 "properties": {
#                     "name": {"type": "string"},
#                     "initial_authorization": {
#                         "type": "object",
#                         "properties": {
#                             "criteria": {"type": "array", "items": {"type": "string"}},
#                             "authorization_duration": {"type": "string"},
#                             "required_prescriber_types": {"type": "array", "items": {"type": "string"}},
#                         },
#                         "required": ["criteria"],
#                     },
#                     "reauthorization": {
#                         "type": "object",
#                         "properties": {
#                             "criteria": {"type": "array", "items": {"type": "string"}},
#                             "authorization_duration": {"type": "string"},
#                             "required_prescriber_types": {"type": "array", "items": {"type": "string"}},
#                         },
#                         "required": ["criteria"],
#                     },
#                 },
#                 "required": ["name", "initial_authorization"],
#             },
#         },
#     },
#     "required": ["drug_name", "payer", "program_type", "effective_date", "indications"],
# }
#
#
# def extract_policy(section_text: str) -> dict:
#     client = anthropic.Anthropic()
#     response = client.messages.create(
#         model="claude-opus-4-6",
#         max_tokens=4096,
#         tools=[{
#             "name": "extract_policy_record",
#             "description": (
#                 "Extract structured coverage policy data from a payer prior authorization document. "
#                 "Capture every covered indication and all criteria exactly as stated."
#             ),
#             "input_schema": POLICY_RECORD_SCHEMA,
#         }],
#         tool_choice={"type": "tool", "name": "extract_policy_record"},
#         messages=[{
#             "role": "user",
#             "content": (
#                 "Extract structured coverage policy data from this PA criteria section.\n\n"
#                 f"Document section:\n{section_text}"
#             ),
#         }],
#     )
#     for block in response.content:
#         if block.type == "tool_use" and block.name == "extract_policy_record":
#             return block.input
#     raise ValueError("LLM did not return a tool_use block")


def main():
    input_dir = Path("./policy_data/")
    output_dir = Path("./outputs/rough_json/")
    output_dir.mkdir(exist_ok=True)

    for file in input_dir.iterdir():
        if file.is_file() and file.suffix.lower() == ".pdf":
            blocks = extract_text_blocks(f"{input_dir}/{file.name}")
            blocks = detect_headings(blocks)
            sections = segment_sections(blocks)

            output_file = output_dir / f"{file.stem}.json"

            with open(output_file, "w") as f:
                json.dump(sections, f, indent=2)

    # criteria_section = next(
    #     s for s in sections if "coverage criteria" in s["heading"].lower()
    # )
    # policy = extract_policy(criteria_section["content"])
    # with open("policy-record.json", "w") as f:
    #     json.dump(policy, f, indent=2)


if __name__ == "__main__":
    main()
