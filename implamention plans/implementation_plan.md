# Implement Date-Based Filtering in Transactions Tab

This plan outlines the steps to introduce date-based filtering for both the transaction log and top-level metrics in the Admin Dashboard's Transactions tab.

## Open Questions

> [!IMPORTANT]  
> **Metrics Filtering Logic**: How should the date filter apply to the top-level metrics ("Active Subscribers", "Projected MRR") since they are based on the User model rather than the Transaction model? 
> 
> *Recommendation*: Apply the date filter to **Total Donated** (transaction creation date) and **Total Registered Donors** (user registration date), but leave **Active Subscribers** and **Projected MRR** as all-time/current active numbers, as they represent the ongoing subscription state rather than an event that occurred within a time window. If you'd prefer to filter them by the date the subscription was *started*, let me know!

## Proposed Changes

---

### Backend API Updates

#### [MODIFY] [adminTransactionController.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/admin/adminTransactionController.js)
Update both `getTransactions` and `getMetrics` to handle optional `start_date` and `end_date` query parameters.

**`getTransactions`**:
- Parse `req.query.start_date` and `req.query.end_date`.
- Append a `createdAt` filter to the `where` clause: `where.createdAt = { gte: new Date(start_date), lte: new Date(end_date) }`.

**`getMetrics`**:
- Parse `req.query.start_date` and `req.query.end_date`.
- Build a `createdAt` filter for transactions (`{ createdAt: { gte, lte } }`) and apply it to the `totalDonatedAgg` query.
- Build a `createdAt` filter for users and apply it to the `totalDonors` query.
- *(Pending answer to open question)* Decide whether to apply the date filter to `activeSubscribers` and `projectedMrrUsd`.

---

### Frontend UI Modifications

#### [MODIFY] [CMSTransactions.jsx](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/client/src/components/admin/CMSTransactions.jsx)
Implement state, date resolution, and UI controls for the filter.

**1. State Management Setup**
- `filterMode`: `'ALL'`, `'LAST_MONTH'`, `'LAST_YEAR'`, `'CUSTOM'`.
- `inputStartDate` / `inputEndDate`: Used for the custom date inputs to prevent rapid refetching.
- `appliedStartDate` / `appliedEndDate`: Used for the `useQuery` cache keys and fetch requests.

**2. Date Resolution Logic**
- Create a helper function `applyFilter(mode, start, end)`:
  - `'LAST_MONTH'`: Calculates exactly 1 rolling month ago and sets `appliedStartDate`/`appliedEndDate` immediately.
  - `'LAST_YEAR'`: Calculates exactly 1 rolling year ago.
  - `'ALL'`: Sets both to `null`.
  - `'CUSTOM'`: Uses the provided `start` and `end` values.

**3. UI Component Modifications**
- Add a `<select>` for `filterMode` above the metrics grid.
- Conditionally render two `<input type="date">` fields when `filterMode === 'CUSTOM'`.
- Add an "Apply Range" button for the custom mode, which triggers `applyFilter('CUSTOM', inputStartDate, inputEndDate)`.
- Use an `onChange` handler on the `<select>` to instantly trigger `applyFilter` for the predefined intervals.

**4. API Integration**
- Update the `useQuery` hooks for `['admin-metrics']` and `['admin-transactions']` to include `appliedStartDate` and `appliedEndDate` in their `queryKey`.
- Modify the `adminApi.get` calls to append `start_date` and `end_date` as URL search parameters using `URLSearchParams` when they are not null.

## Verification Plan

### Manual Verification
1. Spin up the Browser Agent.
2. Navigate to the Admin Dashboard -> Transactions Tab.
3. Select "Last Month" from the dropdown and verify the network requests include `start_date` and `end_date` parameters and update the data.
4. Select "Custom Date Range", input two dates, click "Apply Range", and verify the network requests.
5. Confirm the query properly respects the separation between input state and applied state to prevent unnecessary API calls.
