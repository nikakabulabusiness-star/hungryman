import type { WorkVideoDetail } from "./work-model";
import type { WorkExportFormat, WorkExportPhoto } from "./work-export";

/** Capture a single revision before async photo fetching so a refresh cannot mix project versions. */
export async function shareWorkDetail(detail: WorkVideoDetail, format: WorkExportFormat): Promise<void> {
  const snapshot: WorkVideoDetail = JSON.parse(JSON.stringify(detail));
  const generatedAt = new Date();
  const [{ File, Paths }, Sharing, exports] = await Promise.all([
    import("expo-file-system"), import("expo-sharing"), import("./work-export"),
  ]);
  if (!await Sharing.isAvailableAsync()) throw new Error("ამ მოწყობილობაზე ფაილის შენახვის ფანჯარა მიუწვდომელია.");
  let data: string | Uint8Array;
  if (format === "json") data = JSON.stringify(exports.workExportPayload(snapshot, generatedAt), null, 2);
  else if (format === "csv") data = exports.workBudgetCsv(snapshot);
  else {
    const { workPhotoSource } = await import("./api");
    const ids = exports.workPhotoIds(snapshot.video), photos: WorkExportPhoto[] = [];
    let position = 0, bytesLoaded = 0;
    // Two requests at once avoid flooding mobile connections. Bound image memory; every omitted photo is labeled in the PDF.
    const fetchNext = async () => {
      while (position < ids.length) {
        const id = ids[position++];
        if (bytesLoaded >= 32 * 1024 * 1024) { photos.push({ id, unavailableReason: "PDF-ის ფოტოების მოცულობის ზღვარი მიღწეულია. ორიგინალი იხილეთ პროექტის ფაილებში." }); continue; }
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
        try {
          const source = workPhotoSource(id);
          const response = await fetch(source.uri, { headers: source.headers, signal: controller.signal });
          if (!response.ok) throw new Error("photo unavailable");
          const mime = response.headers.get("content-type")?.split(";")[0] || "";
          if (!/^image\/(png|jpeg)$/.test(mime) || Number(response.headers.get("content-length") || 0) > 6 * 1024 * 1024) throw new Error("unsupported photo");
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.length > 6 * 1024 * 1024 || bytesLoaded + bytes.length > 32 * 1024 * 1024) throw new Error("photo too large");
          bytesLoaded += bytes.length; photos.push({ id, bytes, mime });
        } catch { photos.push({ id, unavailableReason: "ფოტო ვერ ჩაიტვირთა. ორიგინალი იხილეთ პროექტის ფაილებში." }); }
        finally { clearTimeout(timer); }
      }
    };
    await Promise.all([fetchNext(), fetchNext()]);
    data = await exports.createWorkReport(snapshot, generatedAt, photos);
  }
  // Keep the file after Android's chooser resolves, since the destination may read its URI later.
  const expiresBefore = Date.now() - 24 * 3600_000;
  try {
    for (const old of Paths.cache.list()) {
      if (old instanceof File && /^Hungryman-Work-.*\.(pdf|json|csv)$/.test(old.name) && old.modificationTime !== null && old.modificationTime < expiresBefore) old.delete();
    }
  } catch { /* Housekeeping must not prevent a fresh export. */ }
  const file = new File(Paths.cache, exports.workExportFilename(snapshot.video, format, generatedAt));
  file.create({ overwrite: true });
  await file.write(data);
  const types = { pdf: { mimeType: "application/pdf", UTI: "com.adobe.pdf" }, json: { mimeType: "application/json", UTI: "public.json" }, csv: { mimeType: "text/csv", UTI: "public.comma-separated-values-text" } };
  await Sharing.shareAsync(file.uri, { ...types[format], dialogTitle: "პროექტის შენახვა / გაზიარება" });
}
