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
| `category` | No | A supported SpendLens category. CSV imports assign one using the local categorization rules below. |
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

## Rule-based categorization

CSV imports categorize normalized transactions with the local rules exported as
`DEFAULT_CATEGORIZATION_RULES` from `lib/categorize.ts`. The MVP rules are
deterministic in-process configuration only; they do not call external services
or require credentials.

Each rule has:

1. A stable `id`.
2. A target `category`.
3. One or more `matchers`.
4. An optional `transactionType` filter of `debit` or `credit`.

Matchers target either the preserved source `description` or the cleaned
`merchant` field. String matchers trim leading and trailing whitespace, collapse
internal whitespace, and compare case-insensitively by default. Supported string
operators are `contains`, `equals`, and `startsWith`. `regex` matchers evaluate
the supplied regular expression against the original field text.

All matchers on a rule must match. When multiple rules match, the first rule in
`DEFAULT_CATEGORIZATION_RULES` wins, so precedence is the array order. More
specific rules should be placed before broader rules.

If no rule matches, debit transactions receive the fallback category `Unknown`
and credit transactions receive the fallback category `Income`. Categorization
does not rewrite the original transaction description; imports preserve the
trimmed source description used by duplicate identity.

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
