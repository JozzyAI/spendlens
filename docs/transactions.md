# Normalized transactions

`NormalizedTransaction` is the validation boundary for records imported from CSV
files. Runtime validation is provided by `normalizedTransactionSchema` and
`validateNormalizedTransaction` in `lib/transaction.ts`.

## Fields

| Field | Required | Representation |
| --- | --- | --- |
| `id` | Yes | Non-empty import-local identifier. |
| `date` | Yes | Valid calendar date in `YYYY-MM-DD` format. |
| `description` | Yes | Non-empty merchant description preserved from the source. |
| `merchant` | Yes | Non-empty cleaned merchant display name. |
| `amount` | Yes | Positive finite USD major-unit number with at most two decimal places. |
| `type` | Yes | `debit` or `credit`; see the sign convention below. |
| `category` | No | A supported SpendLens category. Missing means uncategorized. |
| `isRecurring` | Yes | Whether the transaction appears recurring. |
| `source` | Yes | CSV file name, one-based data row number including the header offset, and optional account identity. |
| `duplicateKey` | Yes | Deterministic serialization of the duplicate identity fields. |

## Debit and credit convention

`amount` is always an unsigned magnitude. A `debit` is cash leaving the account
and is displayed and aggregated as negative cash flow. A `credit` is cash
entering the account and is displayed and aggregated as positive cash flow.
Zero and negative normalized amounts are invalid. Import adapters must convert
source-specific signs or debit/credit columns into this representation.

For the current CSV adapter, a negative value in a generic amount column is a
debit. Positive generic values are debits unless the description identifies an
income deposit. When separate debit and credit columns exist, the populated
column determines the type.

## Duplicate identity

The duplicate identity fields are:

1. Transaction date.
2. Merchant description after trimming, whitespace collapsing, and lowercasing.
3. Amount normalized to two decimal places.
4. Debit or credit type.
5. Source account identity when supplied.

The CSV file name and row number are provenance, not duplicate identity fields,
so the same transaction imported from another copy of a statement receives the
same `duplicateKey`.

## Validation errors

Invalid normalized fields produce field-specific Zod issues. CSV imports add the
one-based source row number so malformed required fields can be located in the
uploaded file.
