# Security Specification: STLAF Liaison Ops

## Data Invariants
1. **Operational Entries** must always belong to the user who created them (`userId`).
2. **Status Transitions**: Users can only edit entries in `Draft` or `Ongoing` status for general fields. Once `Submitted`, `Approved`, or `Rejected`, fields are locked from user modification.
3. **Admin Rights**: Only users with `role: 'admin'` in their user profile document can list all entries and change statuses (Approved/Rejected).
4. **Validation**: All amounts must be positive numbers. All document IDs must be valid.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempting to create an entry with a `userId` that isn't the logged-in user.
2. **Ghost Field Injection**: Adding an `isAdmin: true` field to an `OperationalEntry`.
3. **Draft Bypass**: Trying to update a `Submitted` entry to `Draft` to edit locked fields.
4. **Approval Forgery**: A regular user trying to update an entry status to `Approved`.
5. **PII Exposure**: A regular user trying to `get` another user's profile which contains sensitive info (handled via split or restricted read).
6. **Negative Value Poisoning**: Setting `requestedCashAdvance` to `-100`.
7. **Resource Exhaustion**: Sending a description string that is 1MB in size.
8. **ID Poisoning**: Using a 2KB string for a liquidation item ID.
9. **Relational Orphan**: Creating a liquidation item without an associated `OperationalEntry` (not possible with array-based storage in blueprint, but check reference integrity).
10. **Admin Escalation**: Regular user trying to update their own `role` to `admin`.
11. **Metadata Tampering**: Regular user trying to set a fake `createdAt` timestamp.
12. **Query Scraping**: Attempting to list ALL `operational_entries` without a user filter (handled by rule-side resource check).

## Test Runner (Conceptual)
All "Dirty Dozen" payloads should return `PERMISSION_DENIED`.
