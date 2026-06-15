# CSV transaction fixtures

All CSV files in this directory are synthetic. They use invented merchant names,
test-only wording, and rounded sample amounts. Do not add real customer data,
credentials, account numbers, card numbers, or production exports.

## Files

- `standard-valid-transactions.csv` - A standard MVP import shape with `Date`,
  `Description`, and `Amount` columns. Covers signed debit amounts, positive
  income-style credits, and ISO plus US date formats.
- `edge-case-transactions.csv` - A debit/credit-column export with quoted
  merchant names containing commas, blank optional memo fields, credits, and
  multiple supported date formats.
- `malformed-missing-required-fields.csv` - A parser error fixture. The second
  data row intentionally omits required date and description values.
