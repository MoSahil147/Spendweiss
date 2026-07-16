from phase6_multiagent.subscription_hunter import find_recurring_charges
from phase6_multiagent.supervisor import _normalise_classification


def test_find_recurring_charges_finds_netflix():
    recurring = find_recurring_charges()
    netflix = next(entry for entry in recurring if entry["merchant"] == "Netflix")
    assert netflix["occurrences"] == 5
    assert netflix["category"] == "other"


def test_find_recurring_charges_finds_cultfit():
    recurring = find_recurring_charges()
    cultfit = next(entry for entry in recurring if entry["merchant"] == "Cult.fit")
    assert cultfit["occurrences"] == 3


def test_find_recurring_charges_excludes_single_occurrence_merchants():
    # DMart appears exactly once in the mock data (2026-05-19), so it must
    # not show up in the recurring list at all, unlike Netflix or Cult.fit.
    recurring = find_recurring_charges()
    merchants = {entry["merchant"] for entry in recurring}
    assert "DMart" not in merchants


def test_normalise_classification_passes_through_valid_values():
    assert _normalise_classification("card_optimizer") == "card_optimizer"
    assert _normalise_classification("subscription_hunter") == "subscription_hunter"
    assert _normalise_classification("both") == "both"


def test_normalise_classification_falls_back_to_card_optimizer():
    assert _normalise_classification("") == "card_optimizer"
    assert _normalise_classification("garbage") == "card_optimizer"
