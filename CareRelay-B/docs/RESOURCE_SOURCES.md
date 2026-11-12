# Resource registry verification
Checked November 1, 2026. Registry: backend/data/resources.json.
This verifies source descriptions only, not current capacity, individual eligibility, clinical suitability, service completion or a partnership. Review due January 30, 2027 is a local prototype freshness policy, not a provider's guarantee. After that date the planner fails closed until a person rechecks and updates the registry.

| Resource | Official evidence | What is encoded / limits |
| --- | --- | --- |
| UHN comprehensive ophthalmology | https://www.uhn.ca/Krembil/Clinics/Comprehensive_Ophthalmology and https://www.uhn.ca/Krembil/DKJ-Eye-Institute/Pages/clinics-and-services.aspx | Broad eye care and in-person clinic pathway. Exact clinic location, availability, language and accessibility are not assumed. The existing-referral gate is a conservative demonstration rule, NOT a quoted universal clinic eligibility policy. Amina's records do not establish this referral. |
| Ontario Health811 | https://www.ontario.ca/page/your-health and https://ontariohealth.ca/news/health811-resources-help-providers-support-patients-in-accessing | Remote nurse/navigation information, English/French and TTY support. Verification used official indexed search excerpts because the full pages returned HTTP 403 to the research tool. No unverified interpretation languages, appointment availability or patient eligibility are encoded. |
| College of Optometrists of Ontario register | https://collegeoptom.on.ca/public/ and https://collegeoptom.on.ca/cgcpt-quicklinks/find-an-optometrist/ | Official optometrist registration/directory lookup. No individual optometrist, accepted referral, capacity, fee coverage, language or accessibility is selected or asserted. |

The runtime performs NO web searches or calls. It reads this curated registry, checks review dates, jurisdiction, travel, explicit referral assumption, requested language/accessibility and phone access, then selects the first eligible option. Unknown requested capabilities fail closed. Fixed order is a demonstration policy, not clinical ranking. Remote navigation and directory lookup are not substitutes for an examination.

Source fields and limitations travel with API responses and reminder proposals. Registry changes produce a new digest so existing approvals cannot authorize a changed resource. A qualified clinical/resource review is still pending.

Calendar format reference: https://www.rfc-editor.org/info/rfc5545/
