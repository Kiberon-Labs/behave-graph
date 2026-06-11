/**
 * Use this on a subscription to the graph:save event to trigger a download of the graph JSON data. This is useful for users who want to keep a local backup of their graphs, or for debugging purposes.
 * @param filename
 * @param data
 */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
