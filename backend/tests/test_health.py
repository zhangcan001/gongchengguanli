def test_health_returns_expected_payload(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "1.0-smart"}
