# ROCAA-323: DocAI API Research Report

**Date:** 2026-05-25
**Researcher:** Hermes Researcher (agent 1414a9de-73d4-4b68-b3d6-4b94ee8eec66)
**Issue:** RESEARCH: DocAI API capabilities + integration patterns

## Summary
Google Cloud Document AI (DocAI) provides OCR, form parsing, and entity extraction for documents like paystubs, W-2s, 1099s critical to mortgage underwriting and pipeline accuracy.

## 1. Authentication shape
- Google Cloud service account (JSON key) or Application Default Credentials (ADC)
- OAuth2 / JWT under the hood (via google-auth libraries)
- Project + location + processor ID required

## 2. Top 5 most useful endpoints for ROC use cases
1. POST /v1/projects/{project}/locations/{location}/processors/{processor}:process - Main document parsing (paystubs/W-2)
2. POST /v1/projects/{project}/locations/{location}/processors/{processor}:batchProcessDocuments - Bulk mortgage doc processing
3. GET /v1/projects/{project}/locations/{location}/processors - List available processors
4. POST /v1/projects/{project}/locations/{location}/processorTypes - (for custom training if needed)
5. Operations endpoints for long-running batch jobs

## 3. Rate limits + quota
- Per-project quotas (default ~120 QPM for online, higher for batch)
- Billable via Google Cloud (pay-per-page + storage)
- Strict but scalable with billing enabled

## 4. SDK availability
- Excellent official support:
  - Python: google-cloud-documentai
  - Node.js: @google-cloud/documentai
  - Shell: gcloud CLI + curl with auth tokens
- Full OpenAPI / gRPC support

## 5. Existing community MCPs or Claude skills
- Some LangChain integrations exist for Document AI
- No dedicated public MCP for mortgage-specific processors, but general Google Cloud MCPs available

## 6. Recommended adapter shape
- (a) Paperclip MCP - Strong recommendation for direct document parsing in mortgage flows
- Integrates well with existing DocAI/Blend mentions in ladder

## 7. Cost
- Pay-per-use: ~$1.50-$30 per 1000 pages depending on processor type + Google Cloud project costs
- No flat subscription required beyond GCP billing account

## 8. Canonical memory link
- Direct relevance to pipeline accuracy (DocAI/Blend). Closest memory likely under mortgage document processing or Google Cloud integrations.

## Ladder Confirmation
Directly ladders to ROCAA-306 via pipeline accuracy (DocAI/Blend). Core to mortgage doc automation.

## Next Actions
- Configure processor IDs in company secrets
- Implement MCP wrapper using official Python client
- Test on sample paystub/W-2 PDFs

**Status:** Research complete. Ready for review.