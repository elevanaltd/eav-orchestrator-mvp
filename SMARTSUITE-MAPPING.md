# SmartSuite ↔ Supabase Field Mappings

**Purpose:** Document exact field mappings between SmartSuite tables and Supabase schema
**Status:** 🔍 NEEDS VALIDATION - These mappings are based on initial assumptions and must be verified

## SmartSuite Configuration

**Workspace:** `s3qnmox1`
**Solution:** `68b6d66b33630eb365ae54cb` (EAV Projects - PRODUCTION)

### Base URL
```
https://app.smartsuite.com/api/v1
```

### Headers
```json
{
  "Authorization": "Token ${SMARTSUITE_API_TOKEN}",
  "ACCOUNT-ID": "s3qnmox1",
  "Content-Type": "application/json"
}
```

## Table Mappings

### Projects Table
**SmartSuite Table ID:** `68a8ff5237fde0bf797c05b3`
**Supabase Table:** `projects`

| Supabase Field | SmartSuite Field | Type | Notes |
|----------------|------------------|------|--------|
| `id` | `id` (record ID) | string | 24-char hex SmartSuite record ID |
| `title` | `title` | string | Project name |
| `due_date` | `projdue456` | date | ⚠️ VERIFY field code |
| `eav_code` | `eavcode` | string | ⚠️ VERIFY field code |
| `client_filter` | `client_filter` | string | ⚠️ VERIFY field code |
| `created_at` | `created_at` | datetime | Auto-generated |
| `updated_at` | `updated_at` | datetime | Auto-generated |

### Videos Table
**SmartSuite Table ID:** `68b2437a8f1755b055e0a124`
**Supabase Table:** `videos`

| Supabase Field | SmartSuite Field | Type | Notes |
|----------------|------------------|------|--------|
| `id` | `id` (record ID) | string | 24-char hex SmartSuite record ID |
| `project_id` | `projects_link` | linked record | ⚠️ VERIFY field code |
| `title` | `title` | string | Video name |
| `main_stream_status` | `main_status` | status | ⚠️ VERIFY field code |
| `vo_stream_status` | `vo_status` | status | ⚠️ VERIFY field code |
| `production_type` | `prodtype01` | single select | ⚠️ VERIFY field code |
| `created_at` | `created_at` | datetime | Auto-generated |
| `updated_at` | `updated_at` | datetime | Auto-generated |

## ⚠️ VALIDATION REQUIRED

**All field codes marked with ⚠️ need validation against actual SmartSuite data.**

### Validation Steps Needed:
1. ✅ Confirm SmartSuite API connection works
2. 🔍 Get actual table structure for Projects (`68a8ff5237fde0bf797c05b3`)
3. 🔍 Get actual table structure for Videos (`68b2437a8f1755b055e0a124`)
4. 🔍 Verify field codes match assumptions
5. 🔍 Check data types and formats
6. 🔍 Test sample record retrieval

### API Calls to Validate Structure:

#### Get Projects Table Structure
```bash
curl -X GET "https://app.smartsuite.com/api/v1/applications/68a8ff5237fde0bf797c05b3/" \
  -H "Authorization: Token ${SMARTSUITE_API_TOKEN}" \
  -H "ACCOUNT-ID: s3qnmox1"
```

#### Get Videos Table Structure
```bash
curl -X GET "https://app.smartsuite.com/api/v1/applications/68b2437a8f1755b055e0a124/" \
  -H "Authorization: Token ${SMARTSUITE_API_TOKEN}" \
  -H "ACCOUNT-ID: s3qnmox1"
```

#### Sample Projects Records
```bash
curl -X POST "https://app.smartsuite.com/api/v1/applications/68a8ff5237fde0bf797c05b3/records/list/" \
  -H "Authorization: Token ${SMARTSUITE_API_TOKEN}" \
  -H "ACCOUNT-ID: s3qnmox1" \
  -H "Content-Type: application/json" \
  --data '{"limit": 2}'
```

#### Sample Videos Records
```bash
curl -X POST "https://app.smartsuite.com/api/v1/applications/68b2437a8f1755b055e0a124/records/list/" \
  -H "Authorization: Token ${SMARTSUITE_API_TOKEN}" \
  -H "ACCOUNT-ID: s3qnmox1" \
  -H "Content-Type: application/json" \
  --data '{"limit": 2}'
```

## Once Validated

After confirming actual field structures, this document will be updated with:
- ✅ Verified field codes
- ✅ Correct data types and formats
- ✅ Sample data transformations
- ✅ API endpoints that work
- ✅ Error handling patterns

## Integration Strategy

1. **One-way sync only**: SmartSuite → Supabase
2. **Manual trigger**: No automatic sync initially
3. **Component sync**: Supabase → SmartSuite (components only)
4. **Error handling**: Log all mapping failures
5. **Validation**: Verify data integrity on every sync