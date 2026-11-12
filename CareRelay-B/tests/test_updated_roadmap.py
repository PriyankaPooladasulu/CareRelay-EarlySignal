from datetime import date

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "updated.sqlite3")) as c:
        yield c


def input_note(text, supplied=None):
    r = {"id":"header-test","title":"Synthetic dated note","text":text,"synthetic":True}
    if supplied is not None:
        r["date"] = supplied
    return r


@pytest.mark.parametrize("header", [
    "October 3, 2026", "3 October 2026", "2026-10-03",
    "Date: October 3, 2026", "Encounter date: 2026-10-03",
    "Visit date: 3 Oct 2026",
])
def test_extract_date_header_and_original_offsets(client, header):
    text = header + "\nRetinal examination recommended."
    result = client.post("/api/cases/amina/analyze",json={"records":[input_note(text)]})
    assert result.status_code == 200, result.text
    data = result.json()
    assert len(data["events"]) == 1
    event = data["events"][0]
    assert event["date"] == "2026-10-03"
    assert event["date_provenance"]["origin"] == "source_header"
    dp = event["date_provenance"]
    assert text[dp["start"]:dp["end"]] == dp["quote"]
    ev = event["evidence"]
    assert text[ev["start"]:ev["end"]] == "Retinal examination recommended."
    assert data["records"][0]["date_provenance"] == dp


@pytest.mark.parametrize("supplied", ["October 3, 2026","3 October 2026","03 Oct 2026","2026-10-03"])
def test_normalize_supplied_date(client, supplied):
    result = client.post("/api/cases/amina/analyze",json={"records":[input_note("Retinal examination recommended.",supplied)]})
    assert result.status_code == 200
    assert result.json()["events"][0]["date"] == "2026-10-03"
    assert result.json()["events"][0]["date_provenance"]["origin"] == "supplied_metadata"


@pytest.mark.parametrize("text,supplied", [
    ("Retinal examination recommended.",None),
    ("Date: 03/10/2026\nRetinal examination recommended.",None),
    ("Date: February 30, 2026\nRetinal examination recommended.",None),
    ("Date: October 3, 2026\nRetinal examination recommended.","2026-10-13"),
    ("Date: October 3, 2026\nVisit date: October 4, 2026\nRetinal examination recommended.",None),
    ("Examination planned for October 3, 2026.",None),
    ("Retinal examination recommended.","03/10/2026"),
    ("Retinal examination recommended.","2026-10-03T00:00:00"),
])
def test_uncertain_or_conflicting_date_is_rejected_and_prior_analysis_preserved(client,text,supplied):
    initial = client.post("/api/cases/amina/analyze",json={}).json()
    response = client.post("/api/cases/amina/analyze",json={"records":[input_note(text,supplied)]})
    assert response.status_code == 422
    assert client.get("/api/cases/amina/timeline").json()["revision"] == initial["revision"]


def test_matching_metadata_and_header(client):
    r=input_note("Date: October 3, 2026\nRetinal examination recommended.","2026-10-03")
    event=client.post("/api/cases/amina/analyze",json={"records":[r]}).json()["events"][0]
    assert event["date_provenance"]["origin"] == "metadata_and_header"


def test_header_does_not_destroy_source_quote(client):
    text="Retinal\nDate: October 3, 2026\nexamination recommended."
    result=client.post("/api/cases/amina/analyze",json={"records":[input_note(text)]})
    assert result.status_code == 200
    assert result.json()["events"] == []


def test_validator_does_not_save_untrusted_candidates(client):
    request = {"events":[
        {"source_id":"visit1","date":"2026-10-03","kind":"instruction","concept":"retinal_exam","quote":"Retinal examination recommended."},
        {"source_id":"visit3","date":"2026-10-24","kind":"completion","concept":"retinal_exam","quote":"Retinal examination completed."},
    ]}
    before = client.get("/api/cases/amina").json()
    response = client.post("/api/cases/amina/validate",json=request)
    assert response.status_code == 200
    result = response.json()
    assert len(result["events"]) == 1 and len(result["rejected"]) == 1
    assert result["saved"] is False
    assert client.get("/api/cases/amina").json() == before
    assert client.get("/api/cases/amina/timeline").status_code == 409


def test_validator_uses_current_originals(client):
    client.post("/api/cases/amina/analyze",json={"records":[input_note("Retinal examination not completed.","2026-10-30")]})
    result=client.post("/api/cases/amina/validate",json={"events":[
        {"source_id":"visit1","date":"2026-10-03","kind":"instruction","concept":"retinal_exam","quote":"Retinal examination recommended."}
    ]}).json()
    assert not result["events"]
    assert result["rejected"][0]["reason"] == "unknown_source"


def test_provenance_cannot_be_injected(client):
    r=input_note("Retinal examination recommended.","2026-10-03")
    r["date_provenance"]={"origin":"source_header","quote":"fake"}
    assert client.post("/api/cases/amina/analyze",json={"records":[r]}).status_code == 422


def test_header_provenance_survives_reloading_and_restart(tmp_path):
    db=tmp_path/"provenance.sqlite3"
    with TestClient(create_app(db)) as c:
        result=c.post("/api/cases/amina/analyze",json={"records":[input_note("Date: October 3, 2026\nRetinal examination recommended.")]}).json()
    with TestClient(create_app(db)) as c:
        loaded=c.get("/api/cases/amina/timeline").json()
        assert loaded["events"] == result["events"]
        assert loaded["events"][0]["date_provenance"]["origin"] == "source_header"
        assert c.get("/api/cases/amina/records/header-test").json()["date_provenance"]["origin"] == "source_header"
