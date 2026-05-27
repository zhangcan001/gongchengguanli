import { Download } from "lucide-react";

import { resolveApiUrl } from "../api";
import type { ExportFile } from "../types";

export function ExportResultCard({ file }: { file: ExportFile }) {
  const directoryPath = file.file_path.split(/[\\/]/).slice(0, -1).join("/") || "data/files/exports";
  const archiveDirectory = file.archive_path?.split(/[\\/]/).slice(0, -1).join("/");
  const downloadUrl = resolveApiUrl(file.download_url);
  return (
    <article className="export-result-card">
      <div>
        <span className="eyebrow">EXPORT READY</span>
        <strong>{file.original_file_name}</strong>
        <small>{file.file_path}</small>
        {file.archive_path && <small className="archive-path-note">文件已自动归档到：{file.archive_path}</small>}
      </div>
      <div className="export-result-actions">
        <a className="primary-button" href={downloadUrl} target="_blank" rel="noreferrer">
          <Download size={18} />
          打开文件
        </a>
        <span className="export-directory">目录：{archiveDirectory ?? directoryPath}</span>
      </div>
    </article>
  );
}
