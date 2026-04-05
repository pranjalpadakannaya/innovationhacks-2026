"""
Diff engine: compares two extracted PolicyRecord dicts and returns a list of
ChangeEntry dicts ready to insert into policy_changelogs.
"""
from datetime import date, datetime, timezone


# ── Severity helpers ──────────────────────────────────────────────────────────

_HIGH_CRITERION_TYPES = {"step_therapy", "combination_restriction"}


def _severity_for_criterion(criterion: dict) -> str:
    if criterion.get("criterion_type") in _HIGH_CRITERION_TYPES:
        return "HIGH"
    return "MED"


# ── Summary generators ────────────────────────────────────────────────────────

def _fmt(indication_name: str, detail: str) -> str:
    return f"{indication_name}: {detail}" if indication_name else detail


# ── Auth block diff helper ────────────────────────────────────────────────────

def _diff_auth_block(
    old_auth: dict,
    new_auth: dict,
    ind_name: str,
    auth_phase: str,
    entry_fn,
) -> list[dict]:
    """Diff criteria and duration within one auth block (initial or reauth)."""
    result: list[dict] = []

    old_crit = {c["description"]: c for c in (old_auth.get("criteria") or [])}
    new_crit = {c["description"]: c for c in (new_auth.get("criteria") or [])}

    for desc, crit in new_crit.items():
        if desc not in old_crit:
            sev = _severity_for_criterion(crit)
            ctype = (
                "ADDED_STEP_THERAPY"
                if crit.get("criterion_type") == "step_therapy"
                else "ADDED_CRITERION"
            )
            result.append(entry_fn(
                ctype, sev,
                _fmt(ind_name, f"New criterion added: {desc[:120]}"),
                criterion_type=crit.get("criterion_type"),
                auth_phase=auth_phase,
            ))

    for desc, crit in old_crit.items():
        if desc not in new_crit:
            result.append(entry_fn(
                "REMOVED_CRITERION", "MED",
                _fmt(ind_name, f"Criterion removed: {desc[:120]}"),
                criterion_type=crit.get("criterion_type"),
                auth_phase=auth_phase,
            ))

    old_dur = old_auth.get("authorization_duration_months")
    new_dur = new_auth.get("authorization_duration_months")
    if old_dur is not None and new_dur is not None and old_dur != new_dur:
        result.append(entry_fn(
            "MODIFIED_THRESHOLD", "MED",
            _fmt(ind_name, f"Authorization duration changed: {old_dur} months → {new_dur} months"),
            before_text=str(old_dur),
            after_text=str(new_dur),
            auth_phase=auth_phase,
        ))

    return result


# ── Main diff function ────────────────────────────────────────────────────────

def diff_policy_records(
    old: dict,
    new: dict,
    payer: str,
    drug: str,
    drug_id: str,
) -> list[dict]:
    """
    Compare two PolicyRecord dicts and return a list of changelog entry dicts.

    Args:
        old: previous policy_record dict from MongoDB
        new: freshly extracted policy_record dict
        payer: payer canonical name
        drug: human-readable drug string, e.g. "Dupixent (dupilumab)"
        drug_id: normalized drug id, e.g. "dupilumab"

    Returns:
        list of dicts matching the ChangeEntry shape
    """
    changes: list[dict] = []
    today = date.today().isoformat()
    now = datetime.now(timezone.utc)

    def entry(
        change_type: str,
        severity: str,
        summary: str,
        *,
        criterion_type: str | None = None,
        before_text: str | None = None,
        after_text: str | None = None,
        auth_phase: str | None = None,
    ) -> dict:
        result: dict = {
            "severity": severity,
            "payer": payer,
            "drug": drug,
            "drug_id": drug_id,
            "change_type": change_type,
            "summary": summary,
            "date": today,
            "logged_at": now,
        }
        if criterion_type is not None:
            result["criterion_type"] = criterion_type
        if before_text is not None:
            result["before_text"] = before_text
        if after_text is not None:
            result["after_text"] = after_text
        if auth_phase is not None:
            result["auth_phase"] = auth_phase
        return result

    old_inds: dict[str, dict] = {
        i["name"]: i for i in (old.get("indications") or []) if i.get("name")
    }
    new_inds: dict[str, dict] = {
        i["name"]: i for i in (new.get("indications") or []) if i.get("name")
    }

    # ── Added / removed indications ───────────────────────────────────────────
    for name in new_inds:
        if name not in old_inds:
            changes.append(entry("ADDED_INDICATION", "HIGH", f"New indication added: {name}"))

    for name in old_inds:
        if name not in new_inds:
            changes.append(entry("REMOVED_INDICATION", "HIGH", f"Indication removed: {name}"))

    # ── Per-indication diffs ──────────────────────────────────────────────────
    for name in new_inds:
        if name not in old_inds:
            continue  # already captured as ADDED_INDICATION above

        old_ind = old_inds[name]
        new_ind = new_inds[name]

        # PA required changed
        old_pa = old_ind.get("pa_required")
        new_pa = new_ind.get("pa_required")
        if old_pa is not None and new_pa is not None and old_pa != new_pa:
            direction = "added" if new_pa else "removed"
            changes.append(entry(
                "MODIFIED_PA_REQUIRED", "HIGH",
                _fmt(name, f"Prior authorization {direction}"),
            ))

        # Step therapy changed
        old_st = old_ind.get("step_therapy_required")
        new_st = new_ind.get("step_therapy_required")
        if old_st is not None and new_st is not None and old_st != new_st:
            if new_st:
                changes.append(entry(
                    "ADDED_STEP_THERAPY", "HIGH",
                    _fmt(name, "Step therapy requirement added"),
                    criterion_type="step_therapy",
                    auth_phase="initial",
                ))
            else:
                changes.append(entry(
                    "REMOVED_CRITERION", "MED",
                    _fmt(name, "Step therapy requirement removed"),
                    criterion_type="step_therapy",
                    auth_phase="initial",
                ))

        # Initial authorization criteria + duration
        old_auth = old_ind.get("initial_authorization") or {}
        new_auth = new_ind.get("initial_authorization") or {}
        changes.extend(_diff_auth_block(old_auth, new_auth, name, "initial", entry))

        # Reauthorization criteria + duration
        old_reauth = old_ind.get("reauthorization") or {}
        new_reauth = new_ind.get("reauthorization") or {}
        if old_reauth or new_reauth:
            changes.extend(_diff_auth_block(old_reauth, new_reauth, name, "reauth", entry))

    # ── Effective date / wording-only changes ─────────────────────────────────
    old_eff = (old.get("payer") or {}).get("effective_date")
    new_eff = (new.get("payer") or {}).get("effective_date")
    if old_eff and new_eff and old_eff != new_eff and not changes:
        changes.append(entry(
            "MODIFIED_WORDING", "LOW",
            f"Effective date updated: {old_eff} → {new_eff}. No clinical criteria changes detected.",
        ))

    return changes
