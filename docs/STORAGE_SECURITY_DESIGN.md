# Storage security design (not yet implemented)

## Current state

The application currently has no implemented upload workflow or code references to Supabase Storage. The connected hosted Supabase project was inspected read-only and has zero Storage buckets and zero Storage RLS policies. This is an accurate unconfigured state, not a security failure to fix by creating a bucket speculatively.

**Decision: do not create a bucket or storage policy until a concrete upload feature is approved and its data purpose is defined.** Public shop discovery does not require Storage.

## Security invariants for any future upload feature

1. All buckets are private. Never make customer documents, receipts, identity documents, or merchant evidence publicly readable.
2. Do not accept a client-supplied shop ID as proof of authorization. Derive the authenticated user from the JWT and verify current shop ownership or an explicit participant relationship in database policy.
3. Use opaque object names and a fixed path convention. Do not place email addresses, phone numbers, customer names, UPI IDs, or other personal data in object paths.
4. Grant the minimum operation per actor and purpose. Upload, read, replace, and delete are separate decisions; do not grant broad bucket-wide CRUD.
5. Avoid overwriting objects that are evidence for financial ledger entries. Use immutable object keys and append a new version/reference instead of replacing evidence.
6. Validate file size and actual file content, not only the browser-supplied MIME type or extension. Restrict allowed formats to the exact feature requirement; reject executable, archive, and active-content formats unless specifically justified.
7. Do not store service-role credentials in browser code or public environment variables. Privileged server operations must remain server-side and narrowly scoped.
8. Keep object metadata linked to an authorized application record. Record uploader, purpose, object key, content type, byte size, checksum, and creation time where justified.
9. Define retention, deletion, and account-deactivation behavior before accepting personal documents. Do not cascade-delete financial evidence or silently remove records needed for audit.
10. Do not issue long-lived public URLs. If temporary access is required, create short-lived signed URLs only after checking the caller's access to the parent record.

## Proposed policy shape (design only; no SQL applied)

When an upload use-case is approved, create a private bucket dedicated to that purpose rather than one catch-all bucket. A future merchant-owned shop document path may use:

`<shop_uuid>/<opaque_object_uuid>.<approved_extension>`

Storage policies must verify that the first path segment identifies a shop whose `owner_id = auth.uid()` and whose status permits uploads. Read access must separately verify the intended audience. Customer uploads, if ever required, should use a separate purpose-specific bucket/path and verify the customer's active link to the relevant shop. Do not assume that being a shop customer grants access to another customer's files.

These are policy requirements, not executable SQL. The exact bucket name, size limit, MIME allow-list, read audience, and retention period must be derived from the feature specification before migration authoring.

## Required isolated tests before release

- Anonymous list/read/download denied.
- Authenticated unrelated user cannot list, read, upload, replace, or delete another merchant's objects.
- Merchant A cannot access Merchant B's objects even if they know the object key.
- Customer cannot access merchant-only documents or another customer's uploads.
- Authorized actors can perform only the operations required by the feature.
- Wrong path shape, inactive shop, oversized file, disallowed MIME type, mismatched file signature, and unauthorized overwrite are rejected.
- Signed URLs expire and cannot be minted by an unauthorized actor.
- Deactivation and retention behavior is tested without deleting immutable ledger history.
- Tests run against a disposable local Supabase stack; hosted Storage remains untouched until explicit approval.

## Release gate

Storage remains a release blocker only if the product adds an upload feature. If no uploads are required for the initial release, keep Storage disabled/unconfigured and document that the application does not accept file uploads. Do not add infrastructure without a product requirement.
