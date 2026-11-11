import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { reportFilename, type ChannelSnapshot } from "./channel-analytics";

export async function exportChannelReport(snapshot: ChannelSnapshot, generatedAt: Date) {
  if (!await Sharing.isAvailableAsync()) throw new Error("ამ მოწყობილობაზე ფაილის შენახვის ფანჯარა მიუწვდომელია.");
  // Load the renderer only when exporting, keeping other screens lightweight.
  const { createChannelReport } = await import("./channel-report");
  const bytes = await createChannelReport(snapshot, generatedAt);
  // Android may resolve its chooser before the receiving app has read the URI.
  // Keep this export in cache and remove only our expired reports on later exports.
  const expiresBefore = Date.now() - 24 * 3600_000;
  try {
    for (const old of Paths.cache.list()) {
      if (old instanceof File && /^Hungryman-Analytics-.*\.pdf$/.test(old.name) && old.modificationTime !== null && old.modificationTime < expiresBefore) old.delete();
    }
  } catch { /* Cache housekeeping must not prevent a fresh export. */ }
  const file = new File(Paths.cache, reportFilename(generatedAt));
  file.create({ overwrite: true });
  await file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "ანალიტიკის PDF-ის შენახვა" });
}
