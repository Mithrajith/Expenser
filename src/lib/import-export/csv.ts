export function jsonToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((header) => {
        const val = row[header] ?? "";
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export function csvToJson(csvString: string): Record<string, string>[] {
  const lines = csvString.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  const result: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i];
    // Simple regex matching quoted fields or standard comma fields
    const values = currentLine.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || currentLine.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      let val = values[index] ? values[index].trim() : "";
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1).replace(/""/g, '"');
      }
      obj[header] = val;
    });
    result.push(obj);
  }

  return result;
}
