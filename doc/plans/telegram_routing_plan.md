# Telegram Routing Policy (ROC-2869)

## Routing Rules
- Emergency: System Down, Security Breach, Repeated Failed Attempts (3+) -> Telegram (Dwizy)
- Routine/Informational: New Lead, Onboarding Status, Doc Status, Reports -> GHL, Slack, Email (rmgsales@ccm.com)

## Classification Plan

| Module | Signal Type | Target |
| :--- | :--- | :--- |
| leadTeamAlerts | New Lead Notification | Email/Slack |
| docChaseService | HITL Approvals/SMS | Chris/Gerard/GHL |
| MasterOrchestrator | Summary Reports | Slack/Email |
| partnerSmsApproval | Partner Approvals | GHL/Slack |
| partnerOnboarding | Onboarding Status | Email |
| positiveResponseBot | Bot Response | Silent/Log |
| loanIntakeOrchestrator| Intake Memos | GHL |
| circuitBreaker | Critical Infra Failure | Telegram |
| webhooks | Non-critical alerts | Slack |
| agents/CronScheduler| Cron Failures | Email/System Log |

