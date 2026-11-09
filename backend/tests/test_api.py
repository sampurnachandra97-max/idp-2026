import pytest

from app.rules import INDICATORS

SAMPLE = {
    "pH": 6.78,
    "EC": 0.25,
    "N": 179,
    "P": 7.93,
    "K": 256,
    "temperature": 25,
    "humidity": 80,
    "rainfall": 200,
}


def analyze(client, **changes):
    response = client.post("/api/analyze", json={**SAMPLE, **changes})
    assert response.status_code == 200
    return response.json()


def test_analyze_returns_every_indicator(client):
    body = analyze(client)
    keys = {r["key"] for r in body["measured"] + body["estimated"]}
    assert keys == set(INDICATORS)
    assert body["summary"]["total"] == 12


def test_estimates_bracket_their_value_and_are_not_negative(client):
    for estimate in analyze(client)["estimated"]:
        assert 0 <= estimate["low"] <= estimate["value"] <= estimate["high"]


def test_measured_values_are_echoed_not_modelled(client):
    measured = {r["key"]: r["value"] for r in analyze(client)["measured"]}
    assert measured == {key: SAMPLE[key] for key in measured}


def test_crops_are_ranked_and_fit_is_a_probability(client):
    crops = analyze(client)["crops"]
    fits = [crop["fit"] for crop in crops]
    assert len(crops) == 5
    assert fits == sorted(fits, reverse=True)
    assert all(0 <= fit <= 1 for fit in fits)


def test_measured_deficiency_produces_action(client):
    actions = analyze(client)["actions"]
    phosphorus = next(a for a in actions if a["key"] == "P")
    assert phosphorus["source"] == "measured" and phosphorus["level"] == "act"


def test_severe_problems_are_listed_before_mild_ones(client):
    levels = [a["level"] for a in analyze(client, pH=5.9)["actions"]]
    assert levels.index("act") < levels.index("watch")


def test_adequate_borderline_estimate_never_prescribes_treatment(client):
    actions = [a for a in analyze(client)["actions"] if a["level"] == "ok"]
    assert actions and all(a["confirm_first"] and "lab result" in a["action"] for a in actions)


def test_out_of_training_range_input_warns(client):
    assert any("K 900" in w for w in analyze(client, K=900)["warnings"])
    assert analyze(client)["warnings"] == []


@pytest.mark.parametrize("field,value", [("pH", 15), ("humidity", -1), ("N", -5)])
def test_impossible_values_are_rejected(client, field, value):
    response = client.post("/api/analyze", json={**SAMPLE, field: value})
    assert response.status_code == 422


def test_model_card_documents_grouped_evaluation(client):
    card = client.get("/api/model-card").json()
    assert card["soil"]["fields"] < card["soil"]["samples"]
    assert {row["target"] for row in card["soil"]["targets"]} == {
        "OC", "S", "Zn", "B", "Fe", "Mn", "Cu",
    }
