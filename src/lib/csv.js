// Export what is on screen as a CSV that opens cleanly in Excel (UTF-8 with BOM, formula-safe cells).
export function toCsv(columns, rows) {
  const cell = value => '"' + String(value ?? '').replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""') + '"';
  return [columns.map(column => column.label), ...rows.map(row => columns.map(column => typeof column.value === 'function' ? column.value(row) : row[column.value]))]
    .map(line => line.map(cell).join(',')).join('\r\n');
}

export function downloadCsv(name, columns, rows) {
  const url = URL.createObjectURL(new Blob(['﻿' + toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: `${name}.csv` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
