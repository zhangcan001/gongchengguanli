from tests.test_smart_inbox import create_project


def insert_batch_and_records(client, project_id: int, records: list[dict], *, data_date: str = "2026-05-26") -> int:
    settings = client.app.state.settings
    import sqlite3

    with sqlite3.connect(settings.database_path) as connection:
        connection.row_factory = sqlite3.Row
        cursor = connection.execute(
            """
            INSERT INTO import_batch (
                project_id, inbox_id, data_type, data_date, file_name, sheet_name,
                header_row_index, data_start_row_index, status, published_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (project_id, 1, "progress", data_date, "进度表.xlsx", "本周进度", 2, 3, "published"),
        )
        batch_id = int(cursor.lastrowid)
        for record in records:
            payload = {
                "project_id": project_id,
                "batch_id": batch_id,
                "data_date": record.get("data_date", data_date),
                "building": record.get("building"),
                "floor": record.get("floor"),
                "area": record.get("area"),
                "discipline": record.get("discipline"),
                "task_name": record.get("task_name", "测试任务"),
                "unit": record.get("unit"),
                "total_quantity": record.get("total_quantity"),
                "cumulative_quantity": record.get("cumulative_quantity"),
                "period_quantity": record.get("period_quantity"),
                "planned_percent": record.get("planned_percent"),
                "actual_percent": record.get("actual_percent"),
                "planned_start_date": record.get("planned_start_date"),
                "planned_finish_date": record.get("planned_finish_date"),
                "remark": record.get("remark"),
            }
            columns = ", ".join(payload)
            placeholders = ", ".join("?" for _ in payload)
            connection.execute(
                f"INSERT INTO progress_record ({columns}) VALUES ({placeholders})",
                tuple(payload.values()),
            )
        connection.commit()
    return batch_id


def test_progress_overview_returns_summary(client):
    project = create_project(client)
    insert_batch_and_records(
        client,
        project["id"],
        [
            {"building": "1#楼", "discipline": "土建", "planned_percent": 80, "actual_percent": 70},
            {"building": "2#楼", "discipline": "机电", "planned_percent": 60, "actual_percent": 75},
        ],
    )

    response = client.get(f"/api/progress/overview?project_id={project['id']}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["project_id"] == project["id"]
    assert payload["latest_data_date"] == "2026-05-26"
    assert payload["overall_actual_percent"] == 72.5
    assert payload["overall_planned_percent"] == 70
    assert payload["deviation"] == 2.5
    assert payload["delay_level"] == "normal_or_ahead"
    assert payload["latest_batch"]["file_name"] == "进度表.xlsx"


def test_missing_planned_percent_does_not_mark_delay(client):
    project = create_project(client)
    insert_batch_and_records(
        client,
        project["id"],
        [{"building": "1#楼", "discipline": "土建", "planned_percent": None, "actual_percent": 65}],
    )

    overview = client.get(f"/api/progress/overview?project_id={project['id']}").json()
    delay = client.get(f"/api/progress/delay-analysis?project_id={project['id']}").json()

    assert overview["overall_actual_percent"] == 65
    assert overview["overall_planned_percent"] is None
    assert overview["delay_level"] is None
    assert delay["delay_count"] == 0


def test_missing_actual_percent_sets_no_calculable_progress(client):
    project = create_project(client)
    insert_batch_and_records(
        client,
        project["id"],
        [{"building": "1#楼", "discipline": "土建", "planned_percent": 60, "actual_percent": None}],
    )

    response = client.get(f"/api/progress/overview?project_id={project['id']}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["overall_actual_percent"] is None
    assert payload["no_calculable_progress"] is True


def test_delay_levels_are_calculated_correctly(client):
    project = create_project(client)
    insert_batch_and_records(
        client,
        project["id"],
        [
            {"building": "1#楼", "discipline": "土建", "task_name": "正常", "planned_percent": 60, "actual_percent": 60},
            {"building": "1#楼", "discipline": "土建", "task_name": "轻微", "planned_percent": 60, "actual_percent": 55},
            {"building": "2#楼", "discipline": "机电", "task_name": "明显", "planned_percent": 70, "actual_percent": 55},
            {"building": "3#楼", "discipline": "幕墙", "task_name": "严重", "planned_percent": 90, "actual_percent": 60},
        ],
    )

    response = client.get(f"/api/progress/delay-analysis?project_id={project['id']}")

    assert response.status_code == 200
    payload = response.json()
    levels = {task["task_name"]: task["delay_level"] for task in payload["delayed_tasks"]}
    assert levels == {"轻微": "slight_delay", "明显": "obvious_delay", "严重": "serious_delay"}
    assert payload["delay_count"] == 3
    assert payload["serious_delay_count"] == 1


def test_building_and_discipline_summary_are_correct(client):
    project = create_project(client)
    insert_batch_and_records(
        client,
        project["id"],
        [
            {"building": "1#楼", "discipline": "土建", "planned_percent": 80, "actual_percent": 60},
            {"building": "1#楼", "discipline": "土建", "planned_percent": 60, "actual_percent": 80},
            {"building": "2#楼", "discipline": "机电", "planned_percent": 50, "actual_percent": 40},
        ],
    )

    payload = client.get(f"/api/progress/overview?project_id={project['id']}").json()
    buildings = {item["label"]: item for item in payload["building_summary"]}
    disciplines = {item["label"]: item for item in payload["discipline_summary"]}

    assert buildings["1#楼"]["actual_percent"] == 70
    assert buildings["1#楼"]["planned_percent"] == 70
    assert buildings["1#楼"]["record_count"] == 2
    assert buildings["2#楼"]["actual_percent"] == 40
    assert disciplines["土建"]["actual_percent"] == 70
    assert disciplines["机电"]["planned_percent"] == 50


def test_data_quality_reports_warnings_and_errors(client):
    project = create_project(client)
    insert_batch_and_records(
        client,
        project["id"],
        [
            {
                "building": "1#楼",
                "discipline": "土建",
                "task_name": "",
                "planned_percent": 120,
                "actual_percent": 135,
                "total_quantity": 100,
                "cumulative_quantity": 120,
            },
            {
                "building": "2#楼",
                "discipline": "机电",
                "task_name": "安装",
                "planned_percent": None,
                "actual_percent": None,
            },
        ],
    )

    response = client.get(f"/api/progress/data-quality?project_id={project['id']}")

    assert response.status_code == 200
    payload = response.json()
    warning_fields = {item["field"] for item in payload["warning_items"]}
    error_fields = {item["field"] for item in payload["error_items"]}
    assert {"planned_percent", "actual_percent"}.issubset(warning_fields)
    assert {"actual_percent", "planned_percent", "cumulative_quantity", "task_name"}.issubset(error_fields)
    assert payload["warning_count"] == len(payload["warning_items"])
    assert payload["error_count"] == len(payload["error_items"])
