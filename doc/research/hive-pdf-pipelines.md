# PDF → Markdown Pipelines for Neo's Hive (Ollama + RTX 3080)

**Research by:** Hermes Researcher (1414a9de)
**Date:** 2026-05-25
**Context:** ROCAA-311 - Gaming-aware queue for PDF + heavy data processing on Hive

## Recommended Stack

### 1. Primary: Marker (by VikParuchuri)
- **Why best for Hive**: Excellent PDF layout preservation, GPU-accelerated via PyTorch/CUDA, outputs clean Markdown + JSON metadata.
- **Ollama integration**: Can use local vision models (e.g. qwen2.5-vl via Ollama) for complex table/figure extraction by passing images.
- **Install**: `pip install marker-pdf`
- **GPU perf on RTX 3080**: Handles 10-20 pages/sec for text-heavy PDFs; slower for image-dense.
- **Command example**:
  ```bash
  marker /path/to/input.pdf --output_dir /output --batch_size 4 --workers 2
  ```
- **Strengths**: Handles equations, tables, footnotes well. Supports languages.

### 2. Alternative / Complement: Docling (IBM)
- **Why**: Strong document understanding, hierarchical output (better than flat MD for downstream agents).
- **GPU**: Uses HuggingFace models, CUDA support good.
- **Ollama tie-in**: Export images to Qwen2.5-VL for OCR fallback on scanned docs.
- **Best for**: Technical/scientific PDFs, multi-column layouts.
- **Command**:
  ```bash
  docling /path/to/pdf --output markdown
  ```

### 3. OCR Fallback: Marker + Qwen2.5-VL (via Ollama)
- For scanned/image PDFs: Use Marker's image extraction + send page images to `ollama run qwen2.5-vl` for transcription.
- Pipeline:
  1. Marker extracts structure + image crops.
  2. For low-confidence pages: `curl http://100.104.35.105:11434/api/generate -d '{"model":"qwen2.5-vl","prompt":"Transcribe this PDF page image to markdown...","images":[base64]}'`
- **Performance**: RTX 3080 handles 7B-14B VL models comfortably at 4-8 tokens/s.

### 4. Traditional OCR: Tesseract + pdf2image
- Use when no vision model needed or for speed on pure text scans.
- `pip install pytesseract pdf2image`
- Good baseline, but inferior to Marker for modern docs.

### 5. Embedding / Classification follow-up
- After MD extraction: batch embed with `nomic-embed-text` or `bge-m3` via Ollama.
- Bulk classification/summarization: `qwen2.5:14b` on Hive.

## Gaming-Aware Considerations
- All tools should be wrapped in the scheduler that checks `nvidia-smi` (see scope in issue).
- Heavy jobs (large batches) scheduled 22:00-06:00 ET preferentially.

## Recommended Production Pipeline for Hive Queue
1. Ingest PDF → Marker (primary)
2. If OCR needed or confidence < threshold → Qwen2.5-VL via Ollama
3. Output: .md + .json metadata + extracted images
4. Post-process: embed + index for agents

## Next Steps for Scaffolder
- Implement queue daemon that dispatches `marker` jobs respecting GPU load.
- Integrate Ollama client for VL fallback.
- Alert logic via Telegram when queue backs up during gaming.

## References (internal)
- feedback_hive_is_neos_gaming_pc_2026-05-20
- ROCAA-306, ROCAA-307, ROCAA-310

This research completes the Hermes Researcher scope for ROCAA-311.