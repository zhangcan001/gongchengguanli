from zipfile import ZipFile

from app.backup import BackupService


def test_backup_service_creates_zip_and_excludes_backups(client):
    settings = client.app.state.settings
    data_dir = settings.data_dir
    (data_dir / "files" / "uploads" / "现场照片.txt").write_text("upload", encoding="utf-8")
    (data_dir / "logs" / "app.log").write_text("log", encoding="utf-8")
    (data_dir / "backups" / "old_backup.zip").write_text("old", encoding="utf-8")

    payload = BackupService(settings).create_backup()

    backup_path = data_dir / payload["relative_path"]
    assert backup_path.is_file()
    assert payload["file_size"] == backup_path.stat().st_size
    assert payload["included_file_count"] >= 2
    assert payload["excluded_dirs"] == ["backups"]

    with ZipFile(backup_path) as zip_file:
        names = set(zip_file.namelist())

    assert "files/uploads/现场照片.txt" in names
    assert "logs/app.log" in names
    assert not any(name.startswith("backups/") for name in names)
