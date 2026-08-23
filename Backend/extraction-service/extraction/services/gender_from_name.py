"""Best-effort gender inference from a Moroccan given name.

Fallback ONLY: the primary source of gender is the vision model reading the
card (see ``ollama_ocr.py``). Moroccan CIN cards have no explicit Latin "sex"
field, so when the model can't tell, we guess from the first name. This is
inherently imperfect (the user always verifies before saving) — the goal is a
sensible default, not certainty.

Strategy, in order:
    1. Exact match against small curated known-name sets (highest confidence).
    2. Common feminine/masculine spelling patterns (e.g. many Moroccan female
       names end in "a"/"â"; several male names end in specific suffixes).
Returns "Male", "Female", or "" (unknown) — never guesses wildly.

The name lists are intentionally small and easy to extend: add names as the
clinic sees them. This pairs with the correction-capture loop — names that get
corrected are exactly the ones worth adding here.
"""

# Lowercased, accent-normalized given names. Keep short; extend over time.
_FEMALE_NAMES = {
    "fatima", "fatima-zohra", "fatimazohra", "zohra", "yamina", "malika",
    "rabiaa", "khadija", "aicha", "aisha", "amina", "naima", "samira",
    "hafida", "rachida", "saida", "zineb", "hanane", "salma", "imane",
    "meryem", "maryam", "nadia", "houda", "loubna", "sanaa", "wafaa",
    "karima", "latifa", "najat", "souad", "bouchra", "hayat", "siham",
    "asmae", "asma", "kaoutar", "ikram", "hind", "dounia", "chaimae",
}

_MALE_NAMES = {
    "mohammed", "mohamed", "ahmed", "samir", "el milloud", "milloud",
    "abdellah", "abdelkader", "abdelaziz", "abderrahim", "abderrahmane",
    "hassan", "hussein", "youssef", "yassine", "omar", "khalid", "said",
    "rachid", "karim", "brahim", "ibrahim", "mustapha", "mostafa", "driss",
    "hamid", "aziz", "tarik", "tariq", "anas", "bilal", "hicham", "jamal",
    "nabil", "othmane", "reda", "soufiane", "zakaria", "adil", "amine",
}

# Female names that don't end in "a" but are clearly feminine, handled above.
# Male names that DO end in "a" (so the suffix heuristic must not misfire).
_MALE_ENDING_IN_A = {"zakaria", "yahya", "moussa", "issa", "hamza", "mostafa", "mustapha"}


def _normalize(name: str) -> str:
    return (
        name.strip().lower()
        .replace("é", "e").replace("è", "e").replace("ê", "e")
        .replace("à", "a").replace("â", "a").replace("î", "i")
        .replace("ô", "o").replace("û", "u").replace("ï", "i")
    )


def gender_from_name(first_name: str) -> str:
    """Infer "Male"/"Female" from a given name, or "" if unsure.

    Args:
        first_name: The given name as read off the card (may be multi-word,
            e.g. "FATIMA-ZOHRA").

    Returns:
        "Male", "Female", or "" (unknown).
    """
    if not first_name:
        return ""

    norm = _normalize(first_name)
    if not norm:
        return ""

    # Exact full-string match first (covers multi-word names).
    if norm in _FEMALE_NAMES:
        return "Female"
    if norm in _MALE_NAMES:
        return "Male"

    # Try the first token of a compound name (e.g. "FATIMA-ZOHRA" -> "fatima").
    first_token = norm.replace("-", " ").split()[0]
    if first_token in _FEMALE_NAMES:
        return "Female"
    if first_token in _MALE_NAMES:
        return "Male"

    # Spelling-pattern fallback: many Moroccan female names end in "a".
    if first_token in _MALE_ENDING_IN_A:
        return "Male"
    if first_token.endswith("a"):
        return "Female"

    return ""
