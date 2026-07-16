from phase7_human_loop.triggers import _extract_rupee_amount, _mentions_cancellation


def test_extract_rupee_amount_with_symbol():
    assert _extract_rupee_amount("I spent ₹7500 at Croma") == 7500


def test_extract_rupee_amount_with_comma_and_rs_prefix():
    assert _extract_rupee_amount("Rs. 12,500 flight booking") == 12500


def test_extract_rupee_amount_with_rupees_suffix():
    assert _extract_rupee_amount("paid 6000 rupees for a laptop bag") == 6000


def test_extract_rupee_amount_returns_largest_when_multiple():
    assert _extract_rupee_amount("₹200 tip on a ₹9000 dinner") == 9000


def test_extract_rupee_amount_returns_none_when_absent():
    assert _extract_rupee_amount("what card should I use for groceries") is None


def test_mentions_cancellation_true():
    assert _mentions_cancellation("You should consider cancelling this Netflix subscription") is True


def test_mentions_cancellation_case_insensitive():
    assert _mentions_cancellation("CANCEL your Cult.fit membership") is True


def test_mentions_cancellation_false():
    assert _mentions_cancellation("Netflix is good value, keep it") is False
