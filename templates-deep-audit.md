# Templates Feature Deep Audit

## Scope

This audit covers the WhatsApp template feature across the dashboard, analytics, rules, builders, previews, and API wrappers.

Relevant code paths:

- [frontend-wapi/app/dashboard/templates/page.jsx](frontend-wapi/app/dashboard/templates/page.jsx)
- [frontend-wapi/app/dashboard/templates/analytics/page.jsx](frontend-wapi/app/dashboard/templates/analytics/page.jsx)
- [frontend-wapi/app/dashboard/templates/rules/page.jsx](frontend-wapi/app/dashboard/templates/rules/page.jsx)
- [frontend-wapi/components/templates/TemplateManager.jsx](frontend-wapi/components/templates/TemplateManager.jsx)
- [frontend-wapi/components/templates/TemplateBuilder.jsx](frontend-wapi/components/templates/TemplateBuilder.jsx)
- [frontend-wapi/components/templates/TemplateStepBuilder.jsx](frontend-wapi/components/templates/TemplateStepBuilder.jsx)
- [frontend-wapi/components/templates/TemplateList.jsx](frontend-wapi/components/templates/TemplateList.jsx)
- [frontend-wapi/components/templates/TemplateRuleEditor.jsx](frontend-wapi/components/templates/TemplateRuleEditor.jsx)
- [frontend-wapi/components/templates/WhatsAppPreview.jsx](frontend-wapi/components/templates/WhatsAppPreview.jsx)
- [frontend-wapi/lib/api/templates.js](frontend-wapi/lib/api/templates.js)
- [frontend-wapi/lib/api/templateQuality.js](frontend-wapi/lib/api/templateQuality.js)

## Executive Summary

The template feature is usable, but it has several correctness and safety issues that will show up in normal workflows:

- rule edits are not reliably updated because the editor and save handler disagree on the rule ID field,
- analytics requests send raw `Date` objects and the export action never actually downloads a report,
- the WhatsApp preview renders unescaped HTML from template content,
- the dashboard search path can throw on malformed template records,
- the feature is split across multiple overlapping implementations, which increases drift and makes fixes inconsistent.

The highest-risk item is the preview HTML injection. The highest-likelihood product bug is the rule edit/update mismatch.

## Main Findings

### 1. Editing a template rule does not round-trip the rule ID correctly

The rule editor only includes `id` in the save payload when `rule?.id` is already present, but the rest of the feature works with backend objects that use `_id`. The save page then branches on `ruleData.id` to decide whether to update or create.

That means an edit can silently become a create, producing duplicate rules instead of updating the selected one.

Relevant code:
- [frontend-wapi/components/templates/TemplateRuleEditor.jsx](frontend-wapi/components/templates/TemplateRuleEditor.jsx#L67)
- [frontend-wapi/app/dashboard/templates/rules/page.jsx](frontend-wapi/app/dashboard/templates/rules/page.jsx#L73)

### 2. Analytics requests serialize `Date` objects instead of stable ISO strings

The analytics page builds `startDate` and `endDate` as JavaScript `Date` instances and passes them directly into the analytics API wrapper. `URLSearchParams` will stringify those objects using their default string form, which is not a reliable wire format for backend date filters.

The export action also stops at the toast. It calls the API, shows success, and leaves a `// Download logic here` placeholder. That means the button reports completion without actually delivering a file to the user.

Relevant code:
- [frontend-wapi/app/dashboard/templates/analytics/page.jsx](frontend-wapi/app/dashboard/templates/analytics/page.jsx#L31)
- [frontend-wapi/app/dashboard/templates/analytics/page.jsx](frontend-wapi/app/dashboard/templates/analytics/page.jsx#L57)

### 3. The WhatsApp preview is vulnerable to HTML injection and can misrender variables

The preview helper converts formatted message text into HTML and then injects it with `dangerouslySetInnerHTML` without escaping the original template content first. If a template body or header contains HTML-like content, it will be interpreted by the browser instead of displayed as text.

The placeholder replacement logic also replaces matches by occurrence order, not by variable number. That means repeated variables or non-sequential content can be rendered incorrectly even when the template data is otherwise valid.

Relevant code:
- [frontend-wapi/components/templates/WhatsAppPreview.jsx](frontend-wapi/components/templates/WhatsAppPreview.jsx#L29)
- [frontend-wapi/components/templates/WhatsAppPreview.jsx](frontend-wapi/components/templates/WhatsAppPreview.jsx#L110)
- [frontend-wapi/components/templates/WhatsAppPreview.jsx](frontend-wapi/components/templates/WhatsAppPreview.jsx#L180)

### 4. Dashboard filtering can crash on templates missing a name

The template dashboard filters with `t.name.toLowerCase()`. That assumes every record has a string `name`. If the backend returns a malformed legacy record, a partial deleted record, or any object without a `name`, the search path will throw as soon as a query is entered.

This is easy to harden with a null-safe guard and should be treated as a stability fix, not just a polish issue.

Relevant code:
- [frontend-wapi/app/dashboard/templates/page.jsx](frontend-wapi/app/dashboard/templates/page.jsx#L185)

### 5. The feature is split across overlapping manager implementations

There are two separate template manager implementations in the codebase: one in [frontend-wapi/components/templates/TemplateManager.jsx](frontend-wapi/components/templates/TemplateManager.jsx#L274) and another in [frontend-wapi/components/features/TemplateManager.jsx](frontend-wapi/components/features/TemplateManager.jsx#L14). The exported template component barrel points at the former through [frontend-wapi/components/templates/index.jsx](frontend-wapi/components/templates/index.jsx#L6).

This is not a single-line runtime bug, but it is a real maintenance risk. The two implementations already use different data shapes, different validation rules, and different UI behavior. Future fixes will keep landing in one branch and not the other unless the feature is consolidated.

## Secondary Risks

- Template list and builder components mix multiple template shapes (`body.text`, `components[0].text`, `bodyText`) across screens. That makes regressions likely when backend payloads evolve.
- The rules list and editor rely on paginated responses but do not enforce a single canonical response shape in the client wrappers.
- The analytics page currently reads like a dashboard skeleton rather than a complete export/reporting flow.

## Recommended Fix Order

1. Fix rule update identity first so edits do not create duplicates.
2. Replace raw `Date` query serialization with ISO strings and wire the export button to a real download path.
3. Escape template content before rendering preview HTML, then rework variable substitution to be number-based.
4. Harden the dashboard filter logic against missing fields.
5. Consolidate the duplicate template manager implementations into one source of truth.

## Fast Validation List

After the fixes, I would verify these flows manually:

- edit an existing rule and confirm the backend receives the original rule ID,
- open analytics for 7, 30, and 90 day ranges and confirm the backend receives ISO date filters,
- test preview rendering with plain text, formatted text, and variable placeholders,
- search templates when a record has a missing or empty name,
- confirm only one template manager remains wired into the app.
